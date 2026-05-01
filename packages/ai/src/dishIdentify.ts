import { callClaude, extractJSON, HAIKU } from './client';
import type { ScannedRecipe } from '@chefsbook/db';

// ── Types ──

export type ClarifyingQuestion = {
  question: string;
  options: string[];
};

export type ScanImageAnalysis = {
  type: 'recipe_document' | 'dish_photo' | 'restaurant_menu' | 'unclear';
  dish_name?: string | null;
  dish_confidence: 'high' | 'medium' | 'low';
  clarifying_questions?: ClarifyingQuestion[];
  dish_options?: string[];
  cuisine_guess?: string | null;
  restaurant_name?: string | null;
};

// ── Analyse image: document vs dish vs unclear ──

const ANALYSE_PROMPT = `Analyse this image carefully.

Determine the content type:
1. RECIPE_DOCUMENT: Printed or handwritten text with a single recipe (ingredients and steps)
2. RESTAURANT_MENU: A restaurant menu, specials board, prix fixe card, or set menu showing multiple dish listings organised by section (starters, mains, desserts, etc.)
3. DISH_PHOTO: A photograph of a prepared dish/food
4. UNCLEAR: Cannot determine (blurry, unrelated content)

For RECIPE_DOCUMENT: { "type": "recipe_document", "dish_confidence": "high" }

For RESTAURANT_MENU:
- Return { "type": "restaurant_menu", "dish_confidence": "high" }
- Extract the restaurant name if visible in header/footer/logo
- Recognise these as restaurant menus:
  - Multi-dish listings with prices
  - Specials boards (daily/weekly specials)
  - Printed menus with section headers (Starters, Mains, Desserts, etc.)
  - Handwritten menu boards
  - Prix fixe / set menu cards
  - Tasting menus

For DISH_PHOTO:
- Identify the dish as specifically as possible
- Rate confidence: high (very certain), medium (fairly sure), low (unsure)
- If confidence is medium/low, provide up to 3 clarifying questions with 2-4 options each
- List up to 3 dish name options if still unsure
- Include a cuisine guess if visible

For UNCLEAR: { "type": "unclear", "dish_confidence": "low" }

Return ONLY a JSON object, no markdown:
{
  "type": "recipe_document" | "dish_photo" | "restaurant_menu" | "unclear",
  "dish_name": "string or null",
  "dish_confidence": "high" | "medium" | "low",
  "cuisine_guess": "string or null",
  "restaurant_name": "string or null",
  "clarifying_questions": [{ "question": "string", "options": ["string"] }],
  "dish_options": ["string"]
}`;

export async function analyseScannedImage(
  imageBase64: string,
  mimeType = 'image/jpeg',
): Promise<ScanImageAnalysis> {
  const text = await callClaude({
    prompt: ANALYSE_PROMPT,
    imageBase64,
    imageMimeType: mimeType,
    maxTokens: 1000,
    model: HAIKU,
  });
  return extractJSON<ScanImageAnalysis>(text);
}

// ── Re-analyse with user answers + cuisine hint ──

export async function reanalyseDish(
  imageBase64: string,
  answers: { question: string; answer: string }[],
  cuisineHint?: string,
  mimeType = 'image/jpeg',
): Promise<ScanImageAnalysis> {
  const answerBlock = answers
    .map((a) => `Q: ${a.question}\nA: ${a.answer}`)
    .join('\n');

  const prompt = `Analyse this dish photo. The user has provided additional context:

${cuisineHint ? `The user indicates this is ${cuisineHint} cuisine.\n` : ''}${answerBlock ? `User answers:\n${answerBlock}\n` : ''}
Based on the image and the above context, identify the dish as specifically as possible.

Return ONLY a JSON object:
{
  "type": "dish_photo",
  "dish_name": "string",
  "dish_confidence": "high" | "medium" | "low",
  "cuisine_guess": "string or null",
  "clarifying_questions": [],
  "dish_options": ["up to 3 options if still unsure"]
}`;

  const text = await callClaude({
    prompt,
    imageBase64,
    imageMimeType: mimeType,
    maxTokens: 1000,
    model: HAIKU,
  });
  return extractJSON<ScanImageAnalysis>(text);
}

// ── Generate a full recipe from identified dish ──

const GENERATE_PROMPT = `You are a professional chef. Generate a complete, authentic recipe for the dish shown in this photo.

Dish name: {{dishName}}
{{cuisineHint}}
{{contextBlock}}

Create a detailed, home-cook-friendly recipe. Return ONLY a JSON object:
{
  "title": "string",
  "description": "A 1-2 sentence description of the dish",
  "servings": 4,
  "prep_minutes": number,
  "cook_minutes": number,
  "cuisine": "string",
  "course": "breakfast|brunch|lunch|dinner|starter|main|side|dessert|snack|drink|bread|other",
  "ingredients": [
    { "quantity": number|null, "unit": "string|null", "ingredient": "string", "preparation": "string|null", "optional": false, "group_label": "string|null" }
  ],
  "steps": [
    { "step_number": 1, "instruction": "string", "timer_minutes": number|null, "group_label": "string|null" }
  ],
  "notes": "string|null",
  "tags": ["lowercase-tag"],
  "source_type": "ai"
}

Rules:
- Make the recipe authentic to the dish and cuisine
- Include prep and cook times
- Use standard ingredient measurements
- Extract timer_minutes from each step that mentions a time duration
- Group ingredients/steps when the recipe has distinct components (e.g. "For the sauce:")
- tags: 3-6 lowercase, hyphen-separated tags describing the recipe (cuisine, main ingredient, cooking method, dietary flags if applicable). Always include at least one tag. Examples: ["italian","pasta","one-pot"], ["vegan","salad","quick"]`;

export async function generateDishRecipe(params: {
  imageBase64: string;
  mimeType?: string;
  dishName: string;
  cuisine?: string;
  userAnswers?: { question: string; answer: string }[];
}): Promise<ScannedRecipe> {
  const { imageBase64, mimeType = 'image/jpeg', dishName, cuisine, userAnswers } = params;

  const contextLines: string[] = [];
  if (userAnswers?.length) {
    contextLines.push('Additional context from the user:');
    for (const a of userAnswers) {
      contextLines.push(`- ${a.question}: ${a.answer}`);
    }
  }

  const prompt = GENERATE_PROMPT
    .replace('{{dishName}}', dishName)
    .replace('{{cuisineHint}}', cuisine ? `Cuisine: ${cuisine}` : '')
    .replace('{{contextBlock}}', contextLines.join('\n'));

  const text = await callClaude({
    prompt,
    imageBase64,
    imageMimeType: mimeType,
    maxTokens: 4000,
  });
  return extractJSON<ScannedRecipe>(text);
}
