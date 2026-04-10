import { callClaude, extractJSON } from './client';

export type RecipeModerationResult = {
  verdict: 'clean' | 'mild' | 'serious';
  reason?: string | null;
  flagged_fields?: string[];
};

const RECIPE_MODERATION_PROMPT = `You are a content moderator for a family-friendly recipe sharing app used by all ages.
Review the following recipe content for violations.

Rules:
- No profanity or swearing (any language)
- No hate speech or discrimination
- No sexual or violent content
- No content promoting dangerous activities
- No spam or completely off-topic content
- Must be genuinely food/cooking related
- Family-friendly — suitable for children to read

Recipe to review:
Title: "{{title}}"
Description: "{{description}}"
Ingredients: {{ingredients}}
Steps summary: {{steps}}
Notes: "{{notes}}"

Classify as:
- "clean": no violations — normal cooking recipe
- "mild": borderline content, slightly inappropriate but not severe (flag for review but save the recipe)
- "serious": clear profanity, sexual/violent content, hate speech, completely non-food content used to post offensive material (hide recipe immediately)

Return JSON only:
{
  "verdict": "clean" | "mild" | "serious",
  "reason": "brief explanation if not clean, null if clean",
  "flagged_fields": ["title", "description"]
}`;

export async function moderateRecipe(recipe: {
  title: string;
  description?: string | null;
  ingredients?: Array<{ ingredient?: string; name?: string }>;
  steps?: Array<{ instruction: string }>;
  notes?: string | null;
}): Promise<RecipeModerationResult> {
  const ingredientNames = recipe.ingredients?.map((i) => i.ingredient ?? i.name ?? '').join(', ') ?? '';
  const stepsSummary = recipe.steps?.slice(0, 3).map((s) => s.instruction).join(' | ') ?? '';

  const prompt = RECIPE_MODERATION_PROMPT
    .replace('{{title}}', (recipe.title ?? '').replace(/"/g, '\\"'))
    .replace('{{description}}', (recipe.description ?? '').replace(/"/g, '\\"'))
    .replace('{{ingredients}}', ingredientNames)
    .replace('{{steps}}', stepsSummary)
    .replace('{{notes}}', (recipe.notes ?? '').replace(/"/g, '\\"'));

  const text = await callClaude({ prompt, maxTokens: 200 });
  return extractJSON<RecipeModerationResult>(text);
}
