import { supabase } from '../client';

export interface CategoryGroup {
  id: string;
  slug: string;
  name: string;
  icon: string | null;
  sort_order: number;
}

export interface Category {
  id: string;
  group_id: string;
  parent_id: string | null;
  slug: string;
  name: string;
  sort_order: number;
}

export interface CategoryTree extends CategoryGroup {
  categories: (Category & { children: Category[] })[];
}

export async function listCategoryGroups(): Promise<CategoryGroup[]> {
  const { data } = await supabase
    .from('category_groups')
    .select('*')
    .order('sort_order');
  return (data ?? []) as CategoryGroup[];
}

export async function getCategoryTree(): Promise<CategoryTree[]> {
  const [{ data: groups }, { data: cats }] = await Promise.all([
    supabase.from('category_groups').select('*').order('sort_order'),
    supabase.from('categories').select('*').order('sort_order'),
  ]);

  const allCats = (cats ?? []) as Category[];
  const parentMap = new Map<string, Category[]>();
  const topLevel: Category[] = [];

  for (const cat of allCats) {
    if (cat.parent_id) {
      const siblings = parentMap.get(cat.parent_id) ?? [];
      siblings.push(cat);
      parentMap.set(cat.parent_id, siblings);
    } else {
      topLevel.push(cat);
    }
  }

  return ((groups ?? []) as CategoryGroup[]).map((g) => ({
    ...g,
    categories: topLevel
      .filter((c) => c.group_id === g.id)
      .map((c) => ({
        ...c,
        children: parentMap.get(c.id) ?? [],
      })),
  }));
}

export async function getCategoryBySlug(
  groupSlug: string,
  categorySlug: string,
): Promise<Category | null> {
  const { data: group } = await supabase
    .from('category_groups')
    .select('id')
    .eq('slug', groupSlug)
    .single();
  if (!group) return null;

  const { data } = await supabase
    .from('categories')
    .select('*')
    .eq('group_id', group.id)
    .eq('slug', categorySlug)
    .single();
  return (data as Category) ?? null;
}

export async function addRecipeCategory(
  recipeId: string,
  categoryId: string,
): Promise<void> {
  await supabase
    .from('recipe_categories')
    .upsert({ recipe_id: recipeId, category_id: categoryId });
}

export async function removeRecipeCategory(
  recipeId: string,
  categoryId: string,
): Promise<void> {
  await supabase
    .from('recipe_categories')
    .delete()
    .eq('recipe_id', recipeId)
    .eq('category_id', categoryId);
}

export async function getRecipeCategories(recipeId: string): Promise<Category[]> {
  const { data } = await supabase
    .from('recipe_categories')
    .select('category_id, categories(*)')
    .eq('recipe_id', recipeId);
  return (data ?? []).map((r: any) => r.categories).filter(Boolean) as Category[];
}

export async function listRecipesByCategory(
  categoryId: string,
  limit = 50,
  offset = 0,
): Promise<string[]> {
  const { data } = await supabase
    .from('recipe_categories')
    .select('recipe_id')
    .eq('category_id', categoryId)
    .range(offset, offset + limit - 1);
  return (data ?? []).map((r) => r.recipe_id);
}
