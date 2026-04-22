import { callClaude, extractJSON, HAIKU } from './client';

export type RecipeModerationResult = {
  verdict: 'clean' | 'mild' | 'serious' | 'spam';
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

Also flag as 'spam' if the content shows these signals:
- Title or description promoting a product, service, or website unrelated to cooking
- Embedded URLs, phone numbers, or contact information in description/notes
- Keyword stuffing: unnatural repetition of search terms
- Content clearly unrelated to food or cooking
- Promotional language ("buy now", "click here", "visit us at")

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
- "spam": promotional content, URLs, contact info, keyword stuffing, or content clearly unrelated to cooking (flag for admin review)

Return JSON only:
{
  "verdict": "clean" | "mild" | "serious" | "spam",
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
  const ingredientNames = recipe.ingredients?.slice(0, 5).map((i) => i.ingredient ?? i.name ?? '').join(', ') ?? '';
  const stepsSummary = recipe.steps?.slice(0, 3).map((s) => s.instruction.slice(0, 100)).join(' | ') ?? '';

  const prompt = RECIPE_MODERATION_PROMPT
    .replace('{{title}}', (recipe.title ?? '').replace(/"/g, '\\"'))
    .replace('{{description}}', (recipe.description ?? '').slice(0, 200).replace(/"/g, '\\"'))
    .replace('{{ingredients}}', ingredientNames)
    .replace('{{steps}}', stepsSummary)
    .replace('{{notes}}', (recipe.notes ?? '').slice(0, 200).replace(/"/g, '\\"'));

  const text = await callClaude({ prompt, maxTokens: 150, model: HAIKU });
  return extractJSON<RecipeModerationResult>(text);
}
