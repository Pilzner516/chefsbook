import { supabase } from '../client';

export interface CookingNote {
  id: string;
  recipe_id: string;
  user_id: string;
  note: string;
  cooked_at: string;
}

export async function listCookingNotes(recipeId: string): Promise<CookingNote[]> {
  const { data } = await supabase
    .from('cooking_notes')
    .select('*')
    .eq('recipe_id', recipeId)
    .order('cooked_at', { ascending: false });
  return (data ?? []) as CookingNote[];
}

export async function addCookingNote(
  userId: string,
  recipeId: string,
  note: string,
  cookedAt?: string,
): Promise<CookingNote> {
  const { data, error } = await supabase
    .from('cooking_notes')
    .insert({
      user_id: userId,
      recipe_id: recipeId,
      note,
      cooked_at: cookedAt ?? new Date().toISOString(),
    })
    .select()
    .single();
  if (error || !data) throw error ?? new Error('Failed to add cooking note');
  return data as CookingNote;
}

export async function updateCookingNote(
  id: string,
  updates: Partial<Pick<CookingNote, 'note' | 'cooked_at'>>,
): Promise<CookingNote> {
  const { data, error } = await supabase
    .from('cooking_notes')
    .update(updates)
    .eq('id', id)
    .select()
    .single();
  if (error || !data) throw error ?? new Error('Failed to update cooking note');
  return data as CookingNote;
}

export async function deleteCookingNote(id: string): Promise<void> {
  const { error } = await supabase.from('cooking_notes').delete().eq('id', id);
  if (error) throw error;
}
