import { supabase } from '../client';
import type {
  ChefSetup,
  CookingPlan,
  CookingSession,
  StepActual,
} from '@chefsbook/ui';

export type { CookingSession };

export async function getMenuWithSteps(menuId: string) {
  const { data, error } = await supabase
    .from('menus')
    .select(`
      *,
      menu_items (
        *,
        recipe:recipes (
          id, title, description, prep_minutes, cook_minutes, servings, image_url,
          recipe_steps (
            id, step_number, instruction, timer_minutes,
            duration_min, duration_max, is_passive, uses_oven,
            oven_temp_celsius, phase, timing_confidence
          )
        )
      )
    `)
    .eq('id', menuId)
    .single();

  if (error) throw error;
  return data;
}

export async function createCookingSession(
  menuId: string,
  userId: string,
  setup: ChefSetup,
  plan: CookingPlan
): Promise<CookingSession> {
  const { data, error } = await supabase
    .from('cooking_sessions')
    .insert({
      menu_id: menuId,
      user_id: userId,
      setup,
      plan,
      status: 'briefing',
      version: 1,
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function getCookingSession(id: string): Promise<CookingSession | null> {
  const { data, error } = await supabase
    .from('cooking_sessions')
    .select('*')
    .eq('id', id)
    .single();

  if (error) {
    if (error.code === 'PGRST116') return null;
    throw error;
  }
  return data;
}

// Optimistic lock update — fails silently if version mismatch (another device updated first)
export async function updateCookingSession(
  id: string,
  updates: Partial<Pick<CookingSession, 'status' | 'current_step_index' | 'step_actuals' | 'plan' | 'completed_at'>>,
  expectedVersion: number
): Promise<{ success: boolean; session: CookingSession | null }> {
  const { data, error } = await supabase
    .from('cooking_sessions')
    .update({
      ...updates,
      version: expectedVersion + 1,
    })
    .eq('id', id)
    .eq('version', expectedVersion)
    .select()
    .single();

  if (error) {
    if (error.code === 'PGRST116') {
      return { success: false, session: null };
    }
    throw error;
  }
  return { success: true, session: data };
}

// Persist re-planned schedule after every recomputeFromOverrun call
export async function persistRecomputedPlan(
  sessionId: string,
  plan: CookingPlan,
  expectedVersion: number
): Promise<boolean> {
  const result = await updateCookingSession(sessionId, { plan }, expectedVersion);
  return result.success;
}

export function subscribeToCookingSession(
  sessionId: string,
  callback: (session: CookingSession) => void
) {
  return supabase
    .channel(`cooking-session-${sessionId}`)
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'cooking_sessions', filter: `id=eq.${sessionId}` },
      async () => {
        const session = await getCookingSession(sessionId);
        if (session) callback(session);
      }
    )
    .subscribe();
}
