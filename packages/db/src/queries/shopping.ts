import { supabase } from '../client';
import type { ShoppingList, ShoppingListItem, ShoppingListShare, StoreCategory } from '../types';

const CAT_RULES: [RegExp, StoreCategory][] = [
  [/flour|sugar|baking|yeast|vanilla|chocolate chip|cocoa|cornstarch|molasses|shortening|powdered|brown sugar/i, 'baking'],
  [/butter|milk|cream|cheese|yogurt|egg|sour cream|buttermilk|cheddar|mozzarella|parmesan/i, 'dairy_eggs'],
  [/onion|garlic|parsley|cilantro|lemon|lime|tomato|potato|carrot|spinach|lettuce|mushroom|zucchini|broccoli|celery|cucumber|avocado|rosemary|thyme|basil|mint|shallot|ginger|scallion/i, 'produce'],
  [/chicken|beef|pork|lamb|fish|salmon|shrimp|turkey|bacon|sausage|steak|ham|tuna/i, 'meat_seafood'],
  [/salt|pepper|oregano|cumin|paprika|cinnamon|nutmeg|turmeric|bay lea|spice|seasoning|cayenne|curry|clove/i, 'spices'],
  [/pasta|rice|quinoa|oat|couscous|breadcrumb|noodle|spaghetti|lentil|barley|grain/i, 'pasta_grains'],
  [/canned|tomato paste|broth|stock|coconut milk|bean|chickpea/i, 'canned'],
  [/olive oil|vegetable oil|soy sauce|vinegar|mustard|ketchup|mayo|hot sauce|worcestershire|honey|maple syrup|oil/i, 'condiments'],
  [/bread|croissant|muffin|bagel|tortilla/i, 'bakery'],
  [/frozen|ice cream/i, 'frozen'],
];

function categorizeIngredient(name: string): StoreCategory {
  const lower = name.toLowerCase();
  for (const [pattern, cat] of CAT_RULES) {
    if (pattern.test(lower)) return cat;
  }
  return 'other';
}

export async function listShoppingLists(userId: string): Promise<ShoppingList[]> {
  // Own lists + shared lists, pinned first
  const { data: own } = await supabase
    .from('shopping_lists')
    .select('*')
    .eq('user_id', userId)
    .order('pinned', { ascending: false })
    .order('pinned_at', { ascending: false, nullsFirst: false })
    .order('updated_at', { ascending: false });

  // Shared lists
  const { data: shares } = await supabase
    .from('shopping_list_shares')
    .select('list_id')
    .eq('shared_with_user_id', userId);

  if (shares?.length) {
    const sharedIds = shares.map((s) => s.list_id);
    const { data: shared } = await supabase
      .from('shopping_lists')
      .select('*')
      .in('id', sharedIds);
    return [...(own ?? []), ...(shared ?? [])] as ShoppingList[];
  }

  return (own ?? []) as ShoppingList[];
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
    .order('is_checked')
    .order('category')
    .order('sort_order');

  return { ...(list as ShoppingList), items: (items ?? []) as ShoppingListItem[] };
}

export async function createShoppingList(
  userId: string,
  name: string,
  opts?: { storeName?: string; storeId?: string; dateRange?: { start: string; end: string } },
): Promise<ShoppingList> {
  const { data, error } = await supabase
    .from('shopping_lists')
    .insert({
      user_id: userId,
      name,
      store_name: opts?.storeName ?? null,
      store_id: opts?.storeId ?? null,
      date_range_start: opts?.dateRange?.start,
      date_range_end: opts?.dateRange?.end,
    })
    .select()
    .single();
  if (error || !data) throw new Error(error?.message ?? 'Failed to create shopping list');
  return data as ShoppingList;
}

export async function updateShoppingList(
  id: string,
  updates: Partial<Pick<ShoppingList, 'name' | 'store_name' | 'color' | 'pinned' | 'pinned_at'>>,
): Promise<ShoppingList> {
  const { data, error } = await supabase
    .from('shopping_lists')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single();
  if (error || !data) throw new Error(error?.message ?? 'Failed to update list');
  return data as ShoppingList;
}

