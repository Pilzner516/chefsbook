import { supabase } from '../client';
import type { RecipeUserPhoto } from '../types';

export async function listRecipePhotos(recipeId: string): Promise<RecipeUserPhoto[]> {
  const { data } = await supabase
    .from('recipe_user_photos')
    .select('*')
    .eq('recipe_id', recipeId)
    .order('sort_order');
  return (data ?? []) as RecipeUserPhoto[];
}

export async function addRecipePhoto(
  recipeId: string,
  userId: string,
  storagePath: string,
  url: string,
  caption?: string,
): Promise<RecipeUserPhoto> {
  const { count } = await supabase
    .from('recipe_user_photos')
    .select('*', { count: 'exact', head: true })
    .eq('recipe_id', recipeId);

  if ((count ?? 0) >= 10) throw new Error('Maximum 10 photos per recipe');

  const { data, error } = await supabase
    .from('recipe_user_photos')
    .insert({
      recipe_id: recipeId,
      user_id: userId,
      storage_path: storagePath,
      url,
      caption: caption ?? null,
      sort_order: (count ?? 0),
    })
    .select()
    .single();
  if (error || !data) throw new Error(error?.message ?? 'Failed to add photo');
  return data as RecipeUserPhoto;
}

export async function deleteRecipePhoto(id: string): Promise<void> {
  const { data: photo } = await supabase
    .from('recipe_user_photos')
    .select('storage_path')
    .eq('id', id)
    .single();
  if (photo?.storage_path) {
    await supabase.storage.from('recipe-user-photos').remove([photo.storage_path]);
  }
  await supabase.from('recipe_user_photos').delete().eq('id', id);
}

export async function setPhotoPrimary(id: string, recipeId: string): Promise<void> {
  // Unset all primary flags for this recipe
  await supabase.from('recipe_user_photos').update({ is_primary: false }).eq('recipe_id', recipeId);
  // Set this one
  await supabase.from('recipe_user_photos').update({ is_primary: true }).eq('id', id);
}

export async function updatePhotoCaption(id: string, caption: string | null): Promise<void> {
  await supabase.from('recipe_user_photos').update({ caption }).eq('id', id);
}
