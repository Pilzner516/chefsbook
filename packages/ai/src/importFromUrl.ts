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
  "source_type": "url"
}

Rules:
- Extract ONLY recipe content, ignore ads, navigation, comments, and other page clutter
- Normalize ingredient names consistently
- Preserve group labels like "For the sauce:" or "Dough:"
- Temperatures: preserve original units (°F or °C)
- If the page contains multiple recipes, extract only the primary/featured one
- Use null for any field not found
- For "course": if the recipe primarily produces a bread product (loaves, rolls, buns, baguettes, focaccia, naan, pretzels, pizza dough, sourdough, tortillas, pita, muffins, waffles, pancakes, biscuits, crumpets), always use "bread" — never "side", "main", or "other" for these. Use "dessert" for cakes, cookies, pastries, sweet pies. Use "other" only as a last resort.`;

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
): Promise<ScannedRecipe> {
  const prompt = `${IMPORT_PROMPT}\n\nSource URL: ${sourceUrl}\n\nPage content:\n${pageText.slice(0, 8000)}`;
  const text = await callClaude({ prompt, maxTokens: 3000 });
  return extractJSON<ScannedRecipe>(text);
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
