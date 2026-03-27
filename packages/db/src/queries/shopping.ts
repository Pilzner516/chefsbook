import { supabase } from '../client';
import type { ShoppingList, ShoppingListItem } from '../types';

export async function listShoppingLists(userId: string): Promise<ShoppingList[]> {
  const { data } = await supabase
    .from('shopping_lists')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });
  return (data ?? []) as ShoppingList[];
}

export async function getShoppingList(
  id: string,
): Promise<(ShoppingList & { items: ShoppingListItem[] }) | null> {
  const { data: list } = await supabase
    .from('shopping_lists')
    .select('*')
    .eq('id', id)
    .single();
  if (!list) return null;

  const { data: items } = await supabase
    .from('shopping_list_items')
    .select('*')
    .eq('list_id', id)
    .order('aisle')
    .order('sort_order');

  return { ...(list as ShoppingList), items: (items ?? []) as ShoppingListItem[] };
}

export async function createShoppingList(
  userId: string,
  name: string,
  dateRange?: { start: string; end: string },
): Promise<ShoppingList> {
  const { data, error } = await supabase
    .from('shopping_lists')
    .insert({
      user_id: userId,
      name,
      date_range_start: dateRange?.start,
      date_range_end: dateRange?.end,
    })
    .select()
    .single();
  if (error || !data) throw error ?? new Error('Failed to create shopping list');
  return data as ShoppingList;
}

export async function addShoppingItems(
  listId: string,
  userId: string,
  items: Omit<ShoppingListItem, 'id' | 'list_id' | 'user_id'>[],
): Promise<ShoppingListItem[]> {
  const rows = items.map((item) => ({
    ...item,
    list_id: listId,
    user_id: userId,
  }));
  const { data, error } = await supabase
    .from('shopping_list_items')
    .insert(rows)
    .select();
  if (error) throw error;
  return (data ?? []) as ShoppingListItem[];
}

export async function toggleShoppingItem(id: string, checked: boolean): Promise<void> {
  await supabase
    .from('shopping_list_items')
    .update({ is_checked: checked })
    .eq('id', id);
}

export async function deleteShoppingList(id: string): Promise<void> {
  const { error } = await supabase.from('shopping_lists').delete().eq('id', id);
  if (error) throw error;
}

export async function clearCheckedItems(listId: string): Promise<void> {
  await supabase
    .from('shopping_list_items')
    .delete()
    .eq('list_id', listId)
    .eq('is_checked', true);
}
