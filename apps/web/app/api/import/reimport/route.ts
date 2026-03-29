import { createClient } from '@supabase/supabase-js';
import { importFromUrl, stripHtml } from '@chefsbook/ai';

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

// Background processor
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
      const response = await fetch(recipe.source_url, {
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36' },
        signal: AbortSignal.timeout(15000),
      });
      if (!response.ok) {
        console.error(`[reimport] ${recipe.source_url} returned ${response.status}`);
        continue;
      }

      const rawHtml = await response.text();
      const imageUrl = extractImageUrl(rawHtml, recipe.source_url);
      const text = stripHtml(rawHtml).slice(0, 10000);
      if (text.length < 100) continue;

      const extracted = await importFromUrl(text, recipe.source_url);

      // Only update AI-derived fields — preserve user edits
      await db
        .from('recipes')
        .update({
          description: extracted.description,
          servings: extracted.servings ?? recipe.servings,
          prep_minutes: extracted.prep_minutes,
          cook_minutes: extracted.cook_minutes,
          cuisine: recipe.cuisine || extracted.cuisine,
          course: recipe.course || extracted.course,
          image_url: recipe.image_url || imageUrl || null,
        })
        .eq('id', recipeId);

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
            optional: ing.optional,
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
    } catch {
      // skip failed recipes
    }

    // Rate-limit
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

  // Verify all recipes belong to user and have source_url
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

  // Fire and forget
  processReimports(validIds).catch((e) => {
    console.error('[reimport] failed:', e);
  });

  return Response.json({ started: validIds.length });
}
