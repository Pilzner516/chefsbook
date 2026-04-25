import { createClient } from '@supabase/supabase-js';
import { importFromUrl, stripHtml, classifyContent, importTechnique, extractJsonLdRecipe, checkJsonLdCompleteness, detectLanguage, translateRecipeContent, describeSourceImage, suggestTagsForRecipe, importFromYouTube, importTechniqueFromYouTube, moderateCategoricalFields } from '@chefsbook/ai';
import { logAiCall, isInternalPhotoUrl, normalizeSourceUrl, findDuplicateByUrl } from '@chefsbook/db';
import { ensureTitle } from '../../import/_utils';
import { YoutubeTranscript } from 'youtube-transcript';

function getServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';
  return createClient(url, serviceKey);
}

function extractImageUrl(html: string, pageUrl: string): string | null {
  const ogMatch = html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i)
    ?? html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i);
  if (ogMatch?.[1]) { try { return new URL(ogMatch[1], pageUrl).href; } catch { return ogMatch[1]; } }
  const schemaMatch = html.match(/"image"\s*:\s*"([^"]+)"/);
  if (schemaMatch?.[1]?.startsWith('http')) return schemaMatch[1];
  return null;
}

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  };
}

function isYouTubeUrl(url: string): boolean {
  return /(?:youtube\.com\/watch|youtu\.be\/|youtube\.com\/shorts\/)/.test(url);
}

function extractVideoId(url: string): string | null {
  const patterns = [
    /(?:youtube\.com\/watch\?.*v=|youtu\.be\/|youtube\.com\/shorts\/)([\w-]{11})/,
  ];
  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match?.[1]) return match[1];
  }
  return null;
}

async function fetchVideoMetadata(videoId: string) {
  const apiKey = process.env.YOUTUBE_API_KEY;
  if (!apiKey) {
    // Fallback: use oembed for basic metadata
    try {
      const res = await fetch(
        `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`,
        { signal: AbortSignal.timeout(10000) },
      );
      if (!res.ok) return null;
      const data = await res.json();
      return {
        title: data.title ?? '',
        description: '',
        channelTitle: data.author_name ?? '',
        thumbnails: { high: { url: `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg` } },
      };
    } catch {
      return null;
    }
  }

  try {
    const res = await fetch(
      `https://www.googleapis.com/youtube/v3/videos?part=snippet&id=${videoId}&key=${apiKey}`,
      { signal: AbortSignal.timeout(10000) },
    );
    if (!res.ok) return null;
    const data = await res.json();
    return data.items?.[0]?.snippet ?? null;
  } catch {
    return null;
  }
}

async function fetchTranscript(videoId: string): Promise<string> {
  try {
    const entries = await YoutubeTranscript.fetchTranscript(videoId);
    return entries
      .map((e) => `[${Math.round(e.offset / 1000)}s] ${e.text}`)
      .join('\n');
  } catch {
    return '';
  }
}

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: corsHeaders() });
}

