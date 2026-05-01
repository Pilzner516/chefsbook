/**
 * Instagram Export Import — AI functions for processing local Instagram data export ZIPs
 *
 * IMPORTANT: This is DIFFERENT from instagramImport.ts (deprecated session 138, scraping).
 * This file processes LOCAL ZIP data uploaded by the user — no scraping, no network calls.
 *
 * @chefsbook/ai
 */

import { callClaude, extractJSON, consumeLastUsage } from './client';

const HAIKU = 'claude-haiku-4-5';
const SONNET = 'claude-sonnet-4-20250514';

export interface ExtractedCaption {
  title: string | null;
  cuisine: string | null;
  tags: string[];
  notes: string | null;
}

export interface ClassifyFoodResult {
  isFood: boolean;
  tokensIn?: number;
  tokensOut?: number;
}

export interface ExtractCaptionResult {
  extracted: ExtractedCaption;
  tokensIn?: number;
  tokensOut?: number;
}

/**
 * Classify whether an image is food-related using Claude Haiku Vision.
 * Model: HAIKU
 * Cost: ~$0.001/image
 * logAiCall action: 'instagram_food_classify' (caller logs)
 *
 * @param imageBase64 - JPEG/PNG blob as base64 string
 * @returns { isFood, tokensIn, tokensOut } for caller to log
 */
export async function classifyFoodImage(imageBase64: string): Promise<ClassifyFoodResult> {
  try {
    const response = await callClaude({
      prompt: 'Is this a food or recipe photo? Respond with only the word YES or NO.',
      imageBase64,
      imageMimeType: 'image/jpeg',
      maxTokens: 10,
      model: HAIKU,
    });

    const usage = consumeLastUsage();
    const answer = response.trim().toUpperCase();
    const isFood = answer.startsWith('YES');

    return {
      isFood,
      tokensIn: usage?.inputTokens,
      tokensOut: usage?.outputTokens,
    };
  } catch (error) {
    console.error('[classifyFoodImage] Error:', error);
    return { isFood: false };
  }
}

/**
 * Extract recipe metadata from an Instagram caption.
 * Model: HAIKU (text only)
 * Cost: ~$0.0002/call
 * logAiCall action: 'instagram_caption_extract' (caller logs)
 *
 * Always stores the full raw caption in notes — never discards it.
 *
 * @param caption - Raw caption text from Instagram post
 * @returns { extracted, tokensIn, tokensOut } for caller to log
 */
export async function extractInstagramExportCaption(
  caption: string,
): Promise<ExtractCaptionResult> {
  const prompt = `Extract recipe metadata from this Instagram caption. Return JSON only:
{
  "title": "short recipe title if obvious, or null",
  "cuisine": "cuisine type if mentioned (e.g. 'Italian', 'Mexican'), or null",
  "tags": ["array", "of", "relevant", "hashtags", "as", "plain", "words"],
  "notes": "the full original caption text"
}

Rules:
- title should be a short, clear dish name if the caption makes it obvious (e.g. "Homemade pasta" → "Homemade Pasta")
- If the caption is just hashtags or emojis with no clear dish name, set title to null
- Extract hashtags as plain lowercase words (remove #)
- Limit to 5 most relevant food/recipe tags
- Always include the full caption in notes

Caption:
${caption.slice(0, 1500)}`;

  try {
    const response = await callClaude({
      prompt,
      maxTokens: 500,
      model: HAIKU,
    });

    const usage = consumeLastUsage();
    const result = extractJSON<ExtractedCaption>(response);

    return {
      extracted: {
        title: result.title ?? null,
        cuisine: result.cuisine ?? null,
        tags: Array.isArray(result.tags) ? result.tags.slice(0, 5) : [],
        notes: caption || null,
      },
      tokensIn: usage?.inputTokens,
      tokensOut: usage?.outputTokens,
    };
  } catch (error) {
    console.error('[extractInstagramExportCaption] Error:', error);
    return {
      extracted: {
        title: null,
        cuisine: null,
        tags: [],
        notes: caption || null,
      },
    };
  }
}

// ── Instagram Recipe Completion (Sonnet Vision) ──────────────────────────

