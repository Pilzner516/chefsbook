import { callClaude, extractJSON } from './client';

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
