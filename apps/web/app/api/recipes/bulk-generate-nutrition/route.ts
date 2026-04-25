import { NextRequest } from 'next/server';
import { supabase, supabaseAdmin, logAiCall } from '@chefsbook/db';
import { generateNutrition, consumeLastUsage } from '@chefsbook/ai';

const DELAY_MS = 1000;

export async function POST(req: NextRequest) {
  const authHeader = req.headers.get('authorization') ?? '';
  if (!authHeader.startsWith('Bearer ')) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const token = authHeader.slice(7);
  const { data: { user } } = await supabase.auth.getUser(token);
  if (!user) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { data: recipes } = await supabaseAdmin
    .from('recipes')
    .select('id')
    .eq('user_id', user.id)
    .is('nutrition', null);

  const queued = recipes?.length ?? 0;

  if (queued === 0) {
    return Response.json({ queued: 0, message: 'All your recipes already have nutrition data' });
  }

  processRecipesInBackground(user.id, recipes!.map((r) => r.id));

  return Response.json({ queued });
}

async function processRecipesInBackground(userId: string, recipeIds: string[]) {
  for (const recipeId of recipeIds) {
    try {
      const { data: recipe } = await supabaseAdmin
        .from('recipes')
        .select('id, title, servings, nutrition')
        .eq('id', recipeId)
        .single();

      if (!recipe || recipe.nutrition !== null) continue;

      const { data: ingredients } = await supabaseAdmin
        .from('recipe_ingredients')
        .select('quantity, unit, ingredient')
        .eq('recipe_id', recipeId)
        .order('sort_order');

      if (!ingredients || ingredients.length === 0) continue;

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

      const usage = consumeLastUsage();
      logAiCall({
        userId,
        action: 'user_bulk_generate_nutrition',
        model: usage?.model ?? 'haiku',
        recipeId,
        durationMs: Date.now() - t0,
        tokensIn: usage?.inputTokens,
        tokensOut: usage?.outputTokens,
        success: nutrition !== null,
      }).catch(() => {});

      if (nutrition) {
        await supabaseAdmin
          .from('recipes')
          .update({
            nutrition,
            nutrition_generated_at: new Date().toISOString(),
            nutrition_source: 'ai',
          })
          .eq('id', recipeId);
      }

      await new Promise((r) => setTimeout(r, DELAY_MS));
    } catch (err) {
      console.error('[bulk-generate-nutrition] Error processing recipe:', recipeId, err);
    }
  }
}
