import { callClaude, extractJSON } from './client';
import type { ScannedRecipe } from '@chefsbook/db';

const VOICE_PROMPT = `Convert this spoken recipe into a structured recipe format.
The speaker may have been informal or incomplete — be generous in interpretation and fill in reasonable gaps.

Return ONLY a JSON object:
{
  "title": "string",
  "description": "string | null (1-2 sentence summary)",
  "servings": "number | null (default 4 if not mentioned)",
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
  "tags": ["string — 5-8 lowercase tags: main protein, cooking method, key characteristics, diet flags"],
  "source_type": "manual"
}

For cuisine: detect the most specific cuisine type.
For course: waffles/pancakes/eggs→breakfast, sandwiches/salads→lunch, pasta/roasts/stews→dinner, cakes/cookies→dessert, breads/rolls→bread. Use "other" only as last resort.
For tags: include main protein (chicken, beef, vegetarian etc), cooking method (baked, grilled, no-knead), characteristics (quick, one-pot, comfort-food), diet flags if applicable. All lowercase.

If this is clearly not a recipe, return exactly: null`;

export async function formatVoiceRecipe(transcript: string): Promise<ScannedRecipe | null> {
  const prompt = `${VOICE_PROMPT}\n\nSpoken recipe:\n${transcript}`;
  const text = await callClaude({ prompt, maxTokens: 3000 });
  const trimmed = text.trim();
  if (trimmed === 'null' || trimmed === '`null`') return null;
  try {
    return extractJSON<ScannedRecipe>(text);
  } catch {
    return null;
  }
}
