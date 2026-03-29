import { callClaude, extractJSON } from './client';
import type { ScannedRecipe } from '@chefsbook/db';

const VARIATION_PROMPT = `You are a creative chef assistant. The user wants a variation of an existing recipe. Generate a modified version based on their request.

Return ONLY a JSON object with the full modified recipe, no markdown, no explanation:
{
  "title": "string — new title reflecting the variation",
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
  "notes": "string — describe what was changed and why",
  "source_type": "ai"
}

Rules:
- Keep the spirit of the original recipe while making the requested changes
- Adjust quantities and steps as needed for the modification
- Note substitutions or technique changes in the notes field
- If making a dietary variation (vegan, gluten-free, etc.), ensure ALL ingredients comply`;

export async function generateVariation(
  originalRecipe: { title: string; ingredients: { ingredient: string; quantity?: number | null; unit?: string | null }[]; steps: { instruction: string }[] },
  request: string,
): Promise<ScannedRecipe> {
  const recipeContext = `Original recipe: ${originalRecipe.title}\nIngredients: ${originalRecipe.ingredients.map((i) => `${i.quantity ?? ''} ${i.unit ?? ''} ${i.ingredient}`.trim()).join(', ')}\nSteps: ${originalRecipe.steps.map((s, i) => `${i + 1}. ${s.instruction}`).join('\n')}`;
  const prompt = `${VARIATION_PROMPT}\n\n${recipeContext}\n\nUser's request: ${request}`;
  const text = await callClaude({ prompt, maxTokens: 3000 });
  return extractJSON<ScannedRecipe>(text);
}
