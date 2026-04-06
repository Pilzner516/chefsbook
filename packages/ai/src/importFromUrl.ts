import { callClaude, extractJSON } from './client';
import type { ScannedRecipe } from '@chefsbook/db';

const IMPORT_PROMPT = `You are a recipe extraction expert. The user has provided text content scraped from a recipe webpage. Extract the recipe details precisely.

Return ONLY a JSON object, no markdown, no explanation:
{
  "title": "string",
  "description": "string | null",
  "servings": "number | null",
  "prep_minutes": "number | null",
  "cook_minutes": "number | null",
  "cuisine": "string | null",
  "course": "breakfast|brunch|lunch|dinner|starter|main|side|dessert|snack|drink|bread|other|null",
  "ingredients": [
    { "quantity": "number|null", "unit": "string|null", "ingredient": "string", "preparation": "string|null", "optional": false, "group_label": "string|null" }
  ],
  "steps": [
    { "step_number": 1, "instruction": "string", "timer_minutes": "number|null", "group_label": "string|null" }
  ],
  "notes": "string | null",
  "tags": ["string — 5-8 relevant tags"],
  "source_type": "url"
}

Rules:
- Extract ONLY recipe content, ignore ads, navigation, comments, and other page clutter
- QUANTITIES ARE REQUIRED: Extract every ingredient with its EXACT quantity, unit, and name as written on the page. Never omit the quantity. If a quantity is visible on the page, it must appear in your output. If no quantity exists, use "to taste" or "as needed" — never leave quantity as null when the page shows one.
- Normalize ingredient names consistently
- Preserve group labels like "For the sauce:" or "Dough:" — do not flatten grouped ingredients into one list
- If the page has an "Equipment" or "Tools" section, do NOT include equipment items in the ingredients list — only include actual food ingredients
- Temperatures: preserve original units (°F or °C)
- When quantities show both metric and imperial (e.g. "1 cup (227g)"), include both in the quantity string
- If the page contains multiple recipes, extract only the primary/featured one
- Use null for any field not found
- For "cuisine": detect the most specific cuisine type (e.g. "Italian", "Thai", "Mexican", "French", "American", "Japanese")
- For "course": Waffles/pancakes/eggs/oatmeal→breakfast. Sandwiches/light soups/salads→lunch. Pasta/roasts/stews/curries/heavy proteins→dinner. Lamb/beef roast/whole chicken→dinner. Cakes/cookies/ice cream→dessert. Chips/dips/nuts→snack. Smoothies/cocktails→drink. Rice/potatoes/vegetable sides→side. Appetizers/bruschetta→starter. Breads/rolls/focaccia/biscuits→bread. Use "other" only as a last resort.
- For "tags": include 5-8 lowercase tags covering: main protein (chicken, beef, pork, fish, vegetarian, vegan), cooking method (baked, grilled, fried, slow-cooked, no-knead), key characteristics (quick, one-pot, meal-prep, comfort-food), diet flags (gluten-free, dairy-free, keto) if applicable. All tags must be lowercase.`;

const CLASSIFY_PROMPT = `You are a web page classifier. Determine if this page contains a recipe.

A recipe page must have MOST of these: a dish title, a list of ingredients, and cooking/preparation steps or instructions.

Pages that are NOT recipes: blog posts without a recipe, restaurant menus, product listings, news articles, grocery store pages, nutrition databases, food photography portfolios, cooking equipment reviews.

Return ONLY a JSON object:
{ "is_recipe": true/false, "confidence": 0.0-1.0, "reason": "brief explanation" }`;

export interface RecipeClassification {
  is_recipe: boolean;
  confidence: number;
  reason: string;
}

/**
 * Check if raw HTML contains schema.org/Recipe structured data.
 */
export function hasRecipeSchema(html: string): boolean {
  return (
    html.includes('"@type":"Recipe"') ||
    html.includes('"@type": "Recipe"') ||
    html.includes("'@type':'Recipe'") ||
    html.includes('itemtype="http://schema.org/Recipe"') ||
    html.includes('itemtype="https://schema.org/Recipe"')
  );
}

/**
 * Extract structured recipe data from JSON-LD schema.org markup.
 * Returns partial ScannedRecipe fields or null if not found.
 */
