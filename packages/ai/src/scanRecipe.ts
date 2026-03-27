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
- Use null for any field not visible or not applicable

Timer extraction (critical for auto-timer feature):
- Scan each step for ANY time reference: "5 minutes", "1 hour", "30 sec", "2-3 min", "about 10 minutes", "45 min or until golden"
- Convert ALL durations to minutes as an integer for timer_minutes: "1 hour" → 60, "90 seconds" → 2, "2-3 minutes" → 3 (use upper bound)
- Common patterns to detect: "cook for X min", "bake X minutes", "simmer X min", "let rest X minutes", "marinate for X hours", "chill X min", "set aside for X"
- If a step says "until golden" or "until done" with no time, set timer_minutes to null
- If a step has multiple timers ("cook 5 min, then flip and cook 3 more min"), use the total: 8
- Implicit timers: "bring to a boil" → null (no specific time), "let cool 10 minutes" → 10`;

export async function scanRecipe(imageBase64: string, mimeType = 'image/jpeg'): Promise<ScannedRecipe> {
  const text = await callClaude({ prompt: SCAN_PROMPT, imageBase64, imageMimeType: mimeType, maxTokens: 3000 });
  return extractJSON<ScannedRecipe>(text);
}
