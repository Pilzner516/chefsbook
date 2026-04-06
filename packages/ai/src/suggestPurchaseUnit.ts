import { callClaude, extractJSON } from './client';

const PROMPT = `You are a grocery shopping assistant. For each ingredient, suggest:
1. purchase_unit: what a shopper would actually buy at the store (e.g. "1 bottle", "1 bunch", "1 bag 5lb", "1 can 15oz", "1 stick", "1 dozen")
2. store_category: EXACTLY one of these supermarket sections:
   produce — fruits, vegetables, fresh herbs, garlic, onions, lemons
   meat_seafood — chicken, beef, pork, lamb, fish, salmon, shrimp, bacon
   dairy_eggs — butter, milk, cream, cheese, yogurt, eggs, sour cream
   bakery — fresh breads, baked goods from the bakery counter
   baking — flour, sugar, baking powder, baking soda, yeast, vanilla, chocolate chips, cocoa, cornstarch, powdered sugar, brown sugar
   spices — salt, pepper, oregano, cumin, paprika, cinnamon, dried herbs, spice blends
   canned — canned tomatoes, beans, broth, stock, tomato paste, coconut milk
   condiments — soy sauce, olive oil, vinegar, mustard, ketchup, hot sauce, mayo
   pasta_grains — pasta, rice, quinoa, oats, couscous, breadcrumbs
   frozen — frozen vegetables, frozen meals, ice cream
   beverages — water, juice, wine, beer, coffee, tea
   household — plastic wrap, parchment paper, foil
   other — anything not in the above

Return ONLY a JSON array, one object per ingredient:
[{ "ingredient": "...", "purchase_unit": "...", "store_category": "..." }]`;

export interface PurchaseSuggestion {
  ingredient: string;
  purchase_unit: string;
  store_category: string;
}

/**
 * Suggest purchase units and store categories for a list of ingredients.
 * Batches up to 20 ingredients per Claude call.
 */
export async function suggestPurchaseUnits(
  ingredients: { name: string; quantity: string }[],
): Promise<PurchaseSuggestion[]> {
  if (ingredients.length === 0) return [];

  const list = ingredients
    .map((ing) => `- ${ing.quantity} ${ing.name}`)
    .join('\n');

  const prompt = `${PROMPT}\n\nIngredients:\n${list}`;
  const text = await callClaude({ prompt, maxTokens: 1500 });
  try {
    return extractJSON<PurchaseSuggestion[]>(text);
  } catch {
    // Fallback: return basic categorization
    return ingredients.map((ing) => ({
      ingredient: ing.name,
      purchase_unit: '',
      store_category: 'other',
    }));
  }
}