export function extractJsonLdRecipe(html: string): Partial<import('@chefsbook/db').ScannedRecipe> | null {
  const scriptMatch = html.match(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi);
  if (!scriptMatch) return null;

  for (const block of scriptMatch) {
    const jsonStr = block.replace(/<\/?script[^>]*>/gi, '').trim();
    try {
      let parsed = JSON.parse(jsonStr);
      // Handle @graph arrays
      if (parsed['@graph']) parsed = parsed['@graph'];
      const items = Array.isArray(parsed) ? parsed : [parsed];
      const recipe = items.find((item: any) => item['@type'] === 'Recipe' || (Array.isArray(item['@type']) && item['@type'].includes('Recipe')));
      if (!recipe) continue;

      const ingredients = (recipe.recipeIngredient ?? []).map((text: string, i: number) => {
        const qtyMatch = text.match(/^([\d.\/½⅓⅔¼¾⅛]+)\s*/);
        const quantity = qtyMatch ? parseFloat(qtyMatch[1].replace('½', '.5').replace('¼', '.25').replace('¾', '.75').replace('⅓', '.33').replace('⅔', '.67').replace('⅛', '.125')) || null : null;
        const rest = qtyMatch ? text.slice(qtyMatch[0].length).trim() : text.trim();
        const unitMatch = rest.match(/^(tsp|tbsp|tablespoons?|teaspoons?|cups?|oz|ounces?|lb|lbs?|pounds?|g|grams?|kg|ml|L|liters?|litres?|pinch|dash|cloves?|bunch|cans?|slices?|pieces?)\s+/i);
        const unit = unitMatch ? unitMatch[1] : null;
        const ingredient = unitMatch ? rest.slice(unitMatch[0].length).trim() : rest;
        return { quantity, unit, ingredient, preparation: null, optional: false, group_label: null };
      });

      const steps = (recipe.recipeInstructions ?? []).map((step: any, i: number) => ({
        step_number: i + 1,
        instruction: typeof step === 'string' ? step : step.text ?? step.name ?? '',
        timer_minutes: null,
        group_label: null,
      })).filter((s: any) => s.instruction);

      const prepTime = recipe.prepTime ? parseDuration(recipe.prepTime) : null;
      const cookTime = recipe.cookTime ? parseDuration(recipe.cookTime) : null;

      return {
        title: recipe.name ?? null,
        description: recipe.description ?? null,
        servings: recipe.recipeYield ? parseInt(String(recipe.recipeYield)) || null : null,
        prep_minutes: prepTime,
        cook_minutes: cookTime,
        cuisine: recipe.recipeCuisine ?? null,
        course: recipe.recipeCategory?.toLowerCase() ?? null,
        ingredients,
        steps,
        notes: null,
        source_type: 'url',
      };
    } catch {
      continue;
    }
  }
  return null;
}

/** Parse ISO 8601 duration (PT30M, PT1H15M) to minutes */
function parseDuration(iso: string): number | null {
  const match = iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?/);
  if (!match) return null;
  return (parseInt(match[1] ?? '0') * 60) + parseInt(match[2] ?? '0') || null;
}

/**
 * Strip HTML tags, scripts, styles → plain text.
 */
