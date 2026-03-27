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
  "course": "breakfast|brunch|lunch|dinner|starter|main|side|dessert|snack|drink|other|null",
  "ingredients": [
    { "quantity": "number|null", "unit": "string|null", "ingredient": "string", "preparation": "string|null", "optional": false, "group_label": "string|null" }
  ],
  "steps": [
    { "step_number": 1, "instruction": "string", "timer_minutes": "number|null", "group_label": "string|null" }
  ],
  "notes": "string | null",
  "source_type": "scan"
}

Rules:
- Normalize ingredient names: "AP flour" → "all-purpose flour", "s&p" → list as two separate ingredients
- Preserve group labels like "For the sauce:" or "Dough:" as group_label on those ingredients/steps
- If text is partially obscured or unclear, make your best inference and note it in the notes field
- Temperatures: preserve original units (°F or °C)
- Use null for any field not visible or not applicable`;

export async function scanRecipe(imageBase64: string, mimeType = 'image/jpeg'): Promise<ScannedRecipe> {
  const text = await callClaude({ prompt: SCAN_PROMPT, imageBase64, imageMimeType: mimeType, maxTokens: 3000 });
  return extractJSON<ScannedRecipe>(text);
}
