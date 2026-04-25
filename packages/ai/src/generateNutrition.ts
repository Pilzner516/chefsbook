/**
 * Generate nutrition estimates for a recipe using Claude.
 * Returns null on any error — never throws.
 */

import { callClaude, extractJSON } from './client';
import { getModelForTask } from './modelConfig';

// ── Types ──

export interface NutritionEstimate {
  per_serving: {
    calories: number;
    protein_g: number;
    carbs_g: number;
    fat_g: number;
    fiber_g: number;
    sugar_g: number;
    sodium_mg: number;
  };
  per_100g: {
    calories: number;
    protein_g: number;
    carbs_g: number;
    fat_g: number;
    fiber_g: number;
    sugar_g: number;
    sodium_mg: number;
  } | null;
  total_weight_g: number | null;
  confidence: number;
  notes: string | null;
}

export interface NutritionInput {
  title: string;
  servings: number | null;
  ingredients: Array<{
    quantity: number | null;
    unit: string | null;
    ingredient: string;
  }>;
}

// ── Prompt ──

const NUTRITION_PROMPT = `You are a professional nutritionist with expertise in food science and the USDA nutritional database. Estimate the nutritional content of this recipe based solely on the ingredient list provided.

RECIPE TITLE: {{title}}
SERVINGS: {{servings}}

INGREDIENTS:
{{ingredients}}

YOUR TASK:
1. Calculate nutritional values PER SERVING using USDA reference data.
2. Account for cooking transformations:
   - Fat absorption during frying (oils typically reduce by 15-25%)
   - Water loss in roasting/grilling (meat loses 25-35% weight)
   - Nutrient retention varies by method (boiling loses more water-soluble vitamins than steaming)
3. Estimate total weight of ONE SERVING in grams.
4. If you can confidently estimate serving weight, calculate per-100g values using:
   per_100g_value = (per_serving_value / total_weight_g) * 100
5. Assign a confidence score based on data quality:
   - 0.9–1.0: All quantities are precise, standard recognizable ingredients (e.g., "200g chicken breast", "1 cup rice")
   - 0.7–0.9: Most quantities present, minor estimation for prep methods or generic items
   - 0.5–0.7: Several "to taste" items, vague quantities ("some", "handful"), or unfamiliar ingredients
   - 0.3–0.5: Many missing quantities, complex multi-step preparations with unclear proportions
   - Below 0.3: Insufficient data for meaningful estimation

SPECIAL CASES:
- For "salt to taste" / "pepper to taste": use 1/4 tsp salt (~600mg sodium), negligible pepper
- For "oil for frying": estimate 1-2 tbsp absorbed per serving depending on food surface area
- For servings null or 0: assume 4 servings
- For soups, sauces, stews, beverages, or items where weight varies significantly by serving style:
  Set per_100g to null and total_weight_g to null (do not guess)
- For baked goods: account for water loss during baking (~10-15%)
- For alcohol: note that ~85% of alcohol calories remain after brief cooking, less with long simmering

Return ONLY a JSON object — no markdown, no explanation, no preamble:
{
  "per_serving": {
    "calories": <number>,
    "protein_g": <number>,
    "carbs_g": <number>,
    "fat_g": <number>,
    "fiber_g": <number>,
    "sugar_g": <number>,
    "sodium_mg": <number>
  },
  "per_100g": {
    "calories": <number>,
    "protein_g": <number>,
    "carbs_g": <number>,
    "fat_g": <number>,
    "fiber_g": <number>,
    "sugar_g": <number>,
    "sodium_mg": <number>
  } | null,
  "total_weight_g": <number> | null,
  "confidence": <number between 0.0 and 1.0>,
  "notes": "<brief explanation of key assumptions or limitations>" | null
}

Round all nutritional values to 1 decimal place. Be conservative rather than optimistic with estimates.`;

// ── Implementation ──

function formatIngredients(
  ingredients: NutritionInput['ingredients'],
): string {
  return ingredients
    .map((ing) => {
      const qty = ing.quantity != null ? `${ing.quantity} ` : '';
      const unit = ing.unit ? `${ing.unit} ` : '';
      return `- ${qty}${unit}${ing.ingredient}`;
    })
    .join('\n');
}

function validateAndClamp(estimate: NutritionEstimate): NutritionEstimate {
  // Clamp confidence to 0-1 range
  estimate.confidence = Math.max(0, Math.min(1, estimate.confidence));

  // Ensure all per_serving values are non-negative
  const ps = estimate.per_serving;
  ps.calories = Math.max(0, ps.calories);
  ps.protein_g = Math.max(0, ps.protein_g);
  ps.carbs_g = Math.max(0, ps.carbs_g);
  ps.fat_g = Math.max(0, ps.fat_g);
  ps.fiber_g = Math.max(0, ps.fiber_g);
  ps.sugar_g = Math.max(0, ps.sugar_g);
  ps.sodium_mg = Math.max(0, ps.sodium_mg);

  // Same for per_100g if present
  if (estimate.per_100g) {
    const p100 = estimate.per_100g;
    p100.calories = Math.max(0, p100.calories);
    p100.protein_g = Math.max(0, p100.protein_g);
    p100.carbs_g = Math.max(0, p100.carbs_g);
    p100.fat_g = Math.max(0, p100.fat_g);
    p100.fiber_g = Math.max(0, p100.fiber_g);
    p100.sugar_g = Math.max(0, p100.sugar_g);
    p100.sodium_mg = Math.max(0, p100.sodium_mg);
  }

  // Ensure total_weight_g is positive if present
  if (estimate.total_weight_g != null && estimate.total_weight_g <= 0) {
    estimate.total_weight_g = null;
    estimate.per_100g = null;
  }

  return estimate;
}

/**
 * Generate nutrition estimates for a recipe.
 * Returns null if ingredients are empty or on any error.
 * Never throws — all errors are caught and logged.
 */
export async function generateNutrition(
  input: NutritionInput,
): Promise<NutritionEstimate | null> {
  // Validation: need at least 1 ingredient to estimate
  if (!input.ingredients || input.ingredients.length === 0) {
    return null;
  }

  // Filter out empty ingredient entries
  const validIngredients = input.ingredients.filter(
    (ing) => ing.ingredient && ing.ingredient.trim().length > 0,
  );

  if (validIngredients.length === 0) {
    return null;
  }

  try {
    const model = await getModelForTask('nutrition');
    const servings = input.servings && input.servings > 0 ? input.servings : 4;

    const prompt = NUTRITION_PROMPT
      .replace('{{title}}', input.title || 'Untitled Recipe')
      .replace('{{servings}}', String(servings))
      .replace('{{ingredients}}', formatIngredients(validIngredients));

    const text = await callClaude({
      prompt,
      maxTokens: 800,
      model,
    });

    const result = extractJSON<NutritionEstimate>(text);

    // Validate required structure
    if (
      !result.per_serving ||
      typeof result.per_serving.calories !== 'number'
    ) {
      console.warn('[generateNutrition] Invalid response structure');
      return null;
    }

    return validateAndClamp(result);
  } catch (error) {
    console.warn('[generateNutrition] Failed:', error);
    return null;
  }
}
