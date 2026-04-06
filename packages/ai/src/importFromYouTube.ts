import { callClaude, extractJSON } from './client';

const YOUTUBE_RECIPE_PROMPT = `You are a recipe extraction expert. The user provides a YouTube cooking video's title, description, and transcript.

Extract a structured recipe from this content. Use the video description first (often has a formatted recipe), fill gaps from the transcript.

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
    { "step_number": 1, "instruction": "string", "timer_minutes": "number|null", "group_label": "string|null", "timestamp_seconds": "number|null" }
  ],
  "notes": "string | null",
  "tags": ["string — 5-8 lowercase tags: main protein, cooking method, characteristics, diet flags"],
  "source_type": "youtube"
}

Rules:
- If the video is NOT a cooking/recipe video (vlogs, reviews, compilations, mukbang without recipe), return exactly: null
- Extract timestamp_seconds for each step by matching the step's action to the transcript timeline. The transcript has entries with offset (seconds). Find where in the transcript each step is being demonstrated and use that offset.
- Normalize ingredient names consistently
- Preserve group labels like "For the sauce:" or "Dough:"
- Temperatures: preserve original units (°F or °C)
- For "course": if the recipe primarily produces a bread product, use "bread". Use "other" only as a last resort.
- Use null for any field not found`;

export interface YouTubeRecipeResult {
  title: string;
  description: string | null;
  servings: number | null;
  prep_minutes: number | null;
  cook_minutes: number | null;
  cuisine: string | null;
  course: string | null;
  ingredients: {
    quantity: number | null;
    unit: string | null;
    ingredient: string;
    preparation: string | null;
    optional: boolean;
    group_label: string | null;
  }[];
  steps: {
    step_number: number;
    instruction: string;
    timer_minutes: number | null;
    group_label: string | null;
    timestamp_seconds: number | null;
  }[];
  notes: string | null;
  source_type: 'youtube';
}

/**
 * Extract a recipe from YouTube video content.
 * Returns the recipe or null if the video is not a cooking video.
 */
export async function importFromYouTube(params: {
  videoTitle: string;
  description: string;
  transcript: string;
}): Promise<YouTubeRecipeResult | null> {
  const { videoTitle, description, transcript } = params;

  const content = [
    `Video title: ${videoTitle}`,
    '',
    `Video description:\n${description.slice(0, 4000)}`,
    '',
    `Transcript (with timestamps in seconds):\n${transcript.slice(0, 8000)}`,
  ].join('\n');

  const prompt = `${YOUTUBE_RECIPE_PROMPT}\n\n${content}`;
  const text = await callClaude({ prompt, maxTokens: 3000 });

  // Claude returns "null" for non-recipe videos
  const trimmed = text.trim();
  if (trimmed === 'null' || trimmed === '`null`') return null;

  try {
    return extractJSON<YouTubeRecipeResult>(text);
  } catch {
    return null;
  }
}
