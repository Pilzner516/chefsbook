import { callClaude, extractJSON } from './client';

export interface CategoryMatch {
  category_slug: string | null;
  group_slug: string | null;
  confidence: number;
  path: string | null;
}

// Full taxonomy reference for Claude — subcategory level only (parents)
const TAXONOMY = `
ingredient > Meat, Poultry, Fish, Shellfish & seafood, Fungi, Vegetables, Fruit & berries, Chocolate, Bread & dough, Pastry, Dairy & eggs, Grains & pulses, Pantry heroes
cuisine > French regions (Provençal, Lyonnaise, Alsatian, Basque FR, Breton, Burgundian, Nice & Côte d'Azur, Normand), Italian regions (Roman, Neapolitan, Sicilian, Venetian, Tuscan, Milanese, Sardinian, Ligurian), Spanish & Portuguese (Catalan, Andalusian, Basque ES, Galician, Portuguese, Madeira & Azores), British & Irish, Mediterranean (Greek, Turkish, Lebanese, Moroccan, Israeli, Egyptian, Tunisian), Asian (Japanese, Chinese, Thai, Indian, Korean, Vietnamese, Malaysian, Filipino, Sri Lankan), Middle Eastern (Persian, Syrian, Jordanian, Yemeni, Gulf), The Americas (American South, Tex-Mex, Mexican, Peruvian, Brazilian, Caribbean, Cajun & Creole), Nordic & Eastern Europe (Scandinavian, German, Polish, Hungarian, Russian), African (West African, Ethiopian, South African, North African)
meal > Breakfast & brunch, Lunch, Dinner starters, Dinner mains, Sides & accompaniments, Desserts, Bread & baking, Drinks & cocktails, Snacks & nibbles
method > Baking & pastry, Roasting & grilling, Braising & slow cooking, Frying, Steaming & poaching, Raw & no-cook, Fermenting & preserving, Equipment-led
diet > Plant-based (Vegan, Vegetarian, Flexitarian, Raw food), Allergen-free (Gluten-free, Dairy-free, Nut-free), Health-focused, Cultural & religious, Lifestyle diets (Keto, Paleo, Mediterranean, Whole30, DASH)
time > Express, Medium, Worth the wait, Hands-off
occasion > Dinner parties, Family meals, Celebrations, Everyday cooking, Al fresco
season > Spring, Summer, Autumn, Winter
`.trim();

const MATCH_PROMPT = `You are a recipe taxonomy matcher. Given a bookmark folder name, find the best matching category from this taxonomy.

${TAXONOMY}

Rules:
- Match the folder name to the MOST SPECIFIC category possible
- "Fungi" → ingredient > Fungi (exact match)
- "Bread" → ingredient > Bread & dough (close match)
- "Nice" → cuisine > French regions > Nice & Côte d'Azur (city match)
- "Pastry" → ingredient > Pastry (direct match)
- "Fish" → ingredient > Fish (direct match)
- "Chocolate" → ingredient > Chocolate (direct match)
- "Thai food" → cuisine > Asian > Thai
- Folder names that are too broad ("Recipes", "Cooking", "Food", "Cooking methods") → null
- Folder names that don't match any category → null

Return ONLY a JSON object:
{ "group_slug": "ingredient|cuisine|meal|method|diet|time|occasion|season|null", "category_slug": "the-slug-form|null", "confidence": 0.0-1.0, "path": "group > parent > child | null" }

Use kebab-case for slugs (e.g., "bread-dough", "french-regions", "nice-cote-dazur").
If no good match exists (confidence < 0.4), return all nulls.`;