export interface CompletedRecipeData {
  description: string;
  cuisine: string | null;
  ingredients: Array<{
    name: string;
    amount: string | null;
    unit: string | null;
  }>;
  steps: Array<{
    instruction: string;
  }>;
}

export interface CompleteInstagramRecipeResult {
  success: boolean;
  data: CompletedRecipeData | null;
  tokensIn?: number;
  tokensOut?: number;
  error?: string;
}

/**
 * Complete an Instagram recipe using Claude Sonnet Vision.
 * Uses the recipe's hero image + caption notes to generate ingredients and steps.
 *
 * Model: SONNET (vision — needs quality + image understanding)
 * Cost: ~$0.015 per recipe
 * logAiCall action: 'instagram_recipe_complete' (caller logs)
 *
 * @param params.title - Recipe title
 * @param params.notes - Caption/notes from Instagram post
 * @param params.imageBase64 - Hero image as base64 string
 * @returns { success, data, tokensIn, tokensOut, error }
 */
export async function completeInstagramRecipe(params: {
  title: string;
  notes: string | null;
  imageBase64: string;
}): Promise<CompleteInstagramRecipeResult> {
  const { title, notes, imageBase64 } = params;

  const prompt = `You are a culinary expert. Analyze this food image and caption to generate a complete recipe.

Recipe Title: ${title}

Caption/Notes:
${notes?.slice(0, 2000) || '(No caption provided)'}

Instructions:
1. Study the image carefully to identify visible ingredients and the dish type
2. Use any ingredient or technique hints from the caption
3. Generate realistic quantities (not just ingredient names)
4. Generate clear, numbered cooking steps
5. If the caption is only hashtags, rely primarily on the image

Return ONLY a valid JSON object with this exact structure:
{
  "description": "1-2 sentence description of the dish",
  "cuisine": "cuisine type (e.g. Italian, Mexican) or null if unclear",
  "ingredients": [
    { "name": "ingredient name", "amount": "quantity like 2 or 1/2", "unit": "cup, tbsp, g, etc or null" }
  ],
  "steps": [
    { "instruction": "Full step instruction text" }
  ]
}

Requirements:
- Minimum 3 ingredients
- Minimum 2 steps
- Each ingredient must have a name; amount and unit can be null if visual estimate is impossible
- Steps should be practical and follow a logical cooking order
- If the dish cannot be identified at all, return null instead of a JSON object

Return JSON only — no markdown, no preamble, no explanation.`;

  try {
    const response = await callClaude({
      prompt,
      imageBase64,
      imageMimeType: 'image/jpeg',
      maxTokens: 2000,
      model: SONNET,
    });

    const usage = consumeLastUsage();

    // Handle null response (dish unidentifiable)
    const trimmed = response.trim();
    if (trimmed.toLowerCase() === 'null') {
      return {
        success: false,
        data: null,
        tokensIn: usage?.inputTokens,
        tokensOut: usage?.outputTokens,
        error: 'Could not identify the dish from the image',
      };
    }

    const data = extractJSON<CompletedRecipeData>(response);

    // Validate minimum requirements
    if (!data.ingredients || data.ingredients.length < 3) {
      return {
        success: false,
        data: null,
        tokensIn: usage?.inputTokens,
        tokensOut: usage?.outputTokens,
        error: 'Insufficient ingredients generated',
      };
    }

    if (!data.steps || data.steps.length < 2) {
      return {
        success: false,
        data: null,
        tokensIn: usage?.inputTokens,
        tokensOut: usage?.outputTokens,
        error: 'Insufficient steps generated',
      };
    }

    return {
      success: true,
      data: {
        description: data.description || `A delicious ${title}`,
        cuisine: data.cuisine || null,
        ingredients: data.ingredients.map((ing, idx) => ({
          name: ing.name || `Ingredient ${idx + 1}`,
          amount: ing.amount || null,
          unit: ing.unit || null,
        })),
        steps: data.steps.map((step) => ({
          instruction: step.instruction || '',
        })),
      },
      tokensIn: usage?.inputTokens,
      tokensOut: usage?.outputTokens,
    };
  } catch (error: any) {
    console.error('[completeInstagramRecipe] Error:', error);
    return {
      success: false,
      data: null,
      error: error.message || 'Unknown error',
    };
  }
}
