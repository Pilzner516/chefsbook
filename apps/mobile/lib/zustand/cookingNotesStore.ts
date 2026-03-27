import { create } from 'zustand';

export interface CookingNote {
  id: string;
  recipeId: string;
  text: string;
  cookedAt: string; // ISO date
  createdAt: string;
}

interface CookingNotesState {
  notes: CookingNote[];
  addNote: (recipeId: string, text: string) => void;
  removeNote: (id: string) => void;
  getNotesForRecipe: (recipeId: string) => CookingNote[];
}

let nextId = 1;

export const useCookingNotesStore = create<CookingNotesState>((set, get) => ({
  notes: [],

  addNote: (recipeId, text) => {
    const now = new Date().toISOString();
    const note: CookingNote = {
      id: `note_${nextId++}_${Date.now()}`,
      recipeId,
      text,
      cookedAt: now,
      createdAt: now,
    };
    set((s) => ({ notes: [note, ...s.notes] }));
  },

  removeNote: (id) => {
    set((s) => ({ notes: s.notes.filter((n) => n.id !== id) }));
  },

  getNotesForRecipe: (recipeId) => {
    return get().notes.filter((n) => n.recipeId === recipeId);
  },
}));