export function stripHtml(html: string): string {
  return html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Classify whether a page is a recipe. Uses schema.org detection first
 * (free), then falls back to Claude for ambiguous pages.
 */
export async function classifyPage(
  html: string,
): Promise<RecipeClassification> {
  // Fast path: schema.org markup is definitive
  if (hasRecipeSchema(html)) {
    return { is_recipe: true, confidence: 1.0, reason: 'schema.org/Recipe markup detected' };
  }

  // Send first 500 chars of plain text to Claude for classification
  const plainText = stripHtml(html).slice(0, 500);
  if (plainText.length < 20) {
    return { is_recipe: false, confidence: 0.9, reason: 'Page has no meaningful text content' };
  }

  const prompt = `${CLASSIFY_PROMPT}\n\nPage text (first 500 chars):\n${plainText}`;
  const text = await callClaude({ prompt, maxTokens: 200 });
  return extractJSON<RecipeClassification>(text);
}

/**
 * Fetch a URL and return the raw HTML.
 */
export async function fetchPage(url: string): Promise<string> {
  const response = await fetch(url, {
    headers: { 'User-Agent': 'Chefsbook/1.0 (recipe importer)' },
    signal: AbortSignal.timeout(15000),
  });
  if (!response.ok) {
    throw new Error(`HTTP ${response.status} fetching ${url}`);
  }
  return response.text();
}

/**
 * Full import pipeline: fetch → classify → extract.
 * Returns the recipe or a classification result for non-recipe pages.
 */
export async function importFromUrl(
  pageText: string,
  sourceUrl: string,
  gapFill?: { available: string[]; missing: string[]; jsonLdData: string },
): Promise<ScannedRecipe> {
  let prompt: string;
  if (gapFill) {
    prompt = `You are a recipe extraction expert. A recipe page has JSON-LD structured data but it is incomplete.

Available from JSON-LD: ${gapFill.available.join(', ')}
Missing fields that you need to extract: ${gapFill.missing.join(', ')}

JSON-LD data:
${gapFill.jsonLdData}

Extract ONLY the missing fields from the page content below. Return the COMPLETE recipe JSON (merge what JSON-LD provided with what you extract).

Return ONLY a JSON object matching this schema:
${IMPORT_PROMPT.split('Return ONLY a JSON object')[1]?.split('Rules:')[0] ?? ''}

Source URL: ${sourceUrl}

Page content:
${pageText.slice(0, 25000)}`;
  } else {
    prompt = `${IMPORT_PROMPT}\n\nSource URL: ${sourceUrl}\n\nPage content:\n${pageText.slice(0, 25000)}`;
  }
  const text = await callClaude({ prompt, maxTokens: 3000 });
  return extractJSON<ScannedRecipe>(text);
}

export interface ImportCompleteness {
  source: 'json-ld' | 'claude' | 'json-ld+claude';
  complete: boolean;
  missing_fields: string[];
}

/**
 * Check if a JSON-LD extraction is complete enough to skip Claude.
 */
export function checkJsonLdCompleteness(jsonLd: Partial<import('@chefsbook/db').ScannedRecipe> | null): {
  complete: boolean;
  available: string[];
  missing: string[];
} {
  if (!jsonLd) return { complete: false, available: [], missing: ['title', 'ingredients', 'steps'] };

  const available: string[] = [];
  const missing: string[] = [];

  if (jsonLd.title?.trim()) available.push('title'); else missing.push('title');
  if (jsonLd.ingredients?.length && jsonLd.ingredients.some((i) => i.quantity != null)) available.push('ingredients'); else missing.push('ingredients');
  if (jsonLd.steps?.length && jsonLd.steps.some((s) => s.instruction?.trim())) available.push('steps'); else missing.push('steps');
  if (jsonLd.description) available.push('description'); else missing.push('description');
  if (jsonLd.servings) available.push('servings'); else missing.push('servings');
  if (jsonLd.prep_minutes) available.push('prep_minutes'); else missing.push('prep_minutes');
  if (jsonLd.cook_minutes) available.push('cook_minutes'); else missing.push('cook_minutes');
  if (jsonLd.cuisine) available.push('cuisine'); else missing.push('cuisine');
  if (jsonLd.course) available.push('course'); else missing.push('course');

  const complete = available.includes('title') && available.includes('ingredients') && available.includes('steps');
  return { complete, available, missing };
}

export type ImportResult =
  | { ok: true; recipe: ScannedRecipe }
  | { ok: false; reason: 'not_recipe'; classification: RecipeClassification }
  | { ok: false; reason: 'fetch_error'; error: string };

/**
 * End-to-end: fetch URL → classify → extract recipe.
 * Handles non-recipe pages and fetch errors gracefully.
 */
export async function importUrlFull(url: string): Promise<ImportResult> {
  let html: string;
  try {
    html = await fetchPage(url);
  } catch (e: any) {
    return { ok: false, reason: 'fetch_error', error: e.message };
  }

  const classification = await classifyPage(html);
  if (!classification.is_recipe) {
    return { ok: false, reason: 'not_recipe', classification };
  }

  const plainText = stripHtml(html);
  const recipe = await importFromUrl(plainText, url);
  return { ok: true, recipe };
}
