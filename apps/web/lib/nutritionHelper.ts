/**
 * Fire-and-forget nutrition generation helper.
 * Used by import paths to auto-generate nutrition after recipe creation.
 */

import { supabaseAdmin, logAiCall } from '@chefsbook/db';
import { generateNutrition, consumeLastUsage } from '@chefsbook/ai';

/**
 * Generate and save nutrition data for a recipe.
 * Runs fire-and-forget — never blocks, never throws.
 * Skips if recipe already has nutrition or has no ingredients.
 */
export async function generateAndSaveNutrition(recipeId: string): Promise<void> {
  try {
    // Check if nutrition already exists
    const { data: recipe } = await supabaseAdmin
      .from('recipes')
      .select('id, title, servings, nutrition')
      .eq('id', recipeId)
      .single();

    if (!recipe || recipe.nutrition) {
      // Already has nutrition or recipe not found
      return;
    }

    // Fetch ingredients
    const { data: ingredients } = await supabaseAdmin
      .from('recipe_ingredients')
      .select('quantity, unit, ingredient')
      .eq('recipe_id', recipeId)
      .order('sort_order');

    if (!ingredients || ingredients.length === 0) {
      // No ingredients — can't generate nutrition
      return;
    }

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

    // Log AI call regardless of result
    const usage = consumeLastUsage();
    logAiCall({
      userId: null,
      action: 'generate_nutrition',
      model: usage?.model ?? 'haiku',
      recipeId,
      durationMs: Date.now() - t0,
      tokensIn: usage?.inputTokens,
      tokensOut: usage?.outputTokens,
      success: nutrition !== null,
    }).catch(() => {});

    if (!nutrition) {
      // Generation failed — silent fail
      return;
    }

    // Save to database
    await supabaseAdmin
      .from('recipes')
      .update({
        nutrition,
        nutrition_generated_at: new Date().toISOString(),
        nutrition_source: 'ai',
      })
      .eq('id', recipeId);
  } catch (err) {
    // Fire-and-forget — swallow all errors
    console.warn('[generateAndSaveNutrition] Failed:', err);
  }
}

/**
 * Trigger nutrition generation via API route.
 * For use in client-side code where supabaseAdmin is not available.
 */
export async function triggerNutritionGeneration(
  recipeId: string,
  token: string,
): Promise<void> {
  try {
    await fetch(`/api/recipes/${recipeId}/generate-nutrition`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    });
  } catch {
    // Fire-and-forget — swallow all errors
  }
}
