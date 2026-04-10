import { callClaude, extractJSON, HAIKU } from './client';
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

// --- Stage tracking for pipeline ---
type PipelineStage = 'json-ld' | 'json-ld+claude' | 'claude' | 'microdata' | 'plugin' | 'generic-dom' | 'vision' | 'text-extraction' | 'partial';

interface PipelinePartial {
  title?: string | null;
  description?: string | null;
  servings?: number | null;
  prep_minutes?: number | null;
  cook_minutes?: number | null;
  cuisine?: string | null;
  course?: string | null;
  ingredients?: ScannedRecipe['ingredients'];
  steps?: ScannedRecipe['steps'];
  notes?: string | null;
  source_author?: string | null;
  stage?: PipelineStage;
}

function isComplete(p: PipelinePartial): boolean {
  return !!(p.title?.trim() && p.ingredients?.length && p.steps?.length);
}

function mergePartials(base: PipelinePartial, next: PipelinePartial): PipelinePartial {
  return {
    title: base.title || next.title,
    description: base.description || next.description,
    servings: base.servings ?? next.servings,
    prep_minutes: base.prep_minutes ?? next.prep_minutes,
    cook_minutes: base.cook_minutes ?? next.cook_minutes,
    cuisine: base.cuisine || next.cuisine,
    course: base.course || next.course,
    ingredients: base.ingredients?.length ? base.ingredients : next.ingredients,
    steps: base.steps?.length ? base.steps : next.steps,
    notes: base.notes || next.notes,
    source_author: base.source_author || next.source_author,
    stage: next.stage,
  };
}

function partialToScanned(p: PipelinePartial): ScannedRecipe {
  return {
    title: p.title ?? 'Untitled Recipe',
    description: p.description ?? null,
    servings: p.servings ?? null,
    prep_minutes: p.prep_minutes ?? null,
    cook_minutes: p.cook_minutes ?? null,
    cuisine: p.cuisine ?? null,
    course: (p.course as any) ?? null,
    ingredients: p.ingredients ?? [],
    steps: p.steps ?? [],
    notes: p.notes ?? null,
    source_type: 'url',
  };
}

function getMissingSections(p: PipelinePartial): string[] {
  const missing: string[] = [];
  if (!p.title?.trim()) missing.push('title');
  if (!p.ingredients?.length) missing.push('ingredients');
  if (!p.steps?.length) missing.push('steps');
  if (!p.servings) missing.push('servings');
  return missing;
}

// ===================================================================
// STAGE 1 — JSON-LD structured data
// ===================================================================

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
 */
