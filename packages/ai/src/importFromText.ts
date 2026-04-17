import { callClaude, extractJSON } from './client';
import type { ScannedRecipe } from '@chefsbook/db';

const TEXT_IMPORT_PROMPT = `You are a recipe extraction expert. The user has pasted raw recipe text — it may be a full recipe, just ingredients, just steps, or a mix. Extract whatever recipe information is present.

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
  "tags": ["string — 5-8 relevant tags"],
  "source_type": "text"
}

Rules:
- Extract ALL recipe content from the pasted text
- If only ingredients are present, return ingredients with an empty steps array
- If only steps are present, return steps with an empty ingredients array
- QUANTITIES ARE REQUIRED: extract exact quantities, units, and names
- If no quantity exists, use "to taste" or "as needed"
- Normalize ingredient names consistently
- Preserve group labels like "For the sauce:" or "Dough:"
- Generate a title if none is obvious from the text
- Generate 5-8 lowercase tags covering protein, method, characteristics, diet
- Use null for any field not found
- Never invent ingredients or steps not present in the text`;

/**
 * Import a recipe from raw pasted text.
 * Uses Sonnet for quality extraction — ~$0.003 per call.
 */
export async function importFromText(
  text: string,
): Promise<ScannedRecipe> {
  if (!text || text.trim().length < 10) {
    throw new Error('Text is too short to extract a recipe');
  }

  const truncated = text.slice(0, 25000);

  const prompt = `${TEXT_IMPORT_PROMPT}\n\nPasted text:\n${truncated}`;

  const raw = await callClaude({ prompt, maxTokens: 4000 });
  const recipe = extractJSON<ScannedRecipe>(raw);

  // Ensure required fields have sensible defaults
  return {
    title: recipe.title || 'Pasted Recipe',
    description: recipe.description ?? null,
    servings: recipe.servings ?? 4,
    prep_minutes: recipe.prep_minutes ?? null,
    cook_minutes: recipe.cook_minutes ?? null,
    cuisine: recipe.cuisine ?? null,
    course: recipe.course ?? null,
    ingredients: recipe.ingredients ?? [],
    steps: recipe.steps ?? [],
    notes: recipe.notes ?? null,
    tags: recipe.tags ?? [],
    source_type: 'text' as any,
  };
}
