// Recipe completeness gate logic
// Shared helper to determine if a recipe meets all completeness requirements

export interface RecipeData {
  title?: string | null;
  description?: string | null;
  ingredients?: Array<{ quantity?: number | null; ingredient?: string }>;
  steps?: Array<any>;
  tags?: string[];
}

/**
 * Returns a human-readable reason if the recipe is incomplete, or null if complete.
 * Priority order (returns the most critical gap first):
 * 1. Missing ingredients & steps (both)
 * 2. Missing ingredients
 * 3. Missing quantities
 * 4. Missing steps
 */
export function getRecipeIncompleteReason(recipe: RecipeData): string | null {
  const title = recipe.title?.trim();
  const description = recipe.description?.trim();
  const ingredients = recipe.ingredients ?? [];
  const steps = recipe.steps ?? [];

  // Must have title and description
  if (!title || !description) {
    return 'Missing title or description';
  }

  const hasIngredients = ingredients.length >= 2;
  const hasSteps = steps.length >= 1;

  // Both missing (highest priority)
  if (!hasIngredients && !hasSteps) {
    return 'Missing ingredients & steps';
  }

  // Just ingredients missing
  if (!hasIngredients) {
    return 'Missing ingredients';
  }

  // Check if ingredients have quantities
  const ingredientsWithQuantity = ingredients.filter(
    (ing) => ing.quantity != null && ing.quantity > 0
  );
  if (ingredientsWithQuantity.length < 2) {
    return 'Missing quantities';
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