export async function togglePin(id: string, pinned: boolean): Promise<void> {
  await supabase
    .from('shopping_lists')
    .update({
      pinned,
      pinned_at: pinned ? new Date().toISOString() : null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id);
}

export async function addShoppingItems(
  listId: string,
  userId: string,
  items: {
    ingredient: string;
    quantity?: number | null;
    unit?: string | null;
    category?: string | null;
    quantity_needed?: string | null;
    purchase_unit?: string | null;
    recipe_id?: string | null;
    recipe_name?: string | null;
    manually_added?: boolean;
    sort_order?: number;
  }[],
): Promise<ShoppingListItem[]> {
  const rows = items.map((item, i) => ({
    list_id: listId,
    user_id: userId,
    ingredient: item.ingredient,
    quantity: item.quantity ?? null,
    unit: item.unit ?? null,
    category: item.category || categorizeIngredient(item.ingredient),
    quantity_needed: item.quantity_needed ?? null,
    purchase_unit: item.purchase_unit ?? null,
    recipe_name: item.recipe_name ?? null,
    recipe_ids: item.recipe_id ? [item.recipe_id] : [],
    manually_added: item.manually_added ?? false,
    sort_order: item.sort_order ?? i,
    is_checked: false,
  }));
  const { data, error } = await supabase
    .from('shopping_list_items')
    .insert(rows)
    .select();
  if (error) throw new Error(error.message ?? 'Failed to add shopping items');

  // Touch the list's updated_at
  await supabase.from('shopping_lists').update({ updated_at: new Date().toISOString() }).eq('id', listId);

  return (data ?? []) as ShoppingListItem[];
}

export async function addManualItem(
  listId: string,
  userId: string,
  ingredient: string,
): Promise<ShoppingListItem> {
  const { data, error } = await supabase
    .from('shopping_list_items')
    .insert({
      list_id: listId,
      user_id: userId,
      ingredient,
      manually_added: true,
      is_checked: false,
      sort_order: 9999,
    })
    .select()
    .single();
  if (error || !data) throw new Error(error?.message ?? 'Failed to add item');
  return data as ShoppingListItem;
}

export async function updateShoppingItem(
  id: string,
  updates: Partial<Pick<ShoppingListItem, 'ingredient' | 'quantity_needed' | 'purchase_unit' | 'category' | 'sort_order'>>,
): Promise<void> {
  await supabase.from('shopping_list_items').update(updates).eq('id', id);
}

export async function toggleShoppingItem(id: string, checked: boolean): Promise<void> {
  await supabase
    .from('shopping_list_items')
    .update({
      is_checked: checked,
      checked_at: checked ? new Date().toISOString() : null,
    })
    .eq('id', id);
}

export async function deleteShoppingItem(id: string): Promise<void> {
  await supabase.from('shopping_list_items').delete().eq('id', id);
}

export async function deleteShoppingList(id: string): Promise<void> {
  const { error } = await supabase.from('shopping_lists').delete().eq('id', id);
  if (error) throw new Error(error.message);
}

export async function clearCheckedItems(listId: string): Promise<void> {
  await supabase
    .from('shopping_list_items')
    .delete()
    .eq('list_id', listId)
    .eq('is_checked', true);
}

export async function shareList(
  listId: string,
  sharedWithUserId: string,
  canEdit: boolean = false,
): Promise<ShoppingListShare> {
  const { data, error } = await supabase
    .from('shopping_list_shares')
    .insert({ list_id: listId, shared_with_user_id: sharedWithUserId, can_edit: canEdit })
    .select()
    .single();
  if (error || !data) throw new Error(error?.message ?? 'Failed to share list');
  return data as ShoppingListShare;
}

// --- Shared add-items pipeline (dedup + merge) ---

function parseQty(text: string | null): number | null {
  if (!text) return null;
  const match = text.match(/([\d.\/]+)/);
  if (!match) return null;
  const raw = match[1]!;
  if (raw.includes('/')) {
    const [num, den] = raw.split('/');
    return (parseFloat(num!) || 0) / (parseFloat(den!) || 1);
  }
  return parseFloat(raw) || null;
}

function formatQty(n: number, unit: string | null): string {
  const fracs: [number, string][] = [[0.25, '1/4'], [0.33, '1/3'], [0.5, '1/2'], [0.67, '2/3'], [0.75, '3/4']];
  const whole = Math.floor(n);
  const dec = Math.round((n - whole) * 100) / 100;
  const frac = fracs.find(([v]) => Math.abs(dec - v) < 0.05)?.[1];
  const numStr = frac ? (whole > 0 ? `${whole} ${frac}` : frac) : (Number.isInteger(n) ? String(n) : n.toFixed(1));
  return unit ? `${numStr} ${unit}` : numStr;
}

/**
 * Shared pipeline for adding items to a shopping list with dedup + merge.
 * Both web API and mobile call this function.
 * @param aiSuggestions - Optional AI-generated purchase units & categories keyed by lowercase ingredient name
 */
export async function addItemsWithPipeline(
  listId: string,
  userId: string,
  items: { ingredient: string; quantity?: number | null; unit?: string | null; quantity_needed?: string | null; recipe_id?: string; recipe_name?: string }[],
  aiSuggestions?: Record<string, { purchase_unit: string; store_category: string }>,
  dbClient?: typeof supabase,
): Promise<{ inserted: number; merged: number; total: number }> {
  const db = dbClient ?? supabase;
  // 1. Get existing items in list for dedup
  const { data: existing } = await db
    .from('shopping_list_items')
    .select('id, ingredient, quantity_needed, unit')
    .eq('list_id', listId);
  const existingMap = new Map((existing ?? []).map((e: any) => [e.ingredient.toLowerCase(), e]));

  // 2. Process each item: merge or insert
  const toInsert: any[] = [];
  const toUpdate: { id: string; quantity_needed: string }[] = [];
  const suggestions = aiSuggestions ?? {};

  for (let i = 0; i < items.length; i++) {
    const item = items[i]!;
    const key = item.ingredient.toLowerCase();
    const ai = suggestions[key] ?? Object.values(suggestions)[i];
    const qtyNeeded = item.quantity_needed || [item.quantity, item.unit].filter(Boolean).join(' ') || null;

    const ex = existingMap.get(key);
    if (ex && ex.id !== '__pending__') {
      // Merge with existing DB item
      const existingQty = parseQty(ex.quantity_needed);
      const newQty = parseQty(qtyNeeded);
      if (existingQty != null && newQty != null) {
        toUpdate.push({ id: ex.id, quantity_needed: formatQty(existingQty + newQty, ex.unit) });
      }
    } else if (ex && ex.id === '__pending__') {
      // Merge with pending item from same batch
      const pendingIdx = toInsert.findIndex((p) => p.ingredient.toLowerCase() === key);
      if (pendingIdx !== -1) {
        const pendingQty = parseQty(toInsert[pendingIdx]!.quantity_needed);
        const newQty = parseQty(qtyNeeded);
        if (pendingQty != null && newQty != null) {
          toInsert[pendingIdx]!.quantity_needed = formatQty(pendingQty + newQty, toInsert[pendingIdx]!.unit);
        }
      }
    } else {
      toInsert.push({
        list_id: listId,
        user_id: userId,
        ingredient: item.ingredient,
        quantity: item.quantity ?? null,
        unit: item.unit ?? null,
        quantity_needed: qtyNeeded,
        purchase_unit: ai?.purchase_unit || null,
        category: ai?.store_category || categorizeIngredient(item.ingredient),
        recipe_name: item.recipe_name ?? null,
        recipe_ids: item.recipe_id ? [item.recipe_id] : [],
        is_checked: false,
        sort_order: (existing?.length ?? 0) + i,
        manually_added: false,
      });
      // Mark in map so subsequent dupes in same batch get merged
      existingMap.set(key, { id: '__pending__', ingredient: item.ingredient, quantity_needed: qtyNeeded, unit: item.unit });
    }
  }

  // 3. Execute updates
  for (const u of toUpdate) {
    await db.from('shopping_list_items').update({ quantity_needed: u.quantity_needed }).eq('id', u.id);
  }

  // 4. Execute inserts
  if (toInsert.length > 0) {
    const { error } = await db.from('shopping_list_items').insert(toInsert);
    if (error) throw new Error(error.message);
  }

  // 5. Touch list updated_at
  await db.from('shopping_lists').update({ updated_at: new Date().toISOString() }).eq('id', listId);

  return { inserted: toInsert.length, merged: toUpdate.length, total: toInsert.length + toUpdate.length };
}

// Keep for backward compat with generateShoppingListFromMealPlans
export async function generateShoppingListFromMealPlans(
  userId: string,
  mealPlanIds: string[],
  listName?: string,
): Promise<ShoppingList & { items: ShoppingListItem[] }> {
  const { data: aggregated, error: rpcError } = await supabase.rpc('generate_shopping_list', {
    p_user_id: userId,
    p_meal_plan_ids: mealPlanIds,
  });
  if (rpcError) throw rpcError;
  const list = await createShoppingList(userId, listName ?? 'Meal plan shopping list');
  const items = (aggregated ?? []).map((row: any, i: number) => ({
    ingredient: row.ingredient,
    quantity: row.total_qty,
    unit: row.unit,
    category: null,
    recipe_ids: row.recipe_ids,
    sort_order: i,
  }));
  const savedItems = items.length
    ? await addShoppingItems(list.id, userId, items)
    : [];
  return { ...list, items: savedItems };
}
