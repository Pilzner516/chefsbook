import { create } from 'zustand';
import { listRecipes, getRecipe, createRecipe, updateRecipe, deleteRecipe, toggleFavourite } from '@chefsbook/db';
import type { Recipe, RecipeWithDetails, ScannedRecipe } from '@chefsbook/db';

interface RecipeState {
  recipes: Recipe[];
  currentRecipe: RecipeWithDetails | null;
  loading: boolean;
  searchQuery: string;
  filterCuisine: string | null;
  filterCourse: string | null;
  setSearch: (q: string) => void;
  setFilterCuisine: (c: string | null) => void;
  setFilterCourse: (c: string | null) => void;
  fetchRecipes: (userId: string) => Promise<void>;
  fetchRecipe: (id: string) => Promise<void>;
  addRecipe: (userId: string, recipe: ScannedRecipe & { image_url?: string; source_url?: string }) => Promise<RecipeWithDetails>;
  editRecipe: (id: string, updates: Partial<Recipe>) => Promise<void>;
  removeRecipe: (id: string) => Promise<void>;
  toggleFav: (id: string, current: boolean) => Promise<void>;
}

export const useRecipeStore = create<RecipeState>((set, get) => ({
  recipes: [],
  currentRecipe: null,
  loading: false,
  searchQuery: '',
  filterCuisine: null,
  filterCourse: null,

  setSearch: (q) => set({ searchQuery: q }),
  setFilterCuisine: (c) => set({ filterCuisine: c }),
  setFilterCourse: (c) => set({ filterCourse: c }),

  fetchRecipes: async (userId) => {
    set({ loading: true });
    const { searchQuery, filterCuisine, filterCourse } = get();
    const recipes = await listRecipes({
      userId,
      search: searchQuery || undefined,
      cuisine: filterCuisine ?? undefined,
      course: filterCourse ?? undefined,
    });
    set({ recipes, loading: false });
  },

  fetchRecipe: async (id) => {
    set({ loading: true });
    const recipe = await getRecipe(id);
    set({ currentRecipe: recipe, loading: false });
  },

  addRecipe: async (userId, recipe) => {
    const created = await createRecipe(userId, recipe);
    set((s) => ({ recipes: [created, ...s.recipes] }));
    return created;
  },

  editRecipe: async (id, updates) => {
    const updated = await updateRecipe(id, updates);
    set((s) => ({
      recipes: s.recipes.map((r) => (r.id === id ? updated : r)),
      currentRecipe: s.currentRecipe?.id === id ? { ...s.currentRecipe, ...updated } : s.currentRecipe,
    }));
  },

  removeRecipe: async (id) => {
    await deleteRecipe(id);
    set((s) => ({
      recipes: s.recipes.filter((r) => r.id !== id),
      currentRecipe: s.currentRecipe?.id === id ? null : s.currentRecipe,
    }));
  },

  toggleFav: async (id, current) => {
    await toggleFavourite(id, !current);
    set((s) => ({
      recipes: s.recipes.map((r) => (r.id === id ? { ...r, is_favourite: !current } : r)),
    }));
  },
}));
