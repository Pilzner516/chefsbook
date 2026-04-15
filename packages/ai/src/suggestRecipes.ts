import { callClaude, extractJSON, HAIKU } from './client';

export interface RecipeSuggestion {
  title: string;
  description: string;
  cuisine: string | null;
  course: string | null;
  estimated_time_minutes: number;
  key_ingredients: string[];
}

const SUGGEST_PROMPT = `You are a creative chef assistant. Based on the ingredients the user has available, suggest recipes they can make.

Return ONLY a JSON array, no markdown, no explanation:
[
  {
    "title": "string",
    "description": "string — brief appetizing description",
    "cuisine": "string | null",
    "course": "breakfast|brunch|lunch|dinner|starter|main|side|dessert|snack|drink|bread|other|null",
    "estimated_time_minutes": "number",
    "key_ingredients": ["string — which of the user's ingredients are used"]
  }
]

Rules:
- Suggest 3-5 recipes
- Prioritize recipes that use the most of the available ingredients
- Include a mix of quick and more involved options
- Be creative but practical — suggest real, well-known dishes when possible
- Consider common pantry staples (salt, pepper, oil, butter) as available`;

export async function suggestRecipes(ingredients: string[]): Promise<RecipeSuggestion[]> {
  const prompt = `${SUGGEST_PROMPT}\n\nAvailable ingredients:\n${ingredients.map((i) => `- ${i}`).join('\n')}`;
  // Simple structured suggestion from a short ingredient list — Haiku is sufficient.
  const text = await callClaude({ prompt, maxTokens: 2000, model: HAIKU });
  return extractJSON<RecipeSuggestion[]>(text);
}
