import { createClient } from '@supabase/supabase-js';
import {
  createImportJob,
  addUrlsToJob,
  getQueuedUrls,
  markUrlComplete,
  markUrlFailed,
  updateJobCounters,
  checkDuplicateSourceUrl,
} from '@chefsbook/db';
import { importUrlFull, matchFolderToCategory } from '@chefsbook/ai';

// Server-side admin client — bypasses RLS for background processing
function getServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';
  return createClient(url, serviceKey);
}

// ── Bookmark HTML parser ──────────────────────────────────────────

interface ParsedBookmark {
  url: string;
  title: string;
  folder_name: string | null;
}

function parseBookmarksHtml(html: string): ParsedBookmark[] {
  const bookmarks: ParsedBookmark[] = [];
  let currentFolder: string | null = null;

  // Split into lines for simple state-machine parsing
  const lines = html.split('\n');
  for (const line of lines) {
    const trimmed = line.trim();

    // Detect folder headers: <DT><H3 ...>Folder Name</H3>
    const folderMatch = trimmed.match(/<H3[^>]*>(.*?)<\/H3>/i);
    if (folderMatch) {
      currentFolder = folderMatch[1].trim() || null;
      continue;
    }

    // Reset folder on closing </DL> (leaving a folder level)
    if (trimmed.match(/<\/DL>/i)) {
      currentFolder = null;
      continue;
    }

    // Extract links: <DT><A HREF="..." ...>Title</A>
    const linkMatch = trimmed.match(/<A\s[^>]*HREF="([^"]+)"[^>]*>(.*?)<\/A>/i);
    if (linkMatch) {
      const url = linkMatch[1].trim();
      const title = linkMatch[2].replace(/<[^>]+>/g, '').trim();

      // Only include http/https URLs
      if (url.startsWith('http://') || url.startsWith('https://')) {
        bookmarks.push({ url, title, folder_name: currentFolder });
      }
    }
  }

  return bookmarks;
}

// ── Deduplicate URLs within the batch ─────────────────────────────

function deduplicateUrls(bookmarks: ParsedBookmark[]): ParsedBookmark[] {
  const seen = new Set<string>();
  return bookmarks.filter((b) => {
    const normalized = b.url.replace(/\/+$/, '').toLowerCase();
    if (seen.has(normalized)) return false;
    seen.add(normalized);
    return true;
  });
}

// ── Background processor ──────────────────────────────────────────

// ── Category lookup cache ──────────────────────────────────────────

async function resolveCategoryId(
  serviceDb: ReturnType<typeof getServiceClient>,
  folderName: string | null,
  cache: Map<string, string | null>,
): Promise<string | null> {
  if (!folderName) return null;
  if (cache.has(folderName)) return cache.get(folderName) ?? null;

  const match = await matchFolderToCategory(folderName);
  if (!match.category_slug || !match.group_slug) {
    cache.set(folderName, null);
    return null;
  }

  // Look up the actual category ID from the database
  const { data: group } = await serviceDb
    .from('category_groups')
    .select('id')
    .eq('slug', match.group_slug)
    .single();

  if (!group) {
    cache.set(folderName, null);
    return null;
  }

  const { data: cat } = await serviceDb
    .from('categories')
    .select('id')
    .eq('group_id', group.id)
    .eq('slug', match.category_slug)
    .single();

  const catId = cat?.id ?? null;
  cache.set(folderName, catId);
  return catId;
}

