import { create } from 'zustand';
import { listRecipes, getRecipe, createRecipe, updateRecipe, deleteRecipe, toggleFavourite, freezeUserRecipes } from '@chefsbook/db';
import type { Recipe, RecipeWithDetails, ScannedRecipe } from '@chefsbook/db';
import { moderateRecipe } from '@chefsbook/ai';

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
  addRecipe: (userId: string, recipe: ScannedRecipe & { image_url?: string | null; source_url?: string }) => Promise<RecipeWithDetails>;
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
    try {
      const recipe = await getRecipe(id);
      set({ currentRecipe: recipe, loading: false });
    } catch (err) {
      console.error('[recipeStore] fetchRecipe error:', err);
      set({ currentRecipe: null, loading: false });
    }
  },

  addRecipe: async (userId, recipe) => {
    const created = await createRecipe(userId, recipe);

    // Run AI moderation in background — don't block the save
    try {
      const modResult = await moderateRecipe({
        title: recipe.title,
        description: recipe.description,
        ingredients: recipe.ingredients?.map((i) => ({ ingredient: i.ingredient })),
        steps: recipe.steps?.map((s) => ({ instruction: s.instruction })),
        notes: recipe.notes,
      });

      if (modResult.verdict !== 'clean') {
        const updates: Partial<Recipe> = {
          moderation_status: modResult.verdict === 'mild' ? 'flagged_mild' : 'flagged_serious',
          moderation_flag_reason: modResult.reason ?? null,
          moderation_flagged_at: new Date().toISOString(),
          visibility: 'private',
        };
        await updateRecipe(created.id, updates);
        Object.assign(created, updates);

        if (modResult.verdict === 'serious') {
          await freezeUserRecipes(userId, modResult.reason ?? 'Serious recipe violation');
        }
      }
    } catch {
      // Moderation failure should not block recipe creation
    }

    set((s) => ({ recipes: [created, ...s.recipes] }));
    return created;
  },

  editRecipe: async (id, updates) => {
    const updated = await updateRecipe(id, updates);

    // Run moderation on edited content if title/description/notes changed
    if (updates.title || updates.description || updates.notes) {
      try {
        const modResult = await moderateRecipe({
          title: updates.title ?? updated.title,
          description: updates.description ?? updated.description,
          notes: updates.notes ?? updated.notes,
        });
        if (modResult.verdict !== 'clean') {
          const modUpdates: Partial<Recipe> = {
            moderation_status: modResult.verdict === 'mild' ? 'flagged_mild' : 'flagged_serious',
            moderation_flag_reason: modResult.reason ?? null,
            moderation_flagged_at: new Date().toISOString(),
            visibility: 'private',
          };
          await updateRecipe(id, modUpdates);
          Object.assign(updated, modUpdates);
          if (modResult.verdict === 'serious' && updated.user_id) {
            await freezeUserRecipes(updated.user_id, modResult.reason ?? 'Serious recipe violation');
          }
        }
      } catch { /* moderation failure should not block save */ }
    }

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
      currentRecipe: s.currentRecipe?.id === id ? { ...s.currentRecipe, is_favourite: !current } : s.currentRecipe,
    }));
  },
}));
