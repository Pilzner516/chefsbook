import { supabase, supabaseAdmin, logAiCall } from '@chefsbook/db';
import { REGEN_PILLS } from '@chefsbook/ai';
import { triggerImageGeneration } from '@/lib/imageGeneration';

export async function POST(req: Request) {
  const authHeader = req.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const token = authHeader.slice(7);
  const { data: { user } } = await supabase.auth.getUser(token);
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const { recipeId, pillId } = await req.json();
  if (!recipeId || !pillId) {
    return Response.json({ error: 'recipeId and pillId required' }, { status: 400 });
  }

  const pill = REGEN_PILLS.find((p) => p.id === pillId);
  if (!pill) {
    return Response.json({ error: 'Invalid pill' }, { status: 400 });
  }

  // Check recipe ownership
  const { data: recipe } = await supabaseAdmin
    .from('recipes')
    .select('id, title, cuisine, user_id, source_image_description')
    .eq('id', recipeId)
    .single();
  if (!recipe || recipe.user_id !== user.id) {
    return Response.json({ error: 'Recipe not found' }, { status: 404 });
  }

  // Check regen limit (5 per recipe — enough to cycle through all pills)
  const REGEN_LIMIT = 5;
  const { data: photo } = await supabaseAdmin
    .from('recipe_user_photos')
    .select('id, regen_count')
    .eq('recipe_id', recipeId)
    .eq('is_ai_generated', true)
    .maybeSingle();

  if (!photo) {
    return Response.json({ error: 'No AI image to regenerate' }, { status: 400 });
  }

  if ((photo.regen_count ?? 0) >= REGEN_LIMIT) {
    return Response.json({ error: 'Regeneration limit reached for this recipe' }, { status: 429 });
  }

  // NOTE: regen_count is incremented by generateAndSaveRecipeImage after successful save,
  // NOT here before triggering — so failures don't burn the user's regen allowance.

  // Fetch ingredients for prompt
  const { data: ingredients } = await supabaseAdmin
    .from('recipe_ingredients')
    .select('ingredient')
    .eq('recipe_id', recipeId)
    .limit(6);

  // Trigger regeneration with pill modifier
  const t0 = Date.now();
  triggerImageGeneration(
    recipeId,
    {
      title: recipe.title,
      cuisine: recipe.cuisine,
      ingredients: ingredients ?? [],
      tags: [],
      user_id: recipe.user_id,
      source_image_description: recipe.source_image_description,
    },
    { modifier: pill.modifier, replaceExisting: true },
  );

  // Log regen cost (fire-and-forget — generation is async)
  logAiCall({
    userId: user.id,
    action: 'regenerate_image',
    model: 'flux-schnell',
    recipeId,
    durationMs: Date.now() - t0,
    success: true,
  }).catch(() => {});

  return Response.json({ status: 'generating', pill: pill.label });
}
