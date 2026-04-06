import { callClaude, extractJSON } from './client';
import type { ScannedRecipe } from '@chefsbook/db';

export interface AiChefSuggestion {
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
  }[];
  servings: number | null;
  notes: string | null;
}

/**
 * Generate aiChef suggestions for missing recipe sections.
 * Returns suggestions that the user must review before accepting.
 */
export async function generateAiChefSuggestion(
  partialRecipe: {
    title: string;
    cuisine?: string | null;
    course?: string | null;
    ingredients?: ScannedRecipe['ingredients'];
    steps?: ScannedRecipe['steps'];
    source_url?: string | null;
  },
  missingSections: string[],
): Promise<AiChefSuggestion> {
  const prompt = `You are aiChef, a culinary AI assistant. A recipe was partially imported and is missing some sections.

Recipe title: "${partialRecipe.title}"
${partialRecipe.cuisine ? `Cuisine: ${partialRecipe.cuisine}` : ''}
${partialRecipe.course ? `Course: ${partialRecipe.course}` : ''}
${partialRecipe.source_url ? `Original URL: ${partialRecipe.source_url}` : ''}

${partialRecipe.ingredients?.length ? `Existing ingredients:\n${partialRecipe.ingredients.map(i => `- ${i.quantity ?? ''} ${i.unit ?? ''} ${i.ingredient}`).join('\n')}` : 'No ingredients captured.'}

${partialRecipe.steps?.length ? `Existing steps:\n${partialRecipe.steps.map(s => `${s.step_number}. ${s.instruction}`).join('\n')}` : 'No steps captured.'}

Missing sections that need suggestions: ${missingSections.join(', ')}

Based on the recipe title, cuisine, and any partial data above, suggest the most likely missing content. Be accurate to the traditional recipe. If the recipe is well-known, use the classic version.

Return ONLY a JSON object:
{
  "ingredients": [{ "quantity": number|null, "unit": "string|null", "ingredient": "string", "preparation": "string|null", "optional": false, "group_label": "string|null" }],
  "steps": [{ "step_number": 1, "instruction": "string", "timer_minutes": number|null, "group_label": "string|null" }],
  "servings": number|null,
  "notes": "string|null — any caveats about the suggestion"
}

Only include sections that are actually missing. If ingredients exist, return an empty ingredients array.`;

  const text = await callClaude({ prompt, maxTokens: 3000 });
  return extractJSON<AiChefSuggestion>(text);
}
