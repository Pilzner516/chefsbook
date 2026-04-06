import { importFromUrl, stripHtml, extractJsonLdRecipe, checkJsonLdCompleteness, callClaude, extractJSON } from '@chefsbook/ai';
import { fetchWithFallback } from '../../import/_utils';

const RECIPE_SITES = [
  'seriouseats.com',
  'food52.com',
  'kingarthurbaking.com',
  'theperfectloaf.com',
  'nytcooking.com',
  'allrecipes.com',
  'epicurious.com',
  'bonappetit.com',
  'simplyrecipes.com',
];

/**
 * Try to find a recipe URL by searching common recipe sites.
 * Uses DuckDuckGo Instant Answer API (no key needed) as a search proxy.
 */
async function searchForRecipeUrl(query: string): Promise<string | null> {
  // Try DuckDuckGo HTML search (lite version, parseable)
  try {
    const res = await fetch(`https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
      signal: AbortSignal.timeout(10000),
    });
    if (res.ok) {
      const html = await res.text();
      // Extract URLs from results
      const urlMatches = html.match(/https?:\/\/[^\s"<>]+/g) ?? [];
      // Find first URL from a known recipe site
      for (const url of urlMatches) {
        for (const site of RECIPE_SITES) {
          if (url.includes(site) && (url.includes('recipe') || url.includes('/r/'))) {
            return url.split('&')[0]!; // Strip tracking params
          }
        }
      }
      // If no recipe site found, return first non-duckduckgo URL that looks like a recipe
      for (const url of urlMatches) {
        if (!url.includes('duckduckgo') && !url.includes('google') && url.includes('recipe')) {
          return url.split('&')[0]!;
        }
      }
    }
  } catch {}
  return null;
}

const COOKBOOK_RECIPE_PROMPT = `You are a cookbook recipe recreation expert. Generate the COMPLETE recipe for the dish described below.

This recipe comes from a well-known published cookbook. Generate the most accurate and complete version possible.

CRITICAL RULES:
- Every ingredient MUST have an exact quantity and unit (e.g. "500g bread flour", "10g salt")
- Every step MUST have specific instructions with times and temperatures
- NEVER write placeholder instructions like "follow the recipe" or "refer to the book"
- NEVER omit quantities — if unsure, use standard cookbook proportions
- Include prep time, cook time, and yield
- If this is a bread recipe: include hydration %, fermentation times, oven temperatures, and technique details (autolyse, folding, shaping, proofing)
- For recipes with multiple stages (poolish, preferment, brine, marinade, sauce, dough, filling etc): use group_label to separate ingredients by stage. NEVER flatten multi-stage ingredients into one list. NEVER deduplicate ingredients that appear in different stages — they are intentionally separate amounts for different steps. Example: group_label "Poolish" for poolish ingredients, group_label "Final Dough" for final dough ingredients.

Return ONLY a JSON object:
{
  "title": "string",
  "description": "string",
  "servings": "number",
  "prep_minutes": "number",
  "cook_minutes": "number",
  "cuisine": "string | null",
  "course": "string",
  "ingredients": [{ "quantity": "number", "unit": "string", "ingredient": "string", "preparation": "string|null", "optional": false, "group_label": "string|null" }],
  "steps": [{ "step_number": 1, "instruction": "string with specific details", "timer_minutes": "number|null", "group_label": "string|null" }],
  "notes": "string | null",
  "source_type": "ai"
}

If you cannot generate a complete recipe with real quantities and instructions, return null.`;

export async function POST(req: Request) {
  const { recipeName, cookbookTitle, author, year, description } = await req.json();

  if (!recipeName) return Response.json({ error: 'recipeName required' }, { status: 400 });

  // STEP 1: Search for the actual recipe online
  const searchQuery = `${recipeName} ${cookbookTitle ?? ''} ${author ?? ''} recipe`;
  const recipeUrl = await searchForRecipeUrl(searchQuery);

  if (recipeUrl) {
    try {
      // STEP 2: Import via the full pipeline (JSON-LD first)
      const { html } = await fetchWithFallback(recipeUrl);

      // Try JSON-LD
      const jsonLd = extractJsonLdRecipe(html);
      const { complete } = checkJsonLdCompleteness(jsonLd);

      if (complete && jsonLd) {
        return Response.json({ recipe: { ...jsonLd, source_type: 'url' }, sourceUrl: recipeUrl, method: 'json-ld' });
      }

      // Try Claude extraction
      const text = stripHtml(html).slice(0, 25000);
      if (text.length > 500) {
        const recipe = await importFromUrl(text, recipeUrl);
        if (recipe?.title && recipe?.ingredients?.length > 0) {
          return Response.json({ recipe, sourceUrl: recipeUrl, method: 'claude-web' });
        }
      }
    } catch {}
  }

  // STEP 3: No URL found or import failed — generate with detailed AI prompt
  const context = [
    `Recipe: "${recipeName}"`,
    cookbookTitle ? `Cookbook: "${cookbookTitle}"` : '',
    author ? `Author: ${author}` : '',
    year ? `Published: ${year}` : '',
    description ? `Cookbook description: ${description}` : '',
  ].filter(Boolean).join('\n');

  const prompt = `${COOKBOOK_RECIPE_PROMPT}\n\n${context}`;

  try {
    const text = await callClaude({ prompt, maxTokens: 3000 });
    const trimmed = text.trim();
    if (trimmed === 'null') {
      return Response.json({ recipe: null, method: 'failed' });
    }
    const recipe = extractJSON(text) as any;

    // Validate — reject placeholders
    if (!recipe || !recipe.ingredients?.length || !recipe.steps?.length) {
      return Response.json({ recipe: null, method: 'failed' });
    }
    // Check for placeholder steps
    const hasPlaceholder = recipe.steps.some((s: any) =>
      /follow the (recipe|book)|refer to|see (the )?(cook)?book/i.test(s.instruction ?? '')
    );
    if (hasPlaceholder) {
      return Response.json({ recipe: null, method: 'failed' });
    }
    // Check ingredients have quantities
    const missingQty = recipe.ingredients.filter((i: any) => i.quantity == null).length;
    if (missingQty > recipe.ingredients.length * 0.5) {
      return Response.json({ recipe: null, method: 'failed' });
    }

    return Response.json({ recipe, sourceUrl: null, method: 'claude-generate' });
  } catch {
    return Response.json({ recipe: null, method: 'failed' });
  }
}
