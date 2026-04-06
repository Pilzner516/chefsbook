import { createClient } from '@supabase/supabase-js';
import { importFromUrl, stripHtml, extractJsonLdRecipe, checkJsonLdCompleteness } from '@chefsbook/ai';
import { fetchWithFallback } from '../_utils';

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
  const schemaArrayMatch = html.match(/"image"\s*:\s*\[\s*"([^"]+)"/);
  if (schemaArrayMatch?.[1]?.startsWith('http')) return schemaArrayMatch[1];
  return null;
}

async function processReimports(recipeIds: string[]) {
  const db = getServiceClient();

  for (const recipeId of recipeIds) {
    const { data: recipe } = await db
      .from('recipes')
      .select('*')
      .eq('id', recipeId)
      .single();

    if (!recipe?.source_url) continue;

    try {
      // Use fallback chain (fetch → Puppeteer → ScrapingBee)
      const { html: rawHtml } = await fetchWithFallback(recipe.source_url);
      const imageUrl = extractImageUrl(rawHtml, recipe.source_url);
      const text = stripHtml(rawHtml).slice(0, 25000);
      if (text.length < 100) continue;

      // JSON-LD first, Claude as fallback
      const jsonLd = extractJsonLdRecipe(rawHtml);
      const { complete, available, missing } = checkJsonLdCompleteness(jsonLd);

      let extracted: any;
      if (complete && jsonLd) {
        extracted = { ...jsonLd, source_type: 'url' };
      } else if (jsonLd && available.length > 0) {
        const jsonLdSummary = JSON.stringify(jsonLd, null, 2).slice(0, 3000);
        extracted = await importFromUrl(text, recipe.source_url, { available, missing, jsonLdData: jsonLdSummary });
        if (jsonLd.ingredients?.length && available.includes('ingredients')) extracted.ingredients = jsonLd.ingredients;
        if (jsonLd.steps?.length && available.includes('steps')) extracted.steps = jsonLd.steps;
        if (jsonLd.title && !extracted.title) extracted.title = jsonLd.title;
        if (jsonLd.servings && !extracted.servings) extracted.servings = jsonLd.servings;
        if (jsonLd.prep_minutes && !extracted.prep_minutes) extracted.prep_minutes = jsonLd.prep_minutes;
        if (jsonLd.cook_minutes && !extracted.cook_minutes) extracted.cook_minutes = jsonLd.cook_minutes;
      } else {
        extracted = await importFromUrl(text, recipe.source_url);
      }

      // Only update AI-derived fields — preserve user edits (tags, notes, cuisine, course)
      const updates: Record<string, any> = {
        title: extracted.title || recipe.title,
        description: extracted.description ?? recipe.description,
        servings: extracted.servings ?? recipe.servings,
        prep_minutes: extracted.prep_minutes ?? recipe.prep_minutes,
        cook_minutes: extracted.cook_minutes ?? recipe.cook_minutes,
        cuisine: recipe.cuisine || extracted.cuisine,
        course: recipe.course || extracted.course,
        image_url: recipe.image_url || imageUrl || null,
      };

      // Remove _incomplete tag if we now have complete data
      if (extracted.ingredients?.length && extracted.steps?.length && recipe.tags?.includes('_incomplete')) {
        updates.tags = recipe.tags.filter((t: string) => t !== '_incomplete');
      }

      await db.from('recipes').update(updates).eq('id', recipeId);

      // Replace ingredients and steps with fresh data
      if (extracted.ingredients?.length) {
        await db.from('recipe_ingredients').delete().eq('recipe_id', recipeId);
        await db.from('recipe_ingredients').insert(
          extracted.ingredients.map((ing: any, i: number) => ({
            recipe_id: recipeId,
            user_id: recipe.user_id,
            sort_order: i,
            quantity: ing.quantity,
            unit: ing.unit,
            ingredient: ing.ingredient,
            preparation: ing.preparation,
            optional: ing.optional ?? false,
            group_label: ing.group_label,
          })),
        );
      }
      if (extracted.steps?.length) {
        await db.from('recipe_steps').delete().eq('recipe_id', recipeId);
        await db.from('recipe_steps').insert(
          extracted.steps.map((step: any) => ({
            recipe_id: recipeId,
            user_id: recipe.user_id,
            step_number: step.step_number,
            instruction: step.instruction,
            timer_minutes: step.timer_minutes,
            group_label: step.group_label,
          })),
        );
      }
    } catch (e: any) {
      console.error(`[reimport] ${recipe.source_url} failed:`, e.message);
    }

    await new Promise((r) => setTimeout(r, 1500));
  }
}

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

  const { recipeIds } = await req.json();
  if (!Array.isArray(recipeIds) || recipeIds.length === 0) {
    return Response.json({ error: 'recipeIds array is required' }, { status: 400 });
  }

  const { data: recipes } = await db
    .from('recipes')
    .select('id, source_url')
    .eq('user_id', user.id)
    .in('id', recipeIds)
    .not('source_url', 'is', null);

  const validIds = (recipes ?? []).map((r) => r.id);
  if (validIds.length === 0) {
    return Response.json({ error: 'No valid recipes to re-import' }, { status: 400 });
  }

  processReimports(validIds).catch((e) => {
    console.error('[reimport] failed:', e);
  });

  return Response.json({ started: validIds.length });
}
