import { create } from 'zustand';
import type { RecipeWithDetails } from '@chefsbook/db';

interface PinState {
  pinned: RecipeWithDetails[];
  pin: (recipe: RecipeWithDetails) => void;
  unpin: (recipeId: string) => void;
  isPinned: (recipeId: string) => boolean;
  clear: () => void;
}

export const usePinStore = create<PinState>((set, get) => ({
  pinned: [],

  pin: (recipe) => {
    if (get().pinned.some((r) => r.id === recipe.id)) return;
    set((s) => ({ pinned: [...s.pinned, recipe] }));
  },

  unpin: (recipeId) => {
    set((s) => ({ pinned: s.pinned.filter((r) => r.id !== recipeId) }));
  },

  isPinned: (recipeId) => get().pinned.some((r) => r.id === recipeId),

  clear: () => set({ pinned: [] }),
}));
