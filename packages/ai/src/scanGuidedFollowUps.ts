import { callClaude, extractJSON, HAIKU } from './client';

export type ScanFollowUp = {
  question: string;
  placeholder?: string;
};

/**
 * Generate 0–3 targeted follow-up questions for the guided scan flow's Step B.
 *
 * Input: dish name (from Haiku Vision), optional cuisine guess, optional user-supplied comments.
 * Output: at most 3 short questions. Return an empty array when no useful questions apply —
 * the flow is meant to skip Step B when the AI has high confidence and nothing worth asking.
 *
 * Haiku ~$0.00015/call. Fire from the client after Step A's "Continue" tap.
 */
export async function generateScanFollowUpQuestions(params: {
  dishName: string;
  cuisineGuess?: string | null;
  userComments?: string;
}): Promise<ScanFollowUp[]> {
  const { dishName, cuisineGuess, userComments } = params;

  const prompt = `A user uploaded a photo of a dish and we have identified it as: "${dishName}"${cuisineGuess ? ` (${cuisineGuess} cuisine)` : ''}.
${userComments?.trim() ? `The user also wrote: "${userComments.trim()}"` : ''}

We want to generate a personalised recipe for them.
Return AT MOST 3 short, targeted questions that would genuinely change the recipe output. Typical useful questions include: servings, dietary preferences (vegetarian, gluten-free), rough total time available, a regional variant, or cooking method (oven vs stovetop) — but only when the answer would materially change the recipe.

RULES:
- Return an empty array [] if no useful questions apply. Never ask filler questions just to hit a minimum. Do not ask to confirm the dish name or cuisine (already known).
- Each question must be a single sentence, under 60 characters.
- Suggest an example value as a placeholder ("4", "vegetarian", "30 minutes").
- Output ONLY a JSON array, no markdown, no commentary.

Schema:
[
  { "question": "string", "placeholder": "string" }
]`;

  const text = await callClaude({
    prompt,
    maxTokens: 500,
    model: HAIKU,
  });
  const questions = extractJSON<ScanFollowUp[]>(text);
  if (!Array.isArray(questions)) return [];
  return questions.slice(0, 3).filter((q) => q && typeof q.question === 'string' && q.question.trim().length > 0);
}
