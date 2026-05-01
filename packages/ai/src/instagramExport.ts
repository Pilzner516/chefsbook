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
