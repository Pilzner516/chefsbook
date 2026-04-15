import { callClaude, extractJSON, HAIKU } from './client';

export interface RecipeVerdict {
  verdict: 'approved' | 'flagged' | 'not_a_recipe';
  reason: string;
}

export async function isActuallyARecipe(recipe: {
  title: string;
  description?: string;
  ingredients: string[];
  steps: string[];
}): Promise<RecipeVerdict> {
  const prompt = `Review this recipe entry. Determine if it is: (1) a genuine food recipe suitable for a family cooking app, (2) flagged content (inappropriate, offensive, or suspicious), or (3) not actually a recipe (test entry, gibberish, placeholder, or non-food content).

Title: ${recipe.title}
Description: ${recipe.description ?? ''}
First 3 ingredients: ${recipe.ingredients.slice(0, 3).join(', ')}
First step: ${recipe.steps[0] ?? ''}

Reply with JSON only: {"verdict": "approved"|"flagged"|"not_a_recipe", "reason": "one sentence"}`;

  try {
    const raw = await callClaude({ prompt, model: HAIKU, maxTokens: 200 });
    const parsed = extractJSON<RecipeVerdict>(raw);
    if (!['approved', 'flagged', 'not_a_recipe'].includes(parsed.verdict)) {
      return { verdict: 'approved', reason: 'default' };
    }
    return parsed;
  } catch {
    return { verdict: 'approved', reason: 'ai_check_failed' };
  }
}
