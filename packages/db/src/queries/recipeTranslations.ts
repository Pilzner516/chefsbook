import { supabase, supabaseAdmin } from '../client';

export interface RecipeTranslation {
  id: string;
  recipe_id: string;
  language: string;
  translated_title: string | null;
  translated_description: string | null;
  translated_ingredients: any[] | null;
  translated_steps: any[] | null;
  translated_notes: string | null;
  is_title_only: boolean;
  created_at: string;
  updated_at: string;
}

export async function getRecipeTranslation(
  recipeId: string,
  language: string,
): Promise<RecipeTranslation | null> {
  const { data } = await supabase
    .from('recipe_translations')
    .select('*')
    .eq('recipe_id', recipeId)
    .eq('language', language)
    .maybeSingle();
  return data;
}

export async function saveRecipeTranslation(
  recipeId: string,
  language: string,
  translation: {
    title: string;
    description: string | null;
    ingredients: any[];
    steps: any[];
    notes: string | null;
  },
): Promise<void> {
  await supabase
    .from('recipe_translations')
    .upsert(
      {
        recipe_id: recipeId,
        language,
        translated_title: translation.title,
        translated_description: translation.description,
        translated_ingredients: translation.ingredients,
        translated_steps: translation.steps,
        translated_notes: translation.notes,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'recipe_id,language' },
    );
}

export async function deleteRecipeTranslations(recipeId: string): Promise<void> {
  await supabase
    .from('recipe_translations')
    .delete()
    .eq('recipe_id', recipeId);
}

/** Save title-only translations for all 4 languages. Uses supabaseAdmin (server-side). */
export async function saveTitleOnlyTranslations(
  recipeId: string,
  titles: Record<string, string>,
): Promise<void> {
  const rows = Object.entries(titles)
    .filter(([lang]) => lang !== 'en')
    .map(([lang, title]) => ({
      recipe_id: recipeId,
      language: lang,
      translated_title: title,
      is_title_only: true,
      updated_at: new Date().toISOString(),
    }));
  if (rows.length === 0) return;
  // Only insert if no translation exists yet for this recipe+language
  for (const row of rows) {
    await supabaseAdmin
      .from('recipe_translations')
      .upsert(row, { onConflict: 'recipe_id,language', ignoreDuplicates: true });
  }
}

/** Batch fetch translated titles for a list of recipe IDs + language. */
export async function getBatchTranslatedTitles(
  recipeIds: string[],
  language: string,
): Promise<Record<string, string>> {
  if (!language || language === 'en' || recipeIds.length === 0) return {};
  const { data } = await supabase
    .from('recipe_translations')
    .select('recipe_id, translated_title')
    .in('recipe_id', recipeIds)
    .eq('language', language)
    .not('translated_title', 'is', null);
  const map: Record<string, string> = {};
  for (const row of data ?? []) {
    if (row.translated_title) map[row.recipe_id] = row.translated_title;
  }
  return map;
}

/** Get a full (non-title-only) translation for a recipe + language. */
export async function getFullTranslation(
  recipeId: string,
  language: string,
): Promise<RecipeTranslation | null> {
  if (!language || language === 'en') return null;
  const { data } = await supabase
    .from('recipe_translations')
    .select('*')
    .eq('recipe_id', recipeId)
    .eq('language', language)
    .eq('is_title_only', false)
    .maybeSingle();
  return data;
}