export async function POST(req: Request) {
  const headers = corsHeaders();
  const db = getServiceClient();

  // Auth
  const authHeader = req.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return Response.json({ error: 'Unauthorized' }, { status: 401, headers });
  }
  const { data: { user }, error: authError } = await db.auth.getUser(authHeader.slice(7));
  if (authError || !user) {
    return Response.json({ error: 'Unauthorized' }, { status: 401, headers });
  }

  const { url, html: clientHtml, skipDuplicateCheck } = await req.json();
  if (!url || typeof url !== 'string') {
    return Response.json({ error: 'URL is required' }, { status: 400, headers });
  }

  // Duplicate check — before any AI call
  const normalizedUrl = normalizeSourceUrl(url);
  if (!skipDuplicateCheck) {
    const existing = await findDuplicateByUrl(normalizedUrl).catch(() => null);
    if (existing) {
      return Response.json({
        duplicate: true,
        existingRecipe: { id: existing.id, title: existing.title },
      }, { headers });
    }
  }

  // YouTube URL handling — route to YouTube import logic
  if (isYouTubeUrl(url)) {
    try {
      const videoId = extractVideoId(url);
      if (!videoId) {
        return Response.json({ error: 'Not a valid YouTube URL' }, { status: 400, headers });
      }

      const snippet = await fetchVideoMetadata(videoId);
      if (!snippet) {
        return Response.json({ error: 'Could not fetch video metadata' }, { status: 502, headers });
      }

      const thumbnail =
        snippet.thumbnails.maxres?.url ??
        snippet.thumbnails.high?.url ??
        snippet.thumbnails.default?.url ??
        `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;

      const transcript = await fetchTranscript(videoId);
      const classifyText = `${snippet.title}\n${snippet.description}`.slice(0, 1000);
      const classification = await classifyContent(classifyText, url);

      if (classification.content_type === 'technique') {
        const technique = await importTechniqueFromYouTube({
          videoTitle: snippet.title,
          description: snippet.description,
          transcript,
        });

        if (!technique) {
          return Response.json({ error: 'Could not extract technique from video' }, { status: 422, headers });
        }

        const { data: newTechnique, error: techErr } = await db
          .from('techniques')
          .insert({
            user_id: user.id,
            title: technique.title,
            description: technique.description,
            process_steps: technique.process_steps ?? [],
            tips: technique.tips ?? [],
            common_mistakes: technique.common_mistakes ?? [],
            tools_and_equipment: technique.tools_and_equipment ?? [],
            difficulty: technique.difficulty,
            source_url: url,
            source_type: 'youtube',
            youtube_video_id: videoId,
            image_url: null,
          })
          .select()
          .single();

        if (techErr || !newTechnique) {
          return Response.json({ error: techErr?.message ?? 'Insert failed' }, { status: 500, headers });
        }

        return Response.json({
          success: true,
          contentType: 'technique',
          technique: { id: newTechnique.id, title: newTechnique.title },
        }, { headers });
      }

      // Recipe from YouTube
      const recipe = await importFromYouTube({
        videoTitle: snippet.title,
        description: snippet.description,
        transcript,
      });

      if (!recipe) {
        return Response.json({ error: 'Could not extract recipe from video' }, { status: 422, headers });
      }

      // Moderate categorical fields before DB insert
      let moderatedCuisine: string | null = recipe.cuisine ?? null;
      let moderatedCourse: string | null = recipe.course ?? null;
      let moderatedTags: string[] = [];
      try {
        const moderated = await moderateCategoricalFields(
          'pending-extension-youtube',
          user.id,
          {
            tags: (recipe as any).tags ?? [],
            cuisine: recipe.cuisine ?? undefined,
            course: recipe.course ?? undefined,
          }
        );
        moderatedCuisine = moderated.cuisine ?? null;
        moderatedCourse = moderated.course ?? null;
        moderatedTags = moderated.tags;
        if (moderated.removed.length > 0) {
          console.log('[extension/youtube] Moderation removed:', moderated.removed);
        }
      } catch (modErr) {
        console.error('[extension/youtube] Moderation failed:', modErr);
      }

      const { data: newRecipe, error: insertErr } = await db
        .from('recipes')
        .insert({
          user_id: user.id,
          title: recipe.title,
          description: recipe.description,
          servings: recipe.servings ?? 4,
          prep_minutes: recipe.prep_minutes,
          cook_minutes: recipe.cook_minutes,
          cuisine: moderatedCuisine,
          course: moderatedCourse,
          source_type: 'youtube',
          source_url: url,
          youtube_video_id: videoId,
          image_url: null,
          notes: recipe.notes,
          tags: moderatedTags,
        })
        .select()
        .single();

      if (insertErr || !newRecipe) {
        return Response.json({ error: insertErr?.message ?? 'Insert failed' }, { status: 500, headers });
      }

      if (recipe.ingredients?.length) {
        await db.from('recipe_ingredients').insert(
          recipe.ingredients.map((ing: any, i: number) => ({
            recipe_id: newRecipe.id,
            user_id: user.id,
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
            user_id: user.id,
            step_number: step.step_number,
            instruction: step.instruction,
            timer_minutes: step.timer_minutes,
            group_label: step.group_label,
          })),
        );
      }

      // Apply completeness gate + AI verdict
      try {
        const { fetchRecipeCompleteness, applyCompletenessGate, applyAiVerdict, logImportAttempt, extractDomain } = await import('@chefsbook/db');
        const { isActuallyARecipe } = await import('@chefsbook/ai');
        const completeness = await fetchRecipeCompleteness(newRecipe.id);
        await applyCompletenessGate(newRecipe.id, completeness, newRecipe.visibility);
        let verdict: 'approved' | 'flagged' | 'not_a_recipe' = 'approved';
        let verdictReason = '';
        if (completeness.isComplete) {
          const ai = await isActuallyARecipe({
            title: newRecipe.title,
            description: recipe.description ?? '',
            ingredients: (recipe.ingredients ?? []).slice(0, 3).map((i: any) => i.ingredient),
            steps: (recipe.steps ?? []).slice(0, 1).map((s: any) => s.instruction),
          });
          verdict = ai.verdict;
          verdictReason = ai.reason;
          await applyAiVerdict(newRecipe.id, verdict, verdictReason, newRecipe.visibility);
        }
        await logImportAttempt({
          userId: user.id,
          url,
          domain: extractDomain(url),
          success: completeness.isComplete && verdict === 'approved',
          recipeId: newRecipe.id,
          failureReason: !completeness.isComplete ? completeness.missingFields.join(', ') : verdict !== 'approved' ? verdictReason : null,
          completeness,
          aiVerdict: !completeness.isComplete ? 'incomplete' : verdict === 'not_a_recipe' ? 'not_a_recipe' : verdict === 'flagged' ? 'flagged' : 'complete',
        });
      } catch {}

      // Fire-and-forget: auto-generate nutrition (Haiku ~$0.001/recipe)
      if (recipe.ingredients?.length) {
        import('@/lib/nutritionHelper').then(({ generateAndSaveNutrition }) => {
          generateAndSaveNutrition(newRecipe.id).catch(() => {});
        }).catch(() => {});
      }

      return Response.json({
        success: true,
        contentType: 'recipe',
        recipe: { id: newRecipe.id, title: newRecipe.title },
      }, { headers });
    } catch (e: any) {
      return Response.json({ error: e.message ?? 'YouTube import failed' }, { status: 500, headers });
    }
  }

  try {
    let rawHtml: string;

    if (clientHtml && typeof clientHtml === 'string' && clientHtml.length > 100) {
      rawHtml = clientHtml;
    } else {
      const response = await fetch(url, {
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36' },
        signal: AbortSignal.timeout(15000),
      });
      if (!response.ok) {
        return Response.json({ error: `Failed to fetch: ${response.status}` }, { status: 502, headers });
      }
      rawHtml = await response.text();
    }

    const imageUrl = extractImageUrl(rawHtml, url);
    // recipes.image_url / techniques.image_url must always be an internal URL
    // (copyright safety). External og:image URLs stay in source_image_url only.
    const safeImageUrl = imageUrl && isInternalPhotoUrl(imageUrl) ? imageUrl : null;
    const text = stripHtml(rawHtml).slice(0, 25000);

    if (text.length < 100) {
      return Response.json({ error: 'Page has no meaningful content' }, { status: 422, headers });
    }

    // Classify content: recipe or technique
    const classification = await classifyContent(text.slice(0, 1000), url);

    if (classification.content_type === 'technique') {
      const technique = await importTechnique(text, url);
      if (!technique) {
        return Response.json({ error: 'Could not extract technique' }, { status: 422, headers });
      }

      const { data: newTechnique, error: techErr } = await db
        .from('techniques')
        .insert({
          user_id: user.id,
          title: technique.title,
          description: technique.description,
          process_steps: technique.process_steps ?? [],
          tips: technique.tips ?? [],
          common_mistakes: technique.common_mistakes ?? [],
          tools_and_equipment: technique.tools_and_equipment ?? [],
          difficulty: technique.difficulty,
          source_url: url,
          source_type: 'extension',
          image_url: safeImageUrl,
        })
        .select()
        .single();

      if (techErr || !newTechnique) {
        return Response.json({ error: techErr?.message ?? 'Insert failed' }, { status: 500, headers });
      }

      return Response.json({
        success: true,
        contentType: 'technique',
        technique: { id: newTechnique.id, title: newTechnique.title },
      }, { headers });
    }

    // Recipe extraction: JSON-LD first, Claude as fallback
    const t0 = Date.now();
    const jsonLd = extractJsonLdRecipe(rawHtml);
    const { complete, available, missing } = checkJsonLdCompleteness(jsonLd);

    let recipe: any;
    if (complete && jsonLd) {
      recipe = { ...jsonLd, source_type: 'url' };
    } else if (jsonLd && available.length > 0) {
      const jsonLdSummary = JSON.stringify(jsonLd, null, 2).slice(0, 3000);
      recipe = await importFromUrl(text, url, { available, missing, jsonLdData: jsonLdSummary });
      if (jsonLd.ingredients?.length && available.includes('ingredients')) recipe.ingredients = jsonLd.ingredients;
      if (jsonLd.steps?.length && available.includes('steps')) recipe.steps = jsonLd.steps;
      if (jsonLd.title && !recipe.title) recipe.title = jsonLd.title;
    } else {
      recipe = await importFromUrl(text, url);
    }

    // Translate if non-English
    let sourceLanguage = 'en';
    try {
      const sampleText = `${recipe.title ?? ''} ${(recipe.ingredients ?? []).slice(0, 3).map((i: any) => i.ingredient ?? '').join(' ')}`;
      sourceLanguage = await detectLanguage(sampleText);
      if (sourceLanguage !== 'en') {
        recipe = await translateRecipeContent(recipe, 'en', sourceLanguage);
      }
    } catch { /* translation failure non-blocking */ }

    const { title, generated } = ensureTitle(recipe, url);
    const isIncomplete = !recipe.ingredients?.length || !recipe.steps?.length;
    const tags: string[] = [...(recipe.tags ?? [])];
    if (generated) tags.push('_unresolved');
    if (isIncomplete) tags.push('_incomplete');

    // Describe source image (Haiku Vision ~$0.005) — used by levels 1-2 faithful generation.
    let sourceImageDescription: string | null = null;
    if (imageUrl) {
      const tDesc = Date.now();
      try {
        sourceImageDescription = await describeSourceImage(imageUrl, title);
        logAiCall({
          userId: user.id,
          action: 'describe_source_image',
          model: 'haiku',
          durationMs: Date.now() - tDesc,
          success: !!sourceImageDescription,
        }).catch(() => {});
      } catch {
        logAiCall({
          userId: user.id,
          action: 'describe_source_image',
          model: 'haiku',
          durationMs: Date.now() - tDesc,
          success: false,
        }).catch(() => {});
      }
    }

    // Moderate categorical fields before DB insert
    let moderatedTags = tags;
    let moderatedCuisine = recipe.cuisine;
    let moderatedCourse = recipe.course;
    try {
      const moderated = await moderateCategoricalFields(
        'pending-extension-url',
        user.id,
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
        console.log('[extension/url] Moderation removed:', moderated.removed);
      }
    } catch (modErr) {
      console.error('[extension/url] Moderation failed:', modErr);
    }

    const { data: newRecipe, error: insertErr } = await db
      .from('recipes')
      .insert({
        user_id: user.id,
        title,
        description: recipe.description,
        servings: recipe.servings ?? 4,
        prep_minutes: recipe.prep_minutes,
        cook_minutes: recipe.cook_minutes,
        cuisine: moderatedCuisine,
        course: moderatedCourse,
        source_type: 'url',
        source_url: url,
        image_url: safeImageUrl,
        source_image_url: imageUrl,
        source_image_description: sourceImageDescription,
        source_url_normalized: normalizedUrl,
        notes: recipe.notes,
        tags: moderatedTags,
        source_language: sourceLanguage,
        translated_from: sourceLanguage !== 'en' ? sourceLanguage : null,
      })
      .select()
      .single();

    if (insertErr || !newRecipe) {
      return Response.json({ error: insertErr?.message ?? 'Insert failed' }, { status: 500, headers });
    }

    if (recipe.ingredients?.length) {
      await db.from('recipe_ingredients').insert(
        recipe.ingredients.map((ing: any, i: number) => ({
          recipe_id: newRecipe.id,
          user_id: user.id,
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
          user_id: user.id,
          step_number: step.step_number,
          instruction: step.instruction,
          timer_minutes: step.timer_minutes,
          group_label: step.group_label,
        })),
      );
    }

    // Fire-and-forget: auto-tag if persisted tags < 3 (Haiku ~$0.0002/recipe).
    // Runs in background so the client gets its response fast.
    const persistedTagCount = (tags ?? []).filter((t: string) => t && !t.startsWith('_')).length;
    if (persistedTagCount < 3) {
      (async () => {
        const tTags = Date.now();
        try {
          const suggestion = await suggestTagsForRecipe({
            title: newRecipe.title,
            description: recipe.description ?? null,
            ingredients: (recipe.ingredients ?? []).map((i: any) => i.ingredient).filter(Boolean),
          });

          // Moderate suggested categorical fields before updating
          let moderatedSuggestion = { ...suggestion };
          try {
            const moderated = await moderateCategoricalFields(
              newRecipe.id,
              user.id,
              {
                tags: suggestion.tags,
                cuisine: suggestion.cuisine ?? undefined,
                course: suggestion.course ?? undefined,
              }
            );
            moderatedSuggestion.tags = moderated.tags;
            moderatedSuggestion.cuisine = moderated.cuisine;
            moderatedSuggestion.course = moderated.course;
            if (moderated.removed.length > 0) {
              console.log('[extension/auto-tag] Moderation removed:', moderated.removed);
            }
          } catch (modErr) {
            console.error('[extension/auto-tag] Moderation failed:', modErr);
          }

          const updates: Record<string, unknown> = {};
          if (!newRecipe.cuisine && moderatedSuggestion.cuisine) updates.cuisine = moderatedSuggestion.cuisine;
          if (!newRecipe.course && moderatedSuggestion.course) updates.course = moderatedSuggestion.course;
          const newTags = moderatedSuggestion.tags.filter((t) => !moderatedTags.includes(t));
          if (newTags.length > 0) {
            const merged = [...moderatedTags, ...newTags].filter((t: string) => t !== '_incomplete');
            updates.tags = merged;
          }
          if (Object.keys(updates).length > 0) {
            await db.from('recipes').update(updates).eq('id', newRecipe.id);
            // Re-run completeness gate now that tags exist
            try {
              const { fetchRecipeCompleteness, applyCompletenessGate } = await import('@chefsbook/db');
              const completeness = await fetchRecipeCompleteness(newRecipe.id);
              await applyCompletenessGate(newRecipe.id, completeness);
            } catch { /* non-critical */ }
          }
          logAiCall({
            userId: user.id,
            action: 'suggest_tags',
            model: 'haiku',
            recipeId: newRecipe.id,
            durationMs: Date.now() - tTags,
            success: true,
          }).catch(() => {});
        } catch {
          logAiCall({
            userId: user.id,
            action: 'suggest_tags',
            model: 'haiku',
            recipeId: newRecipe.id,
            durationMs: Date.now() - tTags,
            success: false,
          }).catch(() => {});
        }
      })();
    }

    // Apply completeness gate + AI verdict + import logging
    try {
      const { fetchRecipeCompleteness, applyCompletenessGate, applyAiVerdict, logImportAttempt, extractDomain, logAiCall } = await import('@chefsbook/db');
      const { isActuallyARecipe } = await import('@chefsbook/ai');
      const completeness = await fetchRecipeCompleteness(newRecipe.id);
      await applyCompletenessGate(newRecipe.id, completeness, newRecipe.visibility);
      let verdict: 'approved' | 'flagged' | 'not_a_recipe' = 'approved';
      let verdictReason = '';
      if (completeness.isComplete) {
        const ai = await isActuallyARecipe({
          title: newRecipe.title,
          description: recipe.description ?? '',
          ingredients: (recipe.ingredients ?? []).slice(0, 3).map((i: any) => i.ingredient),
          steps: (recipe.steps ?? []).slice(0, 1).map((s: any) => s.instruction),
        });
        verdict = ai.verdict;
        verdictReason = ai.reason;
        await applyAiVerdict(newRecipe.id, verdict, verdictReason, newRecipe.visibility);
      }
      const urlForLog = recipe.source_url ?? '';
      if (urlForLog) {
        await logImportAttempt({
          userId: user.id,
          url: urlForLog,
          domain: extractDomain(urlForLog),
          success: completeness.isComplete && verdict === 'approved',
          recipeId: newRecipe.id,
          failureReason: !completeness.isComplete ? completeness.missingFields.join(', ') : verdict !== 'approved' ? verdictReason : null,
          completeness,
          aiVerdict: !completeness.isComplete ? 'incomplete' : verdict === 'not_a_recipe' ? 'not_a_recipe' : verdict === 'flagged' ? 'flagged' : 'complete',
        });
      }
    } catch {}

    try { const { logAiCall } = await import('@chefsbook/db'); const { consumeLastUsage } = await import('@chefsbook/ai'); const u = consumeLastUsage(); await logAiCall({ userId: user.id, action: 'import_url', model: 'sonnet', tokensIn: u?.inputTokens, tokensOut: u?.outputTokens, durationMs: Date.now() - t0, success: true }); } catch {}

    // Fire-and-forget: auto-generate AI image
    if (newRecipe.title && (recipe.ingredients?.length ?? 0) >= 2) {
      try {
        const { triggerImageGeneration } = await import('@/lib/imageGeneration');
        triggerImageGeneration(newRecipe.id, {
          title: newRecipe.title,
          cuisine: recipe.cuisine ?? null,
          ingredients: (recipe.ingredients ?? []).map((i: any) => ({ ingredient: i.ingredient })),
          tags: [],
          user_id: user.id,
          source_image_description: sourceImageDescription,
          source_image_url: imageUrl,
        });
      } catch { /* non-critical */ }
    }

    // Fire-and-forget: auto-generate nutrition (Haiku ~$0.001/recipe)
    if (recipe.ingredients?.length) {
      import('@/lib/nutritionHelper').then(({ generateAndSaveNutrition }) => {
        generateAndSaveNutrition(newRecipe.id).catch(() => {});
      }).catch(() => {});
    }

    return Response.json({
      success: true,
      contentType: 'recipe',
      recipe: { id: newRecipe.id, title: newRecipe.title },
    }, { headers });
  } catch (e: any) {
    // Telemetry: extension-path extraction failures previously never reached
    // logImportAttempt (that call lives past this catch). Log failure class
    // so admins can see parse/truncation patterns in /admin/import-sites.
    try {
      const { logImportAttempt, extractDomain } = await import('@chefsbook/db');
      const excerpt = e?.excerpt ? String(e.excerpt).slice(0, 200) : '';
      const name = e?.name ?? 'Error';
      const reason = `${name}: ${String(e?.message ?? e).slice(0, 180)}${excerpt ? ` | excerpt: ${excerpt}` : ''}`;
      await logImportAttempt({
        userId: user.id,
        url,
        domain: extractDomain(url),
        success: false,
        failureReason: `[extension-html] ${reason}`,
      });
    } catch {}
    // Friendly server-side message for the extension popup; detailed error is
    // preserved in import_attempts.failure_reason for admin review.
    const isParseOrTruncation = e?.name === 'ClaudeJsonParseError' || e?.name === 'ClaudeTruncatedError';
    const userMessage = isParseOrTruncation
      ? "Couldn't read this recipe. Try again, or open it in the web app."
      : (e?.message ?? 'Import failed');
    return Response.json({ error: userMessage }, { status: 500, headers });
  }
}
