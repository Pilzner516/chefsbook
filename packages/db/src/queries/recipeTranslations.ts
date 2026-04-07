import { supabase } from '../client';

export interface RecipeTranslation {
  id: string;
  recipe_id: string;
  language: string;
  translated_title: string | null;
  translated_description: string | null;
  translated_ingredients: any[] | null;
  translated_steps: any[] | null;
  translated_notes: string | null;
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
