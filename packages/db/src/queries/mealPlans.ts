import { supabase } from '../client';
import type { MealPlan } from '../types';

export async function getMealPlansForWeek(
  userId: string,
  weekStart: string,
  weekEnd: string,
): Promise<MealPlan[]> {
  const { data } = await supabase
    .from('meal_plans')
    .select('*, recipe:recipes(id, title, image_url, prep_minutes, cook_minutes, servings)')
    .eq('user_id', userId)
    .gte('plan_date', weekStart)
    .lte('plan_date', weekEnd)
    .order('plan_date')
    .order('meal_slot');
  return (data ?? []) as MealPlan[];
}

export async function addMealPlan(
  userId: string,
  plan: Omit<MealPlan, 'id' | 'user_id' | 'created_at'>,
): Promise<MealPlan> {
  const { data, error } = await supabase
    .from('meal_plans')
    .insert({ ...plan, user_id: userId })
    .select()
    .single();
  if (error || !data) throw error ?? new Error('Failed to add meal plan');
  return data as MealPlan;
}

export async function updateMealPlan(
  id: string,
  updates: Partial<Omit<MealPlan, 'id' | 'user_id' | 'created_at'>>,
): Promise<MealPlan> {
  const { data, error } = await supabase
    .from('meal_plans')
    .update(updates)
    .eq('id', id)
    .select()
    .single();
  if (error || !data) throw error ?? new Error('Failed to update meal plan');
  return data as MealPlan;
}

export async function deleteMealPlan(id: string): Promise<void> {
  const { error } = await supabase.from('meal_plans').delete().eq('id', id);
  if (error) throw error;
}

export async function getRecipeIdsForDateRange(
  userId: string,
  startDate: string,
  endDate: string,
): Promise<string[]> {
  const { data } = await supabase
    .from('meal_plans')
    .select('recipe_id')
    .eq('user_id', userId)
    .gte('plan_date', startDate)
    .lte('plan_date', endDate)
    .not('recipe_id', 'is', null);
  return (data ?? []).map((d) => d.recipe_id).filter(Boolean) as string[];
}
