import { createClient } from '@supabase/supabase-js';
import { importFromUrl, stripHtml, extractJsonLdRecipe, checkJsonLdCompleteness, moderateCategoricalFields } from '@chefsbook/ai';
import { preflightUrl, fetchWithFallback, ensureTitle } from '../_utils';

function extractImageUrl(html: string, pageUrl: string): string | null {
  const ogMatch = html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i)
    ?? html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i);
  if (ogMatch?.[1]) { try { return new URL(ogMatch[1], pageUrl).href; } catch { return ogMatch[1]; } }
  const schemaMatch = html.match(/"image"\s*:\s*"([^"]+)"/);
  if (schemaMatch?.[1]?.startsWith('http')) return schemaMatch[1];
  const schemaArrayMatch = html.match(/"image"\s*:\s*\[\s*"([^"]+)"/);
  if (schemaArrayMatch?.[1]?.startsWith('http')) return schemaArrayMatch[1];
  return null;
}

function getServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';
  return createClient(url, serviceKey);
}

// Background processor — runs after the response is sent
async function processQueue(jobId: string, userId: string) {
  const db = getServiceClient();

  while (true) {
    const { data: batch } = await db
      .from('import_job_urls')
      .select('*')
      .eq('job_id', jobId)
      .eq('status', 'queued')
      .order('created_at')
      .limit(1);

    if (!batch || batch.length === 0) break;
    const row = batch[0];

    await db
      .from('import_job_urls')
      .update({ status: 'processing' })
      .eq('id', row.id);

    try {
      // Pre-flight: reject obviously non-recipe URLs
      const preflight = preflightUrl(row.url);
      if (!preflight.ok) {
        await db
          .from('import_job_urls')
          .update({ status: 'not_recipe', error_message: preflight.error })
          .eq('id', row.id);
        throw new Error('__skip__');
      }

      // Fetch with fallback chain (standard → Puppeteer → ScrapingBee)
      const { html: rawHtml } = await fetchWithFallback(row.url);

      const imageUrl = extractImageUrl(rawHtml, row.url);
      const text = stripHtml(rawHtml).slice(0, 25000);

      if (text.length < 500) {
        await db
          .from('import_job_urls')
          .update({ status: 'not_recipe', error_message: 'Page has no meaningful content (JS-rendered site?)' })
          .eq('id', row.id);
      } else {
        // JSON-LD first, Claude as fallback
        const jsonLd = extractJsonLdRecipe(rawHtml);
        const { complete, available, missing } = checkJsonLdCompleteness(jsonLd);

        let recipe: any;
        if (complete && jsonLd) {
          recipe = { ...jsonLd, source_type: 'url' };
        } else if (jsonLd && available.length > 0) {
          const jsonLdSummary = JSON.stringify(jsonLd, null, 2).slice(0, 3000);
          recipe = await importFromUrl(text, row.url, { available, missing, jsonLdData: jsonLdSummary });
          if (jsonLd.ingredients?.length && available.includes('ingredients')) recipe.ingredients = jsonLd.ingredients;
          if (jsonLd.steps?.length && available.includes('steps')) recipe.steps = jsonLd.steps;
          if (jsonLd.title && !recipe.title) recipe.title = jsonLd.title;
          if (jsonLd.servings && !recipe.servings) recipe.servings = jsonLd.servings;
          if (jsonLd.prep_minutes && !recipe.prep_minutes) recipe.prep_minutes = jsonLd.prep_minutes;
          if (jsonLd.cook_minutes && !recipe.cook_minutes) recipe.cook_minutes = jsonLd.cook_minutes;
        } else {
          recipe = await importFromUrl(text, row.url);
        }

        const { title, generated } = ensureTitle(recipe, row.url);
        const isIncomplete = !recipe.ingredients?.length || !recipe.steps?.length;
        const tags: string[] = [];
        if (generated) tags.push('_unresolved');
        if (isIncomplete) tags.push('_incomplete');

        // Moderate categorical fields before DB insert
        let moderatedTags = tags;
        let moderatedCuisine = recipe.cuisine;
        let moderatedCourse = recipe.course;
        try {
          const moderated = await moderateCategoricalFields(
            'pending-batch-import',
            userId,
            {
              tags,
              cuisine: recipe.cuisine,
              course: recipe.course,
            }
          );
          moderatedTags = moderated.tags;
          moderatedCuisine = moderated.cuisine;
          moderatedCourse = moderated.course;
          if (moderated.removed.length > 0) {
            console.log('[batch/import] Moderation removed:', moderated.removed);
          }
        } catch (modErr) {
          console.error('[batch/import] Moderation failed:', modErr);
        }

        const { data: newRecipe, error: insertErr } = await db
          .from('recipes')
          .insert({
            user_id: userId,
            title,
            description: recipe.description,
            servings: recipe.servings ?? 4,
            prep_minutes: recipe.prep_minutes,
            cook_minutes: recipe.cook_minutes,
            cuisine: moderatedCuisine,
            course: moderatedCourse,
            source_type: 'url',
            source_url: row.url,
            image_url: imageUrl,
            notes: recipe.notes,
            tags: moderatedTags,
            bookmark_folder: row.folder_name,
            import_job_id: jobId,
          })
          .select()
          .single();

        if (insertErr || !newRecipe) {
          await db
            .from('import_job_urls')
            .update({ status: 'failed', error_message: insertErr?.message ?? 'Insert failed' })
            .eq('id', row.id);
        } else {
          // Insert ingredients + steps
          if (recipe.ingredients?.length) {
            await db.from('recipe_ingredients').insert(
              recipe.ingredients.map((ing: any, i: number) => ({
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
            await db.from('recipe_steps').insert(
              recipe.steps.map((step: any) => ({
                recipe_id: newRecipe.id,
                user_id: userId,
                step_number: step.step_number,
                instruction: step.instruction,
                timer_minutes: step.timer_minutes,
                group_label: step.group_label,
              })),
            );
          }

          await db
            .from('import_job_urls')
            .update({ status: 'success', recipe_id: newRecipe.id })
            .eq('id', row.id);
        }
      }
    } catch (e: any) {
      if (e.message !== '__skip__') {
        await db
          .from('import_job_urls')
          .update({ status: 'failed', error_message: e.message?.slice(0, 500) })
          .eq('id', row.id);
      }
    }

    // Update counters
    const { data: allUrls } = await db
      .from('import_job_urls')
      .select('status')
      .eq('job_id', jobId);

    const all = allUrls ?? [];
    const processed = all.filter((u) => u.status !== 'queued' && u.status !== 'processing').length;
    const failed = all.filter((u) => u.status === 'failed').length;

    await db
      .from('import_jobs')
      .update({ processed_urls: processed, failed_urls: failed })
      .eq('id', jobId);

    // Rate-limit between URLs
    await new Promise((r) => setTimeout(r, 1500));
  }

  // Mark complete
  await db
    .from('import_jobs')
    .update({ status: 'complete', completed_at: new Date().toISOString() })
    .eq('id', jobId);
}

// ── POST: start a batch import ───────────────────────────────────

export async function POST(req: Request) {
  const db = getServiceClient();

  const authHeader = req.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const { data: { user }, error: authError } = await db.auth.getUser(authHeader.slice(7));
  if (authError || !user) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { urls } = await req.json();
  if (!Array.isArray(urls) || urls.length === 0) {
    return Response.json({ error: 'urls array is required' }, { status: 400 });
  }

  // Create import job
  const { data: job, error: jobError } = await db
    .from('import_jobs')
    .insert({
      user_id: user.id,
      source_type: 'bookmarks_html',
      total_urls: urls.length,
    })
    .select()
    .single();

  if (jobError || !job) {
    return Response.json({ error: 'Failed to create import job' }, { status: 500 });
  }

  // Queue all URLs
  const rows = urls.map((u: { url: string; folder?: string }) => ({
    job_id: job.id,
    user_id: user.id,
    url: u.url,
    folder_name: u.folder ?? null,
  }));

  const { error: urlError } = await db.from('import_job_urls').insert(rows);
  if (urlError) {
    return Response.json({ error: 'Failed to queue URLs' }, { status: 500 });
  }

  // Fire and forget
  processQueue(job.id, user.id).catch((e) => {
    console.error(`[batch] job ${job.id} failed:`, e);
    db.from('import_jobs').update({ status: 'failed' }).eq('id', job.id);
  });

  return Response.json({ jobId: job.id, totalUrls: urls.length });
}

// ── GET: poll job status ──────────────────────────────────────────

export async function GET(req: Request) {
  const db = getServiceClient();
  const { searchParams } = new URL(req.url);
  const jobId = searchParams.get('jobId');

  if (!jobId) {
    return Response.json({ error: 'jobId is required' }, { status: 400 });
  }

  const { data: job } = await db
    .from('import_jobs')
    .select('*')
    .eq('id', jobId)
    .single();

  if (!job) {
    return Response.json({ error: 'Job not found' }, { status: 404 });
  }

  const { data: urls } = await db
    .from('import_job_urls')
    .select('url, folder_name, status, error_message, recipe_id')
    .eq('job_id', jobId)
    .order('created_at');

  return Response.json({ job, urls: urls ?? [] });
}
