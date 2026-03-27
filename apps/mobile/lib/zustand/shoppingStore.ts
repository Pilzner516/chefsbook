import { create } from 'zustand';
import { listShoppingLists, getShoppingList, createShoppingList, addShoppingItems, toggleShoppingItem, deleteShoppingList, clearCheckedItems } from '@chefsbook/db';
import type { ShoppingList, ShoppingListItem } from '@chefsbook/db';

interface ShoppingState {
  lists: ShoppingList[];
  currentList: (ShoppingList & { items: ShoppingListItem[] }) | null;
  loading: boolean;
  fetchLists: (userId: string) => Promise<void>;
  fetchList: (id: string) => Promise<void>;
  addList: (userId: string, name: string, dateRange?: { start: string; end: string }) => Promise<ShoppingList>;
  addItems: (listId: string, userId: string, items: Omit<ShoppingListItem, 'id' | 'list_id' | 'user_id'>[]) => Promise<void>;
  toggleItem: (id: string, checked: boolean) => Promise<void>;
  removeList: (id: string) => Promise<void>;
  clearChecked: (listId: string) => Promise<void>;
}

export const useShoppingStore = create<ShoppingState>((set) => ({
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

  addList: async (userId, name, dateRange) => {
    const created = await createShoppingList(userId, name, dateRange);
    set((s) => ({ lists: [created, ...s.lists] }));
    return created;
  },

  addItems: async (listId, userId, items) => {
    const saved = await addShoppingItems(listId, userId, items);
    set((s) => {
      if (s.currentList?.id !== listId) return s;
      return { currentList: { ...s.currentList, items: [...s.currentList.items, ...saved] } };
    });
  },

  toggleItem: async (id, checked) => {
    await toggleShoppingItem(id, checked);
    set((s) => {
      if (!s.currentList) return s;
      return {
        currentList: {
          ...s.currentList,
          items: s.currentList.items.map((i) => (i.id === id ? { ...i, is_checked: checked } : i)),
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