export function extractJsonLdRecipe(html: string): Partial<ScannedRecipe> | null {
  const scriptMatch = html.match(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi);
  if (!scriptMatch) return null;

  for (const block of scriptMatch) {
    const jsonStr = block.replace(/<\/?script[^>]*>/gi, '').trim();
    try {
      let parsed = JSON.parse(jsonStr);
      if (parsed['@graph']) parsed = parsed['@graph'];
      const items = Array.isArray(parsed) ? parsed : [parsed];
      const recipe = items.find((item: any) =>
        item['@type'] === 'Recipe' ||
        (Array.isArray(item['@type']) && item['@type'].includes('Recipe'))
      );
      if (!recipe) continue;

      const ingredients = (recipe.recipeIngredient ?? []).map((text: string) => {
        const qtyMatch = text.match(/^([\d.\/½⅓⅔¼¾⅛]+)\s*/);
        const quantity = qtyMatch
          ? parseFloat(qtyMatch[1].replace('½', '.5').replace('¼', '.25').replace('¾', '.75').replace('⅓', '.33').replace('⅔', '.67').replace('⅛', '.125')) || null
          : null;
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
      const author = typeof recipe.author === 'string'
        ? recipe.author
        : recipe.author?.name ?? null;

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

// ===================================================================
// STAGE 2 — Microdata (schema.org)
// ===================================================================

function extractMicrodata(html: string): PipelinePartial | null {
  const hasItemtype = html.includes('itemtype="http://schema.org/Recipe"') ||
                      html.includes('itemtype="https://schema.org/Recipe"');
  if (!hasItemtype) return null;

  // Extract itemprop values with regex (no DOM parser in Node without extra deps)
  const getItemprop = (prop: string): string | null => {
    const contentMatch = html.match(new RegExp(`itemprop=["']${prop}["'][^>]*content=["']([^"']+)["']`, 'i'));
    if (contentMatch) return contentMatch[1] ?? null;
    const tagMatch = html.match(new RegExp(`itemprop=["']${prop}["'][^>]*>([^<]+)<`, 'i'));
    return tagMatch?.[1]?.trim() ?? null;
  };

  const getAllItemprop = (prop: string): string[] => {
    const matches: string[] = [];
    const re = new RegExp(`itemprop=["']${prop}["'][^>]*>([^<]+)<`, 'gi');
    let m;
    while ((m = re.exec(html)) !== null) {
      if (m[1]?.trim()) matches.push(m[1].trim());
    }
    return matches;
  };

  const title = getItemprop('name');
  const ingredientTexts = getAllItemprop('recipeIngredient').length
    ? getAllItemprop('recipeIngredient')
    : getAllItemprop('ingredients');

  const stepTexts = getAllItemprop('recipeInstructions').length
    ? getAllItemprop('recipeInstructions')
    : getAllItemprop('step');

  if (!title && !ingredientTexts.length) return null;

  const ingredients = ingredientTexts.map(text => ({
    quantity: null, unit: null, ingredient: text, preparation: null, optional: false, group_label: null,
  }));

  const steps = stepTexts.map((text, i) => ({
    step_number: i + 1, instruction: text, timer_minutes: null, group_label: null,
  }));

  return {
    title, description: getItemprop('description'),
    servings: getItemprop('recipeYield') ? parseInt(getItemprop('recipeYield')!) || null : null,
    prep_minutes: getItemprop('prepTime') ? parseDuration(getItemprop('prepTime')!) : null,
    cook_minutes: getItemprop('cookTime') ? parseDuration(getItemprop('cookTime')!) : null,
    cuisine: getItemprop('recipeCuisine'),
    ingredients, steps, stage: 'microdata',
    source_author: getItemprop('author'),
  };
}

// ===================================================================
// STAGE 3 — Recipe plugin fingerprinting
// ===================================================================

interface PluginDef {
  name: string;
  detect: string; // CSS class/selector string to search for
  ingredientPatterns: string[];
  stepPatterns: string[];
  titlePattern?: string;
}

const RECIPE_PLUGINS: PluginDef[] = [
  { name: 'WP Recipe Maker', detect: 'wprm-recipe-container', ingredientPatterns: ['wprm-recipe-ingredient'], stepPatterns: ['wprm-recipe-instruction'], titlePattern: 'wprm-recipe-name' },
  { name: 'Tasty Recipes', detect: 'tasty-recipes', ingredientPatterns: ['tasty-recipes-ingredients'], stepPatterns: ['tasty-recipes-instructions'] },
  { name: 'Recipe Card Blocks', detect: 'wp-block-recipe-card', ingredientPatterns: ['recipe-card-ingredients'], stepPatterns: ['recipe-card-instructions'] },
  { name: 'Mediavine Create', detect: 'mv-create-card', ingredientPatterns: ['mv-create-ingredients'], stepPatterns: ['mv-create-instructions'] },
  { name: 'ZipList', detect: 'zlrecipe-container', ingredientPatterns: ['zlrecipe-ingredients'], stepPatterns: ['zlrecipe-instructions'] },
];

function extractFromPlugins(html: string): PipelinePartial | null {
  for (const plugin of RECIPE_PLUGINS) {
    if (!html.includes(plugin.detect)) continue;

    const extractByClass = (classNames: string[]): string[] => {
      const results: string[] = [];
      for (const cls of classNames) {
        const re = new RegExp(`class=["'][^"']*${cls}[^"']*["'][^>]*>([^<]+)<`, 'gi');
        let m;
        while ((m = re.exec(html)) !== null) {
          if (m[1]?.trim()) results.push(m[1].trim());
        }
      }
      return results;
    };

    const ingredientTexts = extractByClass(plugin.ingredientPatterns);
    const stepTexts = extractByClass(plugin.stepPatterns);

    let title: string | null = null;
    if (plugin.titlePattern) {
      const titleMatch = html.match(new RegExp(`class=["'][^"']*${plugin.titlePattern}[^"']*["'][^>]*>([^<]+)<`, 'i'));
      title = titleMatch?.[1]?.trim() ?? null;
    }

    if (!ingredientTexts.length && !stepTexts.length) continue;

    return {
      title,
      ingredients: ingredientTexts.map(text => ({
        quantity: null, unit: null, ingredient: text, preparation: null, optional: false, group_label: null,
      })),
      steps: stepTexts.map((text, i) => ({
        step_number: i + 1, instruction: text, timer_minutes: null, group_label: null,
      })),
      stage: 'plugin',
    };
  }
  return null;
}

// ===================================================================
// STAGE 4 — Generic DOM scraping
// ===================================================================

function extractGenericDOM(html: string): PipelinePartial | null {
  const extractBySelectors = (patterns: string[]): string[] => {
    const results: string[] = [];
    for (const pat of patterns) {
      const re = new RegExp(`class=["'][^"']*${pat}[^"']*["'][^>]*>([\\s\\S]*?)</`, 'gi');
      let m;
      while ((m = re.exec(html)) !== null) {
        const text = m[1]?.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
        if (text && text.length > 2) results.push(text);
      }
    }
    return results;
  };

  const ingredientTexts = extractBySelectors([
    'ingredient', 'recipe-ingredient', 'ingredient-list',
  ]);
  const stepTexts = extractBySelectors([
    'instruction', 'direction', 'recipe-step', 'preparation-step',
  ]);

  // Try to get title from h1
  const h1Match = html.match(/<h1[^>]*>([^<]+)</i);
  const title = h1Match?.[1]?.trim() ?? null;

  if (!ingredientTexts.length && !stepTexts.length && !title) return null;

  return {
    title,
    ingredients: ingredientTexts.map(text => ({
      quantity: null, unit: null, ingredient: text, preparation: null, optional: false, group_label: null,
    })),
    steps: stepTexts.map((text, i) => ({
      step_number: i + 1, instruction: text, timer_minutes: null, group_label: null,
    })),
    stage: 'generic-dom',
  };
}

// ===================================================================
// STAGE 6 — Full page text extraction (Claude)
// ===================================================================

async function extractViaClaudeText(
  pageText: string,
  sourceUrl: string,
  existing: PipelinePartial,
): Promise<PipelinePartial> {
  const missingFields = getMissingSections(existing);
  let prompt: string;

  if (existing.title || existing.ingredients?.length) {
    // Gap-fill mode
    const available = Object.entries(existing)
      .filter(([k, v]) => v != null && k !== 'stage')
      .map(([k]) => k);
    prompt = `You are a recipe extraction expert. A recipe page was partially parsed.

Available fields: ${available.join(', ')}
Missing fields to extract: ${missingFields.join(', ')}

Partial data already extracted:
${JSON.stringify(existing, null, 2)}

Extract ONLY the missing fields from the page content below. Return the COMPLETE recipe JSON (merge what was provided with what you extract).

${IMPORT_PROMPT.split('Return ONLY a JSON object')[1]?.split('Rules:')[0] ?? ''}

Source URL: ${sourceUrl}

Page content:
${pageText.slice(0, 25000)}`;
  } else {
    prompt = `${IMPORT_PROMPT}\n\nSource URL: ${sourceUrl}\n\nPage content:\n${pageText.slice(0, 25000)}`;
  }

  const text = await callClaude({ prompt, maxTokens: 3000 });
  const recipe = extractJSON<ScannedRecipe>(text);
  return { ...recipe, stage: 'text-extraction' };
}

// ===================================================================
// Pipeline orchestrator
// ===================================================================

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
 * Classify whether a page is a recipe.
 */
export async function classifyPage(
  html: string,
): Promise<RecipeClassification> {
  if (hasRecipeSchema(html)) {
    return { is_recipe: true, confidence: 1.0, reason: 'schema.org/Recipe markup detected' };
  }

  const plainText = stripHtml(html).slice(0, 500);
  if (plainText.length < 20) {
    return { is_recipe: false, confidence: 0.9, reason: 'Page has no meaningful text content' };
  }

  const prompt = `${CLASSIFY_PROMPT}\n\nPage text (first 500 chars):\n${plainText}`;
  const text = await callClaude({ prompt, maxTokens: 200, model: HAIKU });
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
 * Check if a JSON-LD extraction is complete enough to skip Claude.
 */
export function checkJsonLdCompleteness(jsonLd: Partial<ScannedRecipe> | null): {
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

export interface ImportCompleteness {
  source: PipelineStage;
  complete: boolean;
  missing_fields: string[];
}

/**
 * Run the import from pre-fetched HTML/text.
 * Gap-fill variant preserved for backward compatibility.
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

export type ImportResult =
  | { ok: true; recipe: ScannedRecipe; import_status: 'complete' | 'partial'; missing_sections: string[]; source_author: string | null; pipeline_stage: PipelineStage }
  | { ok: false; reason: 'not_recipe'; classification: RecipeClassification }
  | { ok: false; reason: 'fetch_error'; error: string };

/**
 * Full waterfall import pipeline.
 * Tries each extraction method in order, stops when complete.
 * Returns partial results with missing_sections if no stage fully succeeds.
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

  let partial: PipelinePartial = {};

  // STAGE 1 — JSON-LD
  const jsonLd = extractJsonLdRecipe(html);
  if (jsonLd) {
    partial = { ...jsonLd, stage: 'json-ld' };
    // Extract author from JSON-LD
    const authorMatch = html.match(/"author"\s*:\s*\{\s*"@type"\s*:\s*"Person"\s*,\s*"name"\s*:\s*"([^"]+)"/);
    if (authorMatch) partial.source_author = authorMatch[1] ?? null;
    if (isComplete(partial)) {
      return {
        ok: true,
        recipe: partialToScanned(partial),
        import_status: 'complete',
        missing_sections: [],
        source_author: partial.source_author ?? null,
        pipeline_stage: 'json-ld',
      };
    }
  }

  // STAGE 2 — Microdata
  const microdata = extractMicrodata(html);
  if (microdata) {
    partial = mergePartials(partial, microdata);
    if (isComplete(partial)) {
      return {
        ok: true,
        recipe: partialToScanned(partial),
        import_status: 'complete',
        missing_sections: [],
        source_author: partial.source_author ?? null,
        pipeline_stage: 'microdata',
      };
    }
  }

  // STAGE 3 — Plugin fingerprinting
  const pluginData = extractFromPlugins(html);
  if (pluginData) {
    partial = mergePartials(partial, pluginData);
    if (isComplete(partial)) {
      return {
        ok: true,
        recipe: partialToScanned(partial),
        import_status: 'complete',
        missing_sections: [],
        source_author: partial.source_author ?? null,
        pipeline_stage: 'plugin',
      };
    }
  }

  // STAGE 4 — Generic DOM scraping
  const domData = extractGenericDOM(html);
  if (domData) {
    partial = mergePartials(partial, domData);
    if (isComplete(partial)) {
      return {
        ok: true,
        recipe: partialToScanned(partial),
        import_status: 'complete',
        missing_sections: [],
        source_author: partial.source_author ?? null,
        pipeline_stage: 'generic-dom',
      };
    }
  }

  // STAGE 5 — Vision skipped (requires puppeteer, handled by web API route)

  // STAGE 6 — Full page text extraction via Claude
  const plainText = stripHtml(html);
  try {
    const claudeData = await extractViaClaudeText(plainText, url, partial);
    partial = mergePartials(partial, claudeData);
    if (isComplete(partial)) {
      return {
        ok: true,
        recipe: partialToScanned(partial),
        import_status: 'complete',
        missing_sections: [],
        source_author: partial.source_author ?? null,
        pipeline_stage: 'text-extraction',
      };
    }
  } catch {
    // Claude failed — continue to partial
  }

  // STAGE 7 — Partial import with missing section flags
  const missing = getMissingSections(partial);
  return {
    ok: true,
    recipe: partialToScanned(partial),
    import_status: missing.length > 0 ? 'partial' : 'complete',
    missing_sections: missing,
    source_author: partial.source_author ?? null,
    pipeline_stage: 'partial',
  };
}
