import { supabase } from '@chefsbook/db';
import { cleanIngredientName } from '@chefsbook/ui';

export interface AddToListItem {
  ingredient: string;
  quantity?: number | null;
  unit?: string | null;
  quantity_needed?: string | null;
  recipe_id?: string;
  recipe_name?: string;
}

export interface AddToListResult {
  inserted: number;
  merged: number;
  total: number;
}

/**
 * Add ingredients to a shopping list via the server-side pipeline.
 * Handles: name cleaning, AI purchase_unit + category, duplicate aggregation.
 */
export async function addIngredientsToList(
  listId: string,
  rawItems: AddToListItem[],
): Promise<AddToListResult> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error('Not signed in');

  // Clean ingredient names before sending
  const items = rawItems.map((item) => ({
    ...item,
    ingredient: cleanIngredientName(item.ingredient),
  }));

  const res = await fetch('/api/shopping/add-items', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${session.access_token}`,
    },
    body: JSON.stringify({ listId, items }),
  });

  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Failed to add items');
  return data as AddToListResult;
}
