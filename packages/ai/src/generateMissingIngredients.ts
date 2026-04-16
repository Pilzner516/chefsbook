import { callClaude, extractJSON, SONNET } from './client';

export interface GeneratedIngredient {
  amount: number | null;
  unit: string | null;
  name: string;
}

/**
 * Generate a complete ingredient list from recipe title, description, steps,
 * and culinary knowledge. Used when server-side extraction failed to capture
 * ingredients (JS-rendered sites) but got everything else.
 *
 * Uses SONNET for accuracy — ~$0.003 per call.
 */
export async function generateMissingIngredients(recipe: {
  title: string;
  description?: string | null;
  steps: string[];
  servings?: number | null;
  cuisine?: string | null;
  tags?: string[];
}): Promise<GeneratedIngredient[]> {
  const prompt = `You are an expert chef. Generate a complete, accurate ingredient list for this recipe based on all available information.

Recipe: "${recipe.title}"
${recipe.cuisine ? `Cuisine: ${recipe.cuisine}` : ''}
${recipe.description ? `Description: ${recipe.description}` : ''}
Servings: ${recipe.servings ?? 4}
${recipe.tags?.length ? `Tags: ${recipe.tags.filter(t => !t.startsWith('_')).join(', ')}` : ''}

Steps (which reference the ingredients):
${recipe.steps.map((s, i) => `${i + 1}. ${s}`).join('\n')}

Generate the complete ingredient list with exact quantities and units as they would appear in the original recipe. Be precise — use standard recipe measurements. Do not invent ingredients not referenced in the steps or description.

Return ONLY a valid JSON array:
[
  { "amount": 2, "unit": "cups", "name": "all-purpose flour" },
  { "amount": 1, "unit": "tsp", "name": "salt" },
  { "amount": null, "unit": null, "name": "fresh basil, for garnish" }
]`;

  const raw = await callClaude({ prompt, model: SONNET, maxTokens: 2000 });
  const ingredients = extractJSON<GeneratedIngredient[]>(raw);

  if (!Array.isArray(ingredients)) {
    throw new Error('AI did not return an array');
  }

  return ingredients.map((ing) => ({
    amount: ing.amount ?? null,
    unit: ing.unit ?? null,
    name: String(ing.name || '').trim(),
  })).filter((ing) => ing.name.length > 0);
}
