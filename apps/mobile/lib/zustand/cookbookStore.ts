import { create } from 'zustand';
import { listCookbooks, getCookbook, createCookbook, updateCookbook, deleteCookbook } from '@chefsbook/db';
import type { Cookbook } from '@chefsbook/db';

interface CookbookState {
  cookbooks: Cookbook[];
  currentCookbook: Cookbook | null;
  loading: boolean;
  fetchCookbooks: (userId: string) => Promise<void>;
  fetchCookbook: (id: string) => Promise<void>;
  addCookbook: (userId: string, cookbook: Omit<Cookbook, 'id' | 'user_id' | 'created_at'>) => Promise<Cookbook>;
  editCookbook: (id: string, updates: Partial<Cookbook>) => Promise<void>;
  removeCookbook: (id: string) => Promise<void>;
}

export const useCookbookStore = create<CookbookState>((set) => ({
  cookbooks: [],
  currentCookbook: null,
  loading: false,

  fetchCookbooks: async (userId) => {
    set({ loading: true });
    const cookbooks = await listCookbooks(userId);
    set({ cookbooks, loading: false });
  },

  fetchCookbook: async (id) => {
    set({ loading: true });
    const cookbook = await getCookbook(id);
    set({ currentCookbook: cookbook, loading: false });
  },

  addCookbook: async (userId, cookbook) => {
    const created = await createCookbook(userId, cookbook);
    set((s) => ({ cookbooks: [...s.cookbooks, created] }));
    return created;
  },

  editCookbook: async (id, updates) => {
    const updated = await updateCookbook(id, updates);
    set((s) => ({
      cookbooks: s.cookbooks.map((c) => (c.id === id ? updated : c)),
      currentCookbook: s.currentCookbook?.id === id ? updated : s.currentCookbook,
    }));
  },

  removeCookbook: async (id) => {
    await deleteCookbook(id);
    set((s) => ({
      cookbooks: s.cookbooks.filter((c) => c.id !== id),
      currentCookbook: s.currentCookbook?.id === id ? null : s.currentCookbook,
    }));
  },
}));
