import { create } from 'zustand';
import { supabase, listShoppingLists, getShoppingList, createShoppingList, addItemsWithPipeline, addManualItem, toggleShoppingItem, updateShoppingItem, deleteShoppingItem, deleteShoppingList, clearCheckedItems } from '@chefsbook/db';
import type { ShoppingList, ShoppingListItem, StoreCategory } from '@chefsbook/db';
import type { RealtimeChannel } from '@supabase/supabase-js';

let _listsChannel: RealtimeChannel | null = null;
let _itemsChannel: RealtimeChannel | null = null;

interface ShoppingState {
  lists: ShoppingList[];
  currentList: (ShoppingList & { items: ShoppingListItem[] }) | null;
  loading: boolean;
  fetchLists: (userId: string) => Promise<void>;
  fetchList: (id: string) => Promise<void>;
  subscribeLists: (userId: string) => void;
  subscribeItems: (listId: string) => void;
  unsubscribe: () => void;
  addList: (userId: string, name: string, opts?: { storeName?: string; dateRange?: { start: string; end: string } }) => Promise<ShoppingList>;
  addItemsPipeline: (
    listId: string,
    userId: string,
    items: { ingredient: string; quantity?: number | null; unit?: string | null; quantity_needed?: string | null; recipe_id?: string; recipe_name?: string }[],
    aiSuggestions?: Record<string, { purchase_unit: string; store_category: string }>,
  ) => Promise<{ inserted: number; merged: number; total: number }>;
  addManual: (listId: string, userId: string, ingredient: string) => Promise<void>;
  toggleItem: (id: string, checked: boolean) => Promise<void>;
  updateItem: (id: string, updates: Partial<Pick<ShoppingListItem, 'ingredient' | 'quantity_needed' | 'purchase_unit' | 'category' | 'sort_order'>>) => Promise<void>;
  deleteItem: (id: string) => Promise<void>;
  removeList: (id: string) => Promise<void>;
  clearChecked: (listId: string) => Promise<void>;
}

export const useShoppingStore = create<ShoppingState>((set, get) => ({
  lists: [],
  currentList: null,
  loading: false,

  fetchLists: async (userId) => {
    set({ loading: true });
    const lists = await listShoppingLists(userId);
    set({ lists, loading: false });
  },

  fetchList: async (id) => {
    set({ loading: true });
    const list = await getShoppingList(id);
    set({ currentList: list, loading: false });
  },

  subscribeLists: (userId: string) => {
    if (_listsChannel) supabase.removeChannel(_listsChannel);
    _listsChannel = supabase
      .channel(`shopping-lists-${userId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'shopping_lists', filter: `user_id=eq.${userId}` }, () => {
        get().fetchLists(userId);
      })
      .subscribe();
  },

  subscribeItems: (listId: string) => {
    if (_itemsChannel) supabase.removeChannel(_itemsChannel);
    _itemsChannel = supabase
      .channel(`shopping-items-${listId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'shopping_list_items', filter: `list_id=eq.${listId}` }, () => {
        get().fetchList(listId);
      })
      .subscribe();
  },

  unsubscribe: () => {
    if (_listsChannel) { supabase.removeChannel(_listsChannel); _listsChannel = null; }
    if (_itemsChannel) { supabase.removeChannel(_itemsChannel); _itemsChannel = null; }
  },

  addList: async (userId, name, opts) => {
    const created = await createShoppingList(userId, name, {
      storeName: opts?.storeName,
      dateRange: opts?.dateRange,
    });
    set((s) => ({ lists: [created, ...s.lists] }));
    return created;
  },

  addItemsPipeline: async (listId, userId, items, aiSuggestions) => {
    const result = await addItemsWithPipeline(listId, userId, items, aiSuggestions);
    // Refresh list to get the updated items
    const list = await getShoppingList(listId);
    set((s) => {
      if (s.currentList?.id !== listId) return { currentList: s.currentList };
      return { currentList: list };
    });
    return result;
  },

  addManual: async (listId, userId, ingredient) => {
    const item = await addManualItem(listId, userId, ingredient);
    set((s) => {
      if (!s.currentList || s.currentList.id !== listId) return s;
      return { currentList: { ...s.currentList, items: [...s.currentList.items, item] } };
    });
  },

  toggleItem: async (id, checked) => {
    await toggleShoppingItem(id, checked);
    set((s) => {
      if (!s.currentList) return s;
      return {
        currentList: {
          ...s.currentList,
          items: s.currentList.items.map((i) => (i.id === id ? { ...i, is_checked: checked, checked_at: checked ? new Date().toISOString() : null } : i)),
        },
      };
    });
  },

  updateItem: async (id, updates) => {
    await updateShoppingItem(id, updates);
    set((s) => {
      if (!s.currentList) return s;
      return {
        currentList: {
          ...s.currentList,
          items: s.currentList.items.map((i) => (i.id === id ? { ...i, ...updates } : i)),
        },
      };
    });
  },

  deleteItem: async (id) => {
    await deleteShoppingItem(id);
    set((s) => {
      if (!s.currentList) return s;
      return {
        currentList: {
          ...s.currentList,
          items: s.currentList.items.filter((i) => i.id !== id),
        },
      };
    });
  },

  removeList: async (id) => {
    await deleteShoppingList(id);
    set((s) => ({
      lists: s.lists.filter((l) => l.id !== id),
      currentList: s.currentList?.id === id ? null : s.currentList,
    }));
  },

  clearChecked: async (listId) => {
    await clearCheckedItems(listId);
    set((s) => {
      if (s.currentList?.id !== listId) return s;
      return {
        currentList: {
          ...s.currentList,
          items: s.currentList.items.filter((i) => !i.is_checked),
        },
      };
    });
  },
}));
