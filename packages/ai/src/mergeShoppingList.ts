import { callClaude, extractJSON, HAIKU } from './client';

export interface MergedShoppingItem {
  ingredient: string;
  quantity: number | null;
  unit: string | null;
  aisle: string;
  recipe_ids: string[];
}

const MERGE_PROMPT = `You are a shopping list optimization expert. Merge and deduplicate the following recipe ingredients into a consolidated shopping list.

Return ONLY a JSON array, no markdown, no explanation:
[
  {
    "ingredient": "string — normalized name",
    "quantity": "number | null — combined total",
    "unit": "string | null — standardized unit",
    "aisle": "string — supermarket aisle/section",
    "recipe_ids": ["string — which recipe IDs use this ingredient"]
  }
]

Rules:
- Merge identical ingredients: "2 cups flour" + "1 cup flour" = "3 cups flour"
- Normalize names: "AP flour" and "all-purpose flour" are the same
- Convert compatible units: 4 tbsp butter + 2 tbsp butter = 6 tbsp butter
- Do NOT merge different items: "green onion" ≠ "yellow onion"
- Skip common pantry staples: salt, pepper, water, cooking spray
- Assign realistic supermarket aisles: Produce, Dairy, Meat, Bakery, Frozen, Canned Goods, Condiments, Spices, Baking, Grains & Pasta, Snacks, Beverages, Deli, Other
- Sort by aisle for efficient shopping`;

export async function mergeShoppingList(
  ingredientsByRecipe: { recipeId: string; ingredients: { quantity: number | null; unit: string | null; ingredient: string }[] }[],
): Promise<MergedShoppingItem[]> {
  const formatted = ingredientsByRecipe
    .map(
      (r) =>
        `Recipe ${r.recipeId}:\n${r.ingredients.map((i) => `  - ${i.quantity ?? '?'} ${i.unit ?? ''} ${i.ingredient}`.trim()).join('\n')}`,
    )
    .join('\n\n');

  const prompt = `${MERGE_PROMPT}\n\nIngredients by recipe:\n${formatted}`;
  // Classification/merge task — Haiku handles this well at ~1/10 the cost of Sonnet.
  const text = await callClaude({ prompt, maxTokens: 3000, model: HAIKU });
  return extractJSON<MergedShoppingItem[]>(text);
}
