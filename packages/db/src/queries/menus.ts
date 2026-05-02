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
  public_notes?: string | null;
  private_notes?: string | null;
  is_public?: boolean;
  cover_image_url?: string | null;
  source_menu_id?: string | null;
}): Promise<Menu> {
  const { data: menu, error } = await supabase
    .from('menus')
    .insert({
      user_id: data.user_id,
      title: data.title,
      description: data.description ?? null,
      occasion: data.occasion ?? null,
      public_notes: data.public_notes ?? null,
      private_notes: data.private_notes ?? null,
      is_public: data.is_public ?? false,
      cover_image_url: data.cover_image_url ?? null,
      source_menu_id: data.source_menu_id ?? null,
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
    public_notes?: string | null;
    private_notes?: string | null;
    is_public?: boolean;
    cover_image_url?: string | null;
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

export async function getMenuRecipeImages(
  menuId: string
): Promise<{ recipe_id: string; recipe_title: string; photos: { url: string; is_primary: boolean }[] }[]> {
  const { data, error } = await supabase
    .from('menu_items')
    .select(`
      recipe_id,
      recipe:recipes!menu_items_recipe_id_fkey (
        id,
        title
      )
    `)
    .eq('menu_id', menuId);

  if (error) throw error;
  if (!data || data.length === 0) return [];

  const recipeIds = data.map((d) => d.recipe_id);

  const { data: photos, error: photosError } = await supabase
    .from('recipe_user_photos')
    .select('recipe_id, url, is_primary, sort_order')
    .in('recipe_id', recipeIds)
    .order('is_primary', { ascending: false })
    .order('sort_order', { ascending: true });

  if (photosError) throw photosError;

  const photosByRecipe: Record<string, { url: string; is_primary: boolean }[]> = {};
  for (const photo of photos ?? []) {
    if (!photosByRecipe[photo.recipe_id]) photosByRecipe[photo.recipe_id] = [];
    photosByRecipe[photo.recipe_id].push({ url: photo.url, is_primary: photo.is_primary });
  }

  return data
    .filter((d) => photosByRecipe[d.recipe_id]?.length > 0)
    .map((d) => ({
      recipe_id: d.recipe_id,
      recipe_title: (d.recipe as any)?.title ?? 'Untitled',
      photos: photosByRecipe[d.recipe_id] ?? [],
    }));
}

export async function isRecipeInMenu(
  menuId: string,
  recipeId: string,
  course: MenuCourse
): Promise<boolean> {
  const { data, error } = await supabase
    .from('menu_items')
    .select('id')
    .eq('menu_id', menuId)
    .eq('recipe_id', recipeId)
    .eq('course', course)
    .maybeSingle();

  if (error) throw error;
  return !!data;
}

export async function getMaxSortOrder(menuId: string, course: MenuCourse): Promise<number> {
  const { data, error } = await supabase
    .from('menu_items')
    .select('sort_order')
    .eq('menu_id', menuId)
    .eq('course', course)
    .order('sort_order', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  return data?.sort_order ?? -1;
}

export interface PublicMenuData {
  id: string;
  title: string;
  description: string | null;
  occasion: string | null;
  public_notes: string | null;
  cover_image_url: string | null;
  is_public: boolean;
  user_id: string;
  menu_items: (MenuItem & {
    recipe: {
      id: string;
      title: string;
      description: string | null;
      prep_minutes: number | null;
      cook_minutes: number | null;
      servings: number | null;
      image_url: string | null;
    };
  })[];
}

export async function getPublicMenu(menuId: string): Promise<PublicMenuData | null> {
  const { data, error } = await supabase
    .from('menus')
    .select(`
      id,
      title,
      description,
      occasion,
      public_notes,
      cover_image_url,
      is_public,
      user_id,
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

  return data as PublicMenuData;
}

export async function getUserSavedMenuFromSource(
  userId: string,
  sourceMenuId: string
): Promise<{ id: string } | null> {
  const { data, error } = await supabase
    .from('menus')
    .select('id')
    .eq('user_id', userId)
    .eq('source_menu_id', sourceMenuId)
    .maybeSingle();

  if (error) throw error;
  return data;
}
