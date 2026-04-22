// Recipe completeness gate logic
// Shared helper to determine if a recipe meets all completeness requirements

export interface RecipeData {
  title?: string | null;
  description?: string | null;
  ingredients?: Array<{
    quantity?: number | null;
    amount?: number | null;
    ingredient?: string;
    name?: string;
    unit?: string | null;
  }>;
  steps?: Array<any>;
  tags?: string[];
}

/**
 * Returns a human-readable reason if the recipe is incomplete, or null if complete.
 *
 * IMPORTANT: This is a client-side helper for UI display only. If ingredients/steps
 * are not loaded (null/undefined/empty), this returns null (defer to DB missing_fields).
 * Only run the completeness check when ingredient data is fully present.
 *
 * Priority order (returns the most critical gap first):
 * 1. Missing ingredients & steps (both)
 * 2. Missing ingredients
 * 3. Missing quantities
 * 4. Missing steps
 */
export function getRecipeIncompleteReason(recipe: RecipeData): string | null {
  // Guard: if ingredients array is not loaded, defer to DB missing_fields
  // (client-side check only runs when ingredient data is fully present)
  if (!recipe.ingredients || recipe.ingredients.length === 0) {
    return null;
  }

  const title = recipe.title?.trim();
  const description = recipe.description?.trim();
  const ingredients = recipe.ingredients;
  const steps = recipe.steps ?? [];

  // Must have title and description
  if (!title || !description) {
    return 'Missing title or description';
  }

  // Check ingredient names (required)
  const ingredientsWithName = ingredients.filter((ing) => {
    const name = ing.ingredient ?? ing.name;
    return name && name.trim() !== '';
  });
  const hasIngredients = ingredientsWithName.length >= 2;
  const hasSteps = steps.length >= 1;

  // Both missing (highest priority)
  if (!hasIngredients && !hasSteps) {
    return 'Missing ingredients & steps';
  }

  // Just ingredients missing
  if (!hasIngredients) {
    return 'Missing ingredients';
  }

  // Check for bulk missing quantities pattern (75%+ threshold)
  // Flag as incomplete if EITHER:
  // - 75%+ of ingredients have quantity = 0 or null
  // - 75%+ of ingredients have BOTH quantity = 0/null AND no unit
  // Unit-less alone never flags; only the 75% bulk pattern triggers
  if (ingredients.length >= 2) {
    const threshold = Math.ceil(ingredients.length * 0.75);

    // Count ingredients with missing/zero quantity
    const missingQty = ingredients.filter((ing) => {
      const qty = ing.quantity ?? ing.amount;
      return qty === null || qty === undefined || qty === 0;
    }).length;

    // Count ingredients with BOTH missing/zero quantity AND no unit
    const missingQtyAndUnit = ingredients.filter((ing) => {
      const qty = ing.quantity ?? ing.amount;
      return (qty === null || qty === undefined || qty === 0) && !ing.unit;
    }).length;

    if (missingQty >= threshold || missingQtyAndUnit >= threshold) {
      return 'Missing quantities';
    }
  }

  // Just steps missing
  if (!hasSteps) {
    return 'Missing steps';
  }

  // All checks passed
  return null;
}

/**
 * Returns true if the recipe passes all completeness checks.
 */
export function isRecipeComplete(recipe: RecipeData): boolean {
  return getRecipeIncompleteReason(recipe) === null;
}

/**
 * Returns the incomplete pill text based on what's actually missing.
 * Prepends the warning emoji.
 */
export function getIncompletePillText(recipe: RecipeData): string {
  const reason = getRecipeIncompleteReason(recipe);
  if (!reason) return '';
  return `⚠ ${reason}`;
}
