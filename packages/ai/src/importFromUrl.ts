import { callClaude, extractJSON } from './client';
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
  "course": "breakfast|brunch|lunch|dinner|starter|main|side|dessert|snack|drink|other|null",
  "ingredients": [
    { "quantity": "number|null", "unit": "string|null", "ingredient": "string", "preparation": "string|null", "optional": false, "group_label": "string|null" }
  ],
  "steps": [
    { "step_number": 1, "instruction": "string", "timer_minutes": "number|null", "group_label": "string|null" }
  ],
  "notes": "string | null",
  "source_type": "url"
}

Rules:
- Extract ONLY recipe content, ignore ads, navigation, comments, and other page clutter
- Normalize ingredient names consistently
- Preserve group labels like "For the sauce:" or "Dough:"
- Temperatures: preserve original units (°F or °C)
- If the page contains multiple recipes, extract only the primary/featured one
- Use null for any field not found`;

export async function importFromUrl(pageText: string, sourceUrl: string): Promise<ScannedRecipe> {
  const prompt = `${IMPORT_PROMPT}\n\nSource URL: ${sourceUrl}\n\nPage content:\n${pageText.slice(0, 8000)}`;
  const text = await callClaude({ prompt, maxTokens: 3000 });
  return extractJSON<ScannedRecipe>(text);
}
