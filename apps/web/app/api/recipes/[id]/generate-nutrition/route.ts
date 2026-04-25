import { NextRequest } from 'next/server';
import { supabase, supabaseAdmin, logAiCall } from '@chefsbook/db';
import { generateNutrition, consumeLastUsage } from '@chefsbook/ai';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: recipeId } = await params;

  // Auth check
  const authHeader = req.headers.get('authorization') ?? '';
  if (!authHeader.startsWith('Bearer ')) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const token = authHeader.slice(7);
  const {
    data: { user },
  } = await supabase.auth.getUser(token);
  if (!user) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Fetch recipe with ingredients
  const { data: recipe, error: recipeError } = await supabaseAdmin
    .from('recipes')
    .select('id, user_id, title, servings')
    .eq('id', recipeId)
    .single();

  if (recipeError || !recipe) {
    return Response.json({ error: 'Recipe not found' }, { status: 404 });
  }

  // Must be owner or admin
  if (recipe.user_id !== user.id) {
    const { data: admin } = await supabaseAdmin
      .from('admin_users')
      .select('role')
      .eq('user_id', user.id)
      .maybeSingle();
    if (!admin) {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }
  }

  // Fetch ingredients
  const { data: ingredients } = await supabaseAdmin
    .from('recipe_ingredients')
    .select('quantity, unit, ingredient')
    .eq('recipe_id', recipeId)
    .order('sort_order');

  if (!ingredients || ingredients.length === 0) {
    return Response.json(
      {
        error:
          'Recipe has no ingredients — add ingredients before generating nutrition estimates',
      },
      { status: 422 },
    );
  }

  try {
    const t0 = Date.now();
    const nutrition = await generateNutrition({
      title: recipe.title,
      servings: recipe.servings,
      ingredients: ingredients.map((ing) => ({
        quantity: ing.quantity,
        unit: ing.unit,
        ingredient: ing.ingredient,
      })),
    });

    // Log AI call
    const usage = consumeLastUsage();
    logAiCall({
      userId: user.id,
      action: 'generate_nutrition',
      model: usage?.model ?? 'haiku',
      recipeId,
      durationMs: Date.now() - t0,
      tokensIn: usage?.inputTokens,
      tokensOut: usage?.outputTokens,
      success: nutrition !== null,
    }).catch(() => {});

    if (!nutrition) {
      return Response.json(
        { error: 'Unable to estimate nutrition from the given ingredients' },
        { status: 422 },
      );
    }

    // Save to database
    const { error: updateError } = await supabaseAdmin
      .from('recipes')
      .update({
        nutrition,
        nutrition_generated_at: new Date().toISOString(),
        nutrition_source: 'ai',
      })
      .eq('id', recipeId);

    if (updateError) {
      console.error('[generate-nutrition] Update failed:', updateError);
      return Response.json(
        { error: 'Failed to save nutrition data' },
        { status: 500 },
      );
    }

    return Response.json({
      nutrition,
      recipeId,
      generated_at: new Date().toISOString(),
    });
  } catch (err: any) {
    console.error('[generate-nutrition] Error:', err);
    return Response.json({ error: err.message ?? 'Unknown error' }, { status: 500 });
  }
}
