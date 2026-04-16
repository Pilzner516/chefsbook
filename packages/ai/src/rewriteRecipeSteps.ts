import { callClaude, extractJSON, HAIKU } from './client';

export interface RecipeStep {
  step_number: number;
  instruction: string;
  timer_minutes?: number | null;
  group_label?: string | null;
}

/**
 * Rewrite recipe steps in fresh words to avoid verbatim copying.
 * Uses HAIKU — ~$0.0003 per recipe.
 * Called ONLY on URL/extension imports — not user-created or scanned recipes.
 */
export async function rewriteRecipeSteps(
  steps: RecipeStep[],
  recipeName: string,
  cuisine?: string | null,
): Promise<RecipeStep[]> {
  if (!steps || steps.length === 0) return steps;

  const stepsText = steps
    .map((s, i) => `${i + 1}. ${s.instruction}`)
    .join('\n');

  const prompt = `You are rewriting cooking instructions to avoid verbatim copying.
Recipe: "${recipeName}"${cuisine ? ` (${cuisine})` : ''}

Rewrite each step below in your own words while:
- Keeping ALL quantities, temperatures, times, and techniques EXACTLY the same
- Keeping the same number of steps — do not merge or split steps
- Keeping the same order of operations
- Using clear, friendly cooking language
- Never adding new information or changing the method
- Never removing any instruction

Return ONLY a JSON array of strings, one per step, in the same order.
Steps to rewrite:
${stepsText}`;

  const raw = await callClaude({ prompt, model: HAIKU, maxTokens: 2000 });
  const rewritten = extractJSON<string[]>(raw);

  if (!Array.isArray(rewritten) || rewritten.length !== steps.length) {
    throw new Error(`Rewrite returned ${rewritten?.length ?? 0} steps, expected ${steps.length}`);
  }

  return steps.map((s, i) => ({
    ...s,
    instruction: rewritten[i],
  }));
}
