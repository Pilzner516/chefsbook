import { supabase, supabaseAdmin } from '../client';
import type { Menu, MenuItem, MenuWithItems, MenuCourse } from '../types/menus';

export async function getUserMenus(userId: string): Promise<Menu[]> {
  const { data, error } = await supabase
    .from('menus')
    .select('*')
    .eq('user_id', userId)
    .order('updated_at', { ascending: false });

  if (error) throw error;
  return data ?? [];
}

export async function getMenu(menuId: string): Promise<MenuWithItems | null> {
  const { data, error } = await supabase
    .from('menus')
    .select(`
      *,
      menu_items (
        *,
        recipe:recipes (
          id,
          title,
          description,
          prep_minutes,
          cook_minutes,
          servings,
          image_url
        )
      )
    `)
    .eq('id', menuId)
    .single();

  if (error) {
    if (error.code === 'PGRST116') return null;
    throw error;
  }

  return data as MenuWithItems;
}

export async function createMenu(data: {
  user_id: string;
  title: string;
  description?: string | null;
  occasion?: string | null;
  notes?: string | null;
  is_public?: boolean;
}): Promise<Menu> {
  const { data: menu, error } = await supabase
    .from('menus')
    .insert({
      user_id: data.user_id,
      title: data.title,
      description: data.description ?? null,
      occasion: data.occasion ?? null,
      notes: data.notes ?? null,
      is_public: data.is_public ?? false,
    })
    .select()
    .single();

  if (error) throw error;
  return menu;
}

export async function updateMenu(
  menuId: string,
  data: {
    title?: string;
    description?: string | null;
    occasion?: string | null;
    notes?: string | null;
    is_public?: boolean;
  }
): Promise<Menu> {
  const { data: menu, error } = await supabase
    .from('menus')
    .update({
      ...data,
      updated_at: new Date().toISOString(),
    })
    .eq('id', menuId)
    .select()
    .single();

  if (error) throw error;
  return menu;
}

export async function deleteMenu(menuId: string): Promise<void> {
  const { error } = await supabase
    .from('menus')
    .delete()
    .eq('id', menuId);

  if (error) throw error;
}

export async function addMenuItem(
  menuId: string,
  recipeId: string,
  course: MenuCourse,
  sortOrder: number,
  servingsOverride?: number | null,
  notes?: string | null
): Promise<MenuItem> {
  const { data, error } = await supabase
    .from('menu_items')
    .insert({
      menu_id: menuId,
      recipe_id: recipeId,
      course,
      sort_order: sortOrder,
      servings_override: servingsOverride ?? null,
      notes: notes ?? null,
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function updateMenuItem(
  itemId: string,
  data: {
    course?: MenuCourse;
    sort_order?: number;
    servings_override?: number | null;
    notes?: string | null;
  }
): Promise<MenuItem> {
  const { data: item, error } = await supabase
    .from('menu_items')
    .update(data)
    .eq('id', itemId)
    .select()
    .single();

  if (error) throw error;
  return item;
}

export async function removeMenuItem(itemId: string): Promise<void> {
  const { error } = await supabase
    .from('menu_items')
    .delete()
    .eq('id', itemId);

  if (error) throw error;
}

export async function reorderMenuItems(
  menuId: string,
  itemIds: string[]
): Promise<void> {
  const updates = itemIds.map((id, index) => ({
    id,
    menu_id: menuId,
    sort_order: index,
  }));

  for (const update of updates) {
    const { error } = await supabase
      .from('menu_items')
      .update({ sort_order: update.sort_order })
      .eq('id', update.id)
      .eq('menu_id', update.menu_id);

    if (error) throw error;
  }
}

export async function getMenuScanEnabled(userId: string): Promise<boolean> {
  const { data, error } = await supabase
    .from('user_profiles')
    .select('menu_scan_enabled')
    .eq('id', userId)
    .single();

  if (error) throw error;
  return data?.menu_scan_enabled ?? false;
}

export async function setMenuScanEnabled(
  userId: string,
  enabled: boolean
): Promise<void> {
  const { error } = await supabaseAdmin
    .from('user_profiles')
    .update({ menu_scan_enabled: enabled })
    .eq('id', userId);

  if (error) throw error;
}
