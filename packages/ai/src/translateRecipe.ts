import { callClaude, extractJSON, HAIKU } from './client';

const LANGUAGE_NAMES: Record<string, string> = {
  fr: 'French',
  es: 'Spanish',
  it: 'Italian',
  de: 'German',
};

export interface TranslatedIngredient {
  quantity: number | string | null;
  unit: string | null;
  name: string;
  notes: string | null;
}

export interface TranslatedStep {
  instruction: string;
}

export interface TranslatedRecipe {
  title: string;
  description: string | null;
  ingredients: TranslatedIngredient[];
  steps: TranslatedStep[];
  notes: string | null;
}

export async function translateRecipe(
  recipe: {
    title: string;
    description?: string | null;
    ingredients: { quantity?: number | null; unit?: string | null; ingredient: string; preparation?: string | null }[];
    steps: { instruction: string }[];
    notes?: string | null;
  },
  targetLanguage: string,
): Promise<TranslatedRecipe> {
  const languageName = LANGUAGE_NAMES[targetLanguage] ?? targetLanguage;

  const prompt = `You are a professional culinary translator. Translate the following recipe into ${languageName}.

Rules:
- Translate ingredient names, quantities stay as numbers
- Translate all step instructions naturally — preserve cooking technique terminology
- Translate description and notes if present
- Keep proper nouns (brand names, specific cheese names like "Parmigiano-Reggiano") in original
- Return ONLY valid JSON in exactly this structure, no other text:
{
  "title": "...",
  "description": "...",
  "ingredients": [{ "quantity": "...", "unit": "...", "name": "...", "notes": "..." }],
  "steps": [{ "instruction": "..." }],
  "notes": "..."
}

Recipe to translate:
${JSON.stringify({
  title: recipe.title,
  description: recipe.description ?? null,
  ingredients: recipe.ingredients.map((i) => ({
    quantity: i.quantity ?? null,
    unit: i.unit ?? null,
    name: i.ingredient,
    notes: i.preparation ?? null,
  })),
  steps: recipe.steps.map((s) => ({ instruction: s.instruction })),
  notes: recipe.notes ?? null,
})}`;

  const raw = await callClaude({ prompt, maxTokens: 4000 });
  return extractJSON<TranslatedRecipe>(raw);
}

/**
 * Translates only the recipe title into all 4 non-English languages in a single HAIKU call.
 * Cost: ~$0.0002 per recipe total.
 */
export async function translateRecipeTitle(
  title: string,
): Promise<Record<string, string>> {
  const prompt = `Translate this recipe title into French, Spanish, Italian, and German.
Return ONLY a JSON object with keys fr, es, it, de and the translated titles as values. No other text.

Title: "${title}"`;

  const raw = await callClaude({ prompt, maxTokens: 200, model: HAIKU });
  return extractJSON<Record<string, string>>(raw);
}