async function processQueue(jobId: string, userId: string) {
  const serviceDb = getServiceClient();
  const categoryCache = new Map<string, string | null>();

  // Process URLs one at a time with a delay between each
  while (true) {
    // Fetch next queued URL
    const { data: batch } = await serviceDb
      .from('import_job_urls')
      .select('*')
      .eq('job_id', jobId)
      .eq('status', 'queued')
      .order('created_at')
      .limit(1);

    if (!batch || batch.length === 0) break;
    const urlRow = batch[0];

    // Mark as processing
    await serviceDb
      .from('import_job_urls')
      .update({ status: 'processing' })
      .eq('id', urlRow.id);

    try {
      // 1. Check for duplicate source_url in user's recipes
      const { data: existing } = await serviceDb
        .from('recipes')
        .select('id')
        .eq('user_id', userId)
        .eq('source_url', urlRow.url)
        .limit(1);

      if (existing && existing.length > 0) {
        await serviceDb
          .from('import_job_urls')
          .update({
            status: 'duplicate',
            recipe_id: existing[0].id,
            error_message: 'Recipe already imported from this URL',
          })
          .eq('id', urlRow.id);
      } else {
        // 2. Fetch, classify, extract
        const result = await importUrlFull(urlRow.url);

        if (!result.ok) {
          const status = result.reason === 'not_recipe' ? 'not_recipe' : 'failed';
          const msg = result.reason === 'not_recipe'
            ? `Not a recipe page: ${result.classification.reason}`
            : result.error;
          await serviceDb
            .from('import_job_urls')
            .update({ status, error_message: msg })
            .eq('id', urlRow.id);
        } else {
          // 3. Create recipe via service client (bypasses RLS)
          const recipe = result.recipe;
          const { data: newRecipe, error: insertErr } = await serviceDb
            .from('recipes')
            .insert({
              user_id: userId,
              title: recipe.title,
              description: recipe.description,
              servings: recipe.servings ?? 4,
              prep_minutes: recipe.prep_minutes,
              cook_minutes: recipe.cook_minutes,
              cuisine: recipe.cuisine,
              course: recipe.course,
              source_type: 'url',
              source_url: urlRow.url,
              notes: recipe.notes,
              bookmark_folder: urlRow.folder_name,
              import_job_id: jobId,
            })
            .select()
            .single();

          if (insertErr || !newRecipe) {
            await serviceDb
              .from('import_job_urls')
              .update({ status: 'failed', error_message: insertErr?.message ?? 'Insert failed' })
              .eq('id', urlRow.id);
          } else {
            // Insert ingredients + steps
            if (recipe.ingredients?.length) {
              await serviceDb.from('recipe_ingredients').insert(
                recipe.ingredients.map((ing, i) => ({
                  recipe_id: newRecipe.id,
                  user_id: userId,
                  sort_order: i,
                  quantity: ing.quantity,
                  unit: ing.unit,
                  ingredient: ing.ingredient,
                  preparation: ing.preparation,
                  optional: ing.optional,
                  group_label: ing.group_label,
                })),
              );
            }
            if (recipe.steps?.length) {
              await serviceDb.from('recipe_steps').insert(
                recipe.steps.map((step) => ({
                  recipe_id: newRecipe.id,
                  user_id: userId,
                  step_number: step.step_number,
                  instruction: step.instruction,
                  timer_minutes: step.timer_minutes,
                  group_label: step.group_label,
                })),
              );
            }

            // Auto-tag with category based on bookmark folder
            const categoryId = await resolveCategoryId(serviceDb, urlRow.folder_name, categoryCache);
            if (categoryId) {
              await serviceDb
                .from('recipe_categories')
                .upsert({ recipe_id: newRecipe.id, category_id: categoryId });
            }

            await serviceDb
              .from('import_job_urls')
              .update({ status: 'success', recipe_id: newRecipe.id })
              .eq('id', urlRow.id);
          }
        }
      }
    } catch (e: any) {
      await serviceDb
        .from('import_job_urls')
        .update({ status: 'failed', error_message: e.message?.slice(0, 500) })
        .eq('id', urlRow.id);
    }

    // Update aggregate counters on the job
    const { data: allUrls } = await serviceDb
      .from('import_job_urls')
      .select('status')
      .eq('job_id', jobId);

    const all = allUrls ?? [];
    const processed = all.filter((u) => u.status !== 'queued' && u.status !== 'processing').length;
    const failed = all.filter((u) => u.status === 'failed').length;

    await serviceDb
      .from('import_jobs')
      .update({ processed_urls: processed, failed_urls: failed })
      .eq('id', jobId);

    // Rate-limit: 2 seconds between URLs to be polite to source sites
    await new Promise((resolve) => setTimeout(resolve, 2000));
  }

  // Mark job complete
  await serviceDb
    .from('import_jobs')
    .update({ status: 'complete', completed_at: new Date().toISOString() })
    .eq('id', jobId);
}

// ── POST handler ──────────────────────────────────────────────────

export async function POST(req: Request) {
  // Extract auth from Supabase session cookie
  const serviceDb = getServiceClient();
  const authHeader = req.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const token = authHeader.slice(7);
  const { data: { user }, error: authError } = await serviceDb.auth.getUser(token);
  if (authError || !user) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const userId = user.id;

  // Parse multipart form data
  const formData = await req.formData();
  const file = formData.get('file') as File | null;

  if (!file) {
    return Response.json({ error: 'No file uploaded' }, { status: 400 });
  }

  if (file.size > 10 * 1024 * 1024) {
    return Response.json({ error: 'File too large (max 10MB)' }, { status: 400 });
  }

  const html = await file.text();

  // Parse bookmarks from HTML
  let bookmarks = parseBookmarksHtml(html);
  if (bookmarks.length === 0) {
    return Response.json({ error: 'No bookmarks found in file' }, { status: 400 });
  }

  // Deduplicate within the batch
  bookmarks = deduplicateUrls(bookmarks);

  // Create import job
  const { data: job, error: jobError } = await serviceDb
    .from('import_jobs')
    .insert({
      user_id: userId,
      source_type: 'bookmarks_html',
      total_urls: bookmarks.length,
    })
    .select()
    .single();

  if (jobError || !job) {
    return Response.json({ error: 'Failed to create import job' }, { status: 500 });
  }

  // Insert all URLs into the queue
  const urlRows = bookmarks.map((b) => ({
    job_id: job.id,
    user_id: userId,
    url: b.url,
    folder_name: b.folder_name,
  }));

  const { error: urlError } = await serviceDb
    .from('import_job_urls')
    .insert(urlRows);

  if (urlError) {
    return Response.json({ error: 'Failed to queue URLs' }, { status: 500 });
  }

  // Start background processing (fire and forget — runs after response)
  processQueue(job.id, userId).catch((e) => {
    console.error(`[import] Background processing failed for job ${job.id}:`, e);
    serviceDb
      .from('import_jobs')
      .update({ status: 'failed' })
      .eq('id', job.id)
      .then(() => {});
  });

  return Response.json({
    jobId: job.id,
    totalUrls: bookmarks.length,
    folders: [...new Set(bookmarks.map((b) => b.folder_name).filter(Boolean))],
  });
}
