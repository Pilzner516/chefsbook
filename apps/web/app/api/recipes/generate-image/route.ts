import { supabaseAdmin, logAiCall, isUserThrottled } from '@chefsbook/db';
import { triggerImageGeneration } from '../../../../lib/imageGeneration';

export async function POST(req: Request) {
  try {
    const { recipeId } = await req.json();
    if (!recipeId) {
      return Response.json({ error: 'recipeId required' }, { status: 400 });
    }

    // Fetch recipe details — include source_image_url (img2img reference) and
    // source_image_description (prompt anchor at levels 1-2).
    const { data: recipe, error } = await supabaseAdmin
      .from('recipes')
      .select('id, title, cuisine, user_id, image_generation_status, source_image_description, source_image_url, source_url')
      .eq('id', recipeId)
      .single();

    if (error || !recipe) {
      return Response.json({ error: 'Recipe not found' }, { status: 404 });
    }

    // Backfill source_image_url on-demand if missing but source_url exists
    if (!recipe.source_image_url && recipe.source_url) {
      try {
        const res = await fetch(recipe.source_url, {
          headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
          signal: AbortSignal.timeout(8000),
          redirect: 'follow',
        });
        if (res.ok) {
          const html = await res.text();
          const ogMatch = html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i)
            ?? html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i);
          if (ogMatch?.[1] && ogMatch[1].startsWith('http')) {
            recipe.source_image_url = ogMatch[1];
            // Persist so future generations don't need to re-fetch
            await supabaseAdmin.from('recipes').update({ source_image_url: ogMatch[1] }).eq('id', recipeId);
          }
        }
      } catch { /* non-blocking — fall through to t2i */ }
    }

    // Don't re-generate if already in progress or complete
    if (recipe.image_generation_status === 'generating' || recipe.image_generation_status === 'pending') {
      return Response.json({ status: 'already_generating' });
    }

    // Throttle check — soft failure for throttled users
    if (await isUserThrottled(recipe.user_id)) {
      return Response.json({ error: 'AI features are temporarily limited due to high demand.', throttled: true }, { status: 429 });
    }

    // Fetch ingredients for prompt
    const { data: ingredients } = await supabaseAdmin
      .from('recipe_ingredients')
      .select('ingredient')
      .eq('recipe_id', recipeId)
      .limit(6);

    triggerImageGeneration(recipeId, {
      title: recipe.title,
      cuisine: recipe.cuisine,
      ingredients: ingredients ?? [],
      user_id: recipe.user_id,
      source_image_description: recipe.source_image_description,
      source_image_url: recipe.source_image_url,
    });

    // Log AI cost (fire and forget) — all levels now use Flux Dev (~$0.025/image)
    logAiCall({ userId: recipe.user_id, action: 'generate_image', model: 'flux-dev', recipeId, durationMs: 0, success: true }).catch(() => {});

    return Response.json({ status: 'generating' });
  } catch (err: any) {
    return Response.json({ error: err.message }, { status: 500 });
  }
}
