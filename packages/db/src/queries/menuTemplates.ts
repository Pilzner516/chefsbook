import { supabase } from '../client';

export interface MenuTemplate {
  id: string;
  user_id: string;
  name: string;
  recipe_ids: string[];
  created_at: string;
}

export async function listMenuTemplates(userId: string): Promise<MenuTemplate[]> {
  const { data } = await supabase
    .from('menu_templates')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });
  return (data ?? []) as MenuTemplate[];
}

export async function getMenuTemplate(id: string): Promise<MenuTemplate | null> {
  const { data } = await supabase
    .from('menu_templates')
    .select('*')
    .eq('id', id)
    .single();
  return (data as MenuTemplate) ?? null;
}

export async function createMenuTemplate(
  userId: string,
  name: string,
  recipeIds: string[],
): Promise<MenuTemplate> {
  const { data, error } = await supabase
    .from('menu_templates')
    .insert({ user_id: userId, name, recipe_ids: recipeIds })
    .select()
    .single();
  if (error || !data) throw error ?? new Error('Failed to create menu template');
  return data as MenuTemplate;
}

export async function updateMenuTemplate(
  id: string,
  updates: Partial<Pick<MenuTemplate, 'name' | 'recipe_ids'>>,
): Promise<MenuTemplate> {
  const { data, error } = await supabase
    .from('menu_templates')
    .update(updates)
    .eq('id', id)
    .select()
    .single();
  if (error || !data) throw error ?? new Error('Failed to update menu template');
  return data as MenuTemplate;
}

export async function deleteMenuTemplate(id: string): Promise<void> {
  const { error } = await supabase.from('menu_templates').delete().eq('id', id);
  if (error) throw error;
}
