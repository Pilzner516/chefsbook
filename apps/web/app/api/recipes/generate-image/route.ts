import { supabaseAdmin, logAiCall } from '@chefsbook/db';
import { triggerImageGeneration } from '../../../../lib/imageGeneration';

export async function POST(req: Request) {
  try {
    const { recipeId } = await req.json();
    if (!recipeId) {
      return Response.json({ error: 'recipeId required' }, { status: 400 });
    }

    // Fetch recipe details
    const { data: recipe, error } = await supabaseAdmin
      .from('recipes')
      .select('id, title, cuisine, user_id, image_generation_status')
      .eq('id', recipeId)
      .single();

    if (error || !recipe) {
      return Response.json({ error: 'Recipe not found' }, { status: 404 });
    }

    // Don't re-generate if already in progress or complete
    if (recipe.image_generation_status === 'generating' || recipe.image_generation_status === 'pending') {
      return Response.json({ status: 'already_generating' });
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
    });

    // Log AI cost (fire and forget — model determined by plan)
    logAiCall({ userId: recipe.user_id, action: 'generate_image', model: 'flux-schnell', recipeId }).catch(() => {});

    return Response.json({ status: 'generating' });
  } catch (err: any) {
    return Response.json({ error: err.message }, { status: 500 });
  }
}
