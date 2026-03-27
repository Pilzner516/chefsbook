import { create } from 'zustand';
import { getMealPlansForWeek, addMealPlan, updateMealPlan, deleteMealPlan } from '@chefsbook/db';
import type { MealPlan, MealSlot } from '@chefsbook/db';

interface MealPlanState {
  plans: MealPlan[];
  loading: boolean;
  weekStart: string;
  setWeekStart: (date: string) => void;
  fetchWeek: (userId: string, start: string, end: string) => Promise<void>;
  addPlan: (userId: string, plan: { plan_date: string; meal_slot: MealSlot; recipe_id: string | null; servings: number | null; notes: string | null }) => Promise<void>;
  editPlan: (id: string, updates: Partial<MealPlan>) => Promise<void>;
  removePlan: (id: string) => Promise<void>;
}

function getWeekEnd(start: string): string {
  const d = new Date(start);
  d.setDate(d.getDate() + 6);
  return d.toISOString().split('T')[0]!;
}

export const useMealPlanStore = create<MealPlanState>((set, get) => ({
  plans: [],
  loading: false,
  weekStart: new Date().toISOString().split('T')[0]!,

  setWeekStart: (date) => set({ weekStart: date }),

  fetchWeek: async (userId, start, end) => {
    set({ loading: true });
    const plans = await getMealPlansForWeek(userId, start, end);
    set({ plans, loading: false });
  },

  addPlan: async (userId, plan) => {
    const created = await addMealPlan(userId, plan);
    set((s) => ({ plans: [...s.plans, created] }));
  },

  editPlan: async (id, updates) => {
    const updated = await updateMealPlan(id, updates);
    set((s) => ({
      plans: s.plans.map((p) => (p.id === id ? updated : p)),
    }));
  },

  removePlan: async (id) => {
    await deleteMealPlan(id);
    set((s) => ({ plans: s.plans.filter((p) => p.id !== id) }));
  },
}));
