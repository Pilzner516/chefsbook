import { supabase } from '../client';
import type { Cookbook, CookbookRecipe } from '../types';

export async function getCookbook(id: string): Promise<Cookbook | null> {
  const { data } = await supabase
    .from('cookbooks')
    .select('*')
    .eq('id', id)
    .single();
  return data as Cookbook | null;
}

export async function listCookbooks(userId: string): Promise<Cookbook[]> {
  const { data } = await supabase
    .from('cookbooks')
    .select('*')
    .eq('user_id', userId)
    .order('title');
  return (data ?? []) as Cookbook[];
}

export async function createCookbook(
  userId: string,
  cookbook: Omit<Cookbook, 'id' | 'user_id' | 'created_at'>,
): Promise<Cookbook> {
  const { data, error } = await supabase
    .from('cookbooks')
    .insert({ ...cookbook, user_id: userId })
    .select()
    .single();
  if (error || !data) throw error ?? new Error('Failed to create cookbook');
  return data as Cookbook;
}

export async function updateCookbook(
  id: string,
  updates: Partial<Omit<Cookbook, 'id' | 'user_id' | 'created_at'>>,
): Promise<Cookbook> {
  const { data, error } = await supabase
    .from('cookbooks')
    .update(updates)
    .eq('id', id)
    .select()
    .single();
  if (error || !data) throw error ?? new Error('Failed to update cookbook');
  return data as Cookbook;
}

export async function deleteCookbook(id: string): Promise<void> {
  const { error } = await supabase.from('cookbooks').delete().eq('id', id);
  if (error) throw error;
}

// ── Cookbook Recipes (TOC entries) ──

export async function listCookbookRecipes(cookbookId: string): Promise<CookbookRecipe[]> {
  const { data } = await supabase
    .from('cookbook_recipes')
    .select('*')
    .eq('cookbook_id', cookbookId)
    .order('chapter')
    .order('page_number');
  return (data ?? []) as CookbookRecipe[];
}

export async function addCookbookRecipes(
  cookbookId: string,
  recipes: { title: string; page_number?: number | null; chapter?: string | null; description?: string | null; ai_generated?: boolean }[],
): Promise<CookbookRecipe[]> {
  const rows = recipes.map((r) => ({
    cookbook_id: cookbookId,
    title: r.title,
    page_number: r.page_number ?? null,
    chapter: r.chapter ?? null,
    description: r.description ?? null,
    ai_generated: r.ai_generated ?? false,
  }));
  const { data, error } = await supabase.from('cookbook_recipes').insert(rows).select();
  if (error) throw new Error(error.message);
  return (data ?? []) as CookbookRecipe[];
}

export async function matchCookbookRecipe(id: string, recipeId: string): Promise<void> {
  await supabase.from('cookbook_recipes').update({ matched_recipe_id: recipeId }).eq('id', id);
}

export async function searchCookbookRecipes(query: string, userId: string): Promise<(CookbookRecipe & { cookbook_title: string })[]> {
  const { data } = await supabase
    .from('cookbook_recipes')
    .select('*, cookbook:cookbooks!inner(title, user_id)')
    .ilike('title', `%${query}%`)
    .eq('cookbook.user_id', userId)
    .limit(20);
  return (data ?? []).map((r: any) => ({ ...r, cookbook_title: r.cookbook?.title })) as any;
}
