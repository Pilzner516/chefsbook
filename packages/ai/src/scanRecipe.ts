import { callClaude, extractJSON } from './client';
import type { ScannedRecipe } from '@chefsbook/db';

const SCAN_PROMPT = `You are a recipe extraction expert. The user has photographed a recipe — a handwritten card, cookbook page, or printed recipe. Extract every visible detail precisely.

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
  "source_type": "scan",
  "has_food_photo": "boolean",
  "food_photo_region": "top-left|top-right|bottom-left|bottom-right|full-page|null"
}

Rules:
- description: Extract any introductory text, headnote, or preamble before the ingredients. If no description text exists on the page, generate a 1-2 sentence description based on the recipe title, main ingredients, and cooking method. This field must NEVER be null or empty.
- Normalize ingredient names: "AP flour" → "all-purpose flour", "s&p" → list as two separate ingredients
- Preserve group labels like "For the sauce:" or "Dough:" as group_label on those ingredients/steps
- If text is partially obscured or unclear, make your best inference and note it in the notes field
- Temperatures: preserve original units (°F or °C)
- Use null for any field not visible or not applicable

Timer extraction (critical for auto-timer feature):
- Scan each step for ANY time reference: "5 minutes", "1 hour", "30 sec", "2-3 min", "about 10 minutes", "45 min or until golden"
- Convert ALL durations to minutes as an integer for timer_minutes: "1 hour" → 60, "90 seconds" → 2, "2-3 minutes" → 3 (use upper bound)
- Common patterns to detect: "cook for X min", "bake X minutes", "simmer X min", "let rest X minutes", "marinate for X hours", "chill X min", "set aside for X"
- If a step says "until golden" or "until done" with no time, set timer_minutes to null
- If a step has multiple timers ("cook 5 min, then flip and cook 3 more min"), use the total: 8
- Implicit timers: "bring to a boil" → null (no specific time), "let cool 10 minutes" → 10

Food photo detection:
- Identify if the scanned page(s) contain a photograph of the finished dish (not the recipe text, not raw ingredients laid out, but an actual plated/finished food photo).
- Return "has_food_photo": true if found, false otherwise.
- Return "food_photo_region": one of "top-left", "top-right", "bottom-left", "bottom-right", "full-page", or null if not found.

Social media screenshots (Instagram, TikTok, Facebook, Threads, Pinterest, Reddit):
- If this appears to be a screenshot of a social media post, extract any recipe content from BOTH the photo area AND any visible caption / comment / overlay text.
- Treat handles, timestamps, like counts, and UI chrome (header bars, reaction buttons) as noise — ignore them.
- Captions often list ingredients informally ("1 can black beans, 2 cups rice, cumin to taste") and steps as run-on sentences with emoji dividers (🔥, ➡️, •, 1️⃣). Parse these into structured ingredient + step arrays.
- Common social-media cues: "Recipe 👇", "Save this 📌", "Full recipe in caption", "Ingredients:" / "Method:" / "Instructions:" headers, emoji bullets.
- If the caption is truncated ("…more"), extract what is visible and note the truncation in "notes".
- Username and post context: set the username (e.g. "@bon_appetit") as the recipe notes field only if no other notes apply; do not use it as the title.
- For screenshots, set has_food_photo true if the main image clearly shows a finished dish. food_photo_region is typically "full-page" or "top" for social screenshots.`;

export async function scanRecipe(imageBase64: string, mimeType = 'image/jpeg'): Promise<ScannedRecipe> {
  const text = await callClaude({ prompt: SCAN_PROMPT, imageBase64, imageMimeType: mimeType, maxTokens: 3000 });
  return extractJSON<ScannedRecipe>(text);
}

const MULTI_PAGE_PROMPT = `You are a recipe extraction expert. The user has photographed multiple pages of a single recipe. These images are consecutive pages — treat them as one recipe and extract all information into a unified result.

${SCAN_PROMPT.replace('You are a recipe extraction expert. The user has photographed a recipe — a handwritten card, cookbook page, or printed recipe. Extract every visible detail precisely.\n\n', '')}`;

/**
 * Scan multiple pages of a single recipe in one Claude Vision call.
 * Up to 5 pages supported.
 */
export async function scanRecipeMultiPage(
  pages: { base64: string; mimeType?: string }[],
): Promise<ScannedRecipe> {
  if (pages.length === 0) throw new Error('No pages to scan');
  if (pages.length === 1) return scanRecipe(pages[0].base64, pages[0].mimeType);
  const text = await callClaude({
    prompt: MULTI_PAGE_PROMPT,
    images: pages,
    maxTokens: 4000,
  });
  return extractJSON<ScannedRecipe>(text);
}