// Static exact-match lookup for common cases (avoids API call)
const EXACT_MATCHES: Record<string, CategoryMatch> = {
  'fungi':      { group_slug: 'ingredient', category_slug: 'fungi', confidence: 1.0, path: 'ingredient > Fungi' },
  'mushrooms':  { group_slug: 'ingredient', category_slug: 'fungi', confidence: 0.95, path: 'ingredient > Fungi' },
  'meat':       { group_slug: 'ingredient', category_slug: 'meat', confidence: 1.0, path: 'ingredient > Meat' },
  'poultry':    { group_slug: 'ingredient', category_slug: 'poultry', confidence: 1.0, path: 'ingredient > Poultry' },
  'fish':       { group_slug: 'ingredient', category_slug: 'fish', confidence: 1.0, path: 'ingredient > Fish' },
  'chocolate':  { group_slug: 'ingredient', category_slug: 'chocolate', confidence: 1.0, path: 'ingredient > Chocolate' },
  'bread':      { group_slug: 'ingredient', category_slug: 'bread-dough', confidence: 0.9, path: 'ingredient > Bread & dough' },
  'pastry':     { group_slug: 'ingredient', category_slug: 'pastry', confidence: 1.0, path: 'ingredient > Pastry' },
  'vegetables': { group_slug: 'ingredient', category_slug: 'vegetables', confidence: 1.0, path: 'ingredient > Vegetables' },
  'dairy':      { group_slug: 'ingredient', category_slug: 'dairy-eggs', confidence: 0.9, path: 'ingredient > Dairy & eggs' },
  'desserts':   { group_slug: 'ingredient', category_slug: 'chocolate', confidence: 0.5, path: 'meal > Desserts' },
  'dessert':    { group_slug: 'meal', category_slug: 'desserts', confidence: 1.0, path: 'meal > Desserts' },
  'breakfast':  { group_slug: 'meal', category_slug: 'breakfast-brunch', confidence: 1.0, path: 'meal > Breakfast & brunch' },
  'lunch':      { group_slug: 'meal', category_slug: 'lunch', confidence: 1.0, path: 'meal > Lunch' },
  'dinner':     { group_slug: 'meal', category_slug: 'dinner-mains', confidence: 0.9, path: 'meal > Dinner mains' },
  'starters':   { group_slug: 'meal', category_slug: 'dinner-starters', confidence: 0.9, path: 'meal > Dinner starters' },
  'soups':      { group_slug: 'meal', category_slug: 'lunch', confidence: 0.6, path: 'meal > Lunch > Soups' },
  'salads':     { group_slug: 'meal', category_slug: 'lunch', confidence: 0.6, path: 'meal > Lunch > Salads' },
  'vegan':      { group_slug: 'diet', category_slug: 'vegan', confidence: 1.0, path: 'diet > Plant-based > Vegan' },
  'vegetarian': { group_slug: 'diet', category_slug: 'vegetarian', confidence: 1.0, path: 'diet > Plant-based > Vegetarian' },
  'gluten-free':{ group_slug: 'diet', category_slug: 'gluten-free', confidence: 1.0, path: 'diet > Allergen-free > Gluten-free' },
  'keto':       { group_slug: 'diet', category_slug: 'keto', confidence: 1.0, path: 'diet > Lifestyle diets > Keto' },
  'italian':    { group_slug: 'cuisine', category_slug: 'italian-regions', confidence: 0.9, path: 'cuisine > Italian regions' },
  'french':     { group_slug: 'cuisine', category_slug: 'french-regions', confidence: 0.9, path: 'cuisine > French regions' },
  'thai':       { group_slug: 'cuisine', category_slug: 'thai', confidence: 1.0, path: 'cuisine > Asian > Thai' },
  'indian':     { group_slug: 'cuisine', category_slug: 'indian', confidence: 1.0, path: 'cuisine > Asian > Indian' },
  'japanese':   { group_slug: 'cuisine', category_slug: 'japanese', confidence: 1.0, path: 'cuisine > Asian > Japanese' },
  'chinese':    { group_slug: 'cuisine', category_slug: 'chinese', confidence: 1.0, path: 'cuisine > Asian > Chinese' },
  'korean':     { group_slug: 'cuisine', category_slug: 'korean', confidence: 1.0, path: 'cuisine > Asian > Korean' },
  'mexican':    { group_slug: 'cuisine', category_slug: 'mexican', confidence: 1.0, path: 'cuisine > The Americas > Mexican' },
  'greek':      { group_slug: 'cuisine', category_slug: 'greek', confidence: 1.0, path: 'cuisine > Mediterranean > Greek' },
  'turkish':    { group_slug: 'cuisine', category_slug: 'turkish', confidence: 1.0, path: 'cuisine > Mediterranean > Turkish' },
  'lebanese':   { group_slug: 'cuisine', category_slug: 'lebanese', confidence: 1.0, path: 'cuisine > Mediterranean > Lebanese' },
  'moroccan':   { group_slug: 'cuisine', category_slug: 'moroccan', confidence: 1.0, path: 'cuisine > Mediterranean > Moroccan' },
  'nice':       { group_slug: 'cuisine', category_slug: 'nice-cote-dazur', confidence: 0.85, path: 'cuisine > French regions > Nice & Côte d\'Azur' },
  'spring':     { group_slug: 'season', category_slug: 'spring', confidence: 1.0, path: 'season > Spring' },
  'summer':     { group_slug: 'season', category_slug: 'summer', confidence: 1.0, path: 'season > Summer' },
  'autumn':     { group_slug: 'season', category_slug: 'autumn', confidence: 1.0, path: 'season > Autumn' },
  'winter':     { group_slug: 'season', category_slug: 'winter', confidence: 1.0, path: 'season > Winter' },
  'bbq':        { group_slug: 'occasion', category_slug: 'bbq', confidence: 1.0, path: 'occasion > Al fresco > BBQ' },
  'christmas':  { group_slug: 'occasion', category_slug: 'christmas', confidence: 1.0, path: 'occasion > Celebrations > Christmas' },
};

// Folder names that are too generic to match
const SKIP_FOLDERS = new Set([
  'recipes', 'cooking', 'food', 'bookmarks', 'saved', 'favorites',
  'favourites', 'to try', 'to cook', 'cooking methods', 'misc',
  'other', 'uncategorized', 'general', 'bookmark bar', 'imported',
]);

/**
 * Match a bookmark folder name to the nearest category.
 * Uses static lookup first, then Claude for fuzzy matches.
 */
export async function matchFolderToCategory(
  folderName: string,
): Promise<CategoryMatch> {
  const normalized = folderName.trim().toLowerCase();
  const noMatch: CategoryMatch = { group_slug: null, category_slug: null, confidence: 0, path: null };

  // Skip obviously generic folders
  if (SKIP_FOLDERS.has(normalized)) return noMatch;

  // Try exact static match
  if (EXACT_MATCHES[normalized]) return EXACT_MATCHES[normalized];

  // Call Claude for fuzzy matching
  const prompt = `${MATCH_PROMPT}\n\nFolder name: "${folderName}"`;
  try {
    const text = await callClaude({ prompt, maxTokens: 200 });
    const result = extractJSON<CategoryMatch>(text);
    if (result.confidence < 0.4) return noMatch;
    return result;
  } catch {
    return noMatch;
  }
}

/**
 * Batch-match multiple folder names. Deduplicates to minimize API calls.
 */
export async function matchFoldersToCategories(
  folderNames: string[],
): Promise<Map<string, CategoryMatch>> {
  const unique = [...new Set(folderNames.filter(Boolean))];
  const results = new Map<string, CategoryMatch>();

  for (const folder of unique) {
    results.set(folder, await matchFolderToCategory(folder));
  }

  return results;
}
