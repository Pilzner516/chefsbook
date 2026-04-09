import { supabase } from './client';
import type { PlanTier } from './types';

export const PLAN_LIMITS = {
  free: {
    ownRecipes: 0,
    savedPublicRecipes: Infinity,
    shoppingLists: 1,
    cookbooks: 0,
    imagesPerRecipe: 0,
    canImport: false,
    canAI: false,
    canShare: false,
    canFollow: false,
    canComment: false,
    canPDF: false,
    canMealPlan: false,
    familyMembers: 0,
    priorityAI: false,
    // Legacy aliases
    maxRecipes: 0,
    maxScansPerMonth: 0,
    maxShoppingLists: 1,
    maxPhotosPerRecipe: 0,
  },
  chef: {
    ownRecipes: 75,
    savedPublicRecipes: Infinity,
    shoppingLists: 5,
    cookbooks: 10,
    imagesPerRecipe: 1,
    canImport: true,
    canAI: true,
    canShare: true,
    canFollow: true,
    canComment: true,
    canPDF: false,
    canMealPlan: true,
    familyMembers: 0,
    priorityAI: false,
    maxRecipes: 75,
    maxScansPerMonth: Infinity,
    maxShoppingLists: 5,
    maxPhotosPerRecipe: 1,
  },
  family: {
    ownRecipes: 200,
    savedPublicRecipes: Infinity,
    shoppingLists: 5,
    cookbooks: 25,
    imagesPerRecipe: 1,
    canImport: true,
    canAI: true,
    canShare: true,
    canFollow: true,
    canComment: true,
    canPDF: false,
    canMealPlan: true,
    familyMembers: 3,
    priorityAI: false,
    maxRecipes: 200,
    maxScansPerMonth: Infinity,
    maxShoppingLists: 5,
    maxPhotosPerRecipe: 1,
  },
  pro: {
    ownRecipes: Infinity,
    savedPublicRecipes: Infinity,
    shoppingLists: Infinity,
    cookbooks: Infinity,
    imagesPerRecipe: 5,
    canImport: true,
    canAI: true,
    canShare: true,
    canFollow: true,
    canComment: true,
    canPDF: true,
    canMealPlan: true,
    familyMembers: 0,
    priorityAI: true,
    maxRecipes: Infinity,
    maxScansPerMonth: Infinity,
    maxShoppingLists: Infinity,
    maxPhotosPerRecipe: 5,
  },
} as const;

export type PlanLimitKey = keyof typeof PLAN_LIMITS.free;

export function getPlanLimits(plan: PlanTier) {
  return PLAN_LIMITS[plan] ?? PLAN_LIMITS.free;
}

export function canDo(tier: PlanTier, feature: PlanLimitKey): boolean {
  const limit = PLAN_LIMITS[tier]?.[feature];
  if (typeof limit === 'boolean') return limit;
  if (typeof limit === 'number') return limit > 0;
  return false;
}

export async function isPro(userId: string): Promise<boolean> {
  const tier = await getUserPlanTier(userId);
  return tier === 'pro';
}

export interface GateResult {
  allowed: boolean;
  reason?: string;
  limit?: number;
  current?: number;
  upgradeRequired?: PlanTier;
}

export async function getUserPlanTier(userId: string): Promise<PlanTier> {
  const { data } = await supabase
    .from('user_profiles')
    .select('plan_tier')
    .eq('id', userId)
    .single();
  return (data?.plan_tier as PlanTier) ?? 'free';
}

export async function checkRecipeLimit(userId: string): Promise<GateResult> {
  const tier = await getUserPlanTier(userId);
  const limits = PLAN_LIMITS[tier];
  if (limits.ownRecipes === Infinity) return { allowed: true };
  if (limits.ownRecipes === 0) return { allowed: false, reason: 'Free plan cannot create recipes. Upgrade to Chef.', limit: 0, current: 0, upgradeRequired: 'chef' };
  const { count } = await supabase
    .from('recipes')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId);
  const current = count ?? 0;
  if (current >= limits.ownRecipes) {
    return { allowed: false, reason: `${tier} plan limit: ${limits.ownRecipes} recipes.`, limit: limits.ownRecipes as number, current, upgradeRequired: tier === 'chef' ? 'family' : 'pro' };
  }
  return { allowed: true, limit: limits.ownRecipes as number, current };
}

export async function checkShoppingListLimit(userId: string): Promise<GateResult> {
  const tier = await getUserPlanTier(userId);
  const limits = PLAN_LIMITS[tier];
  if (limits.shoppingLists === Infinity) return { allowed: true };
  const { count } = await supabase
    .from('shopping_lists')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId);
  const current = count ?? 0;
  if (current >= limits.shoppingLists) {
    return { allowed: false, reason: `${tier} plan limit: ${limits.shoppingLists} shopping list${limits.shoppingLists !== 1 ? 's' : ''}.`, limit: limits.shoppingLists as number, current, upgradeRequired: 'pro' };
  }
  return { allowed: true, limit: limits.shoppingLists as number, current };
}

// Promo code validation
export async function validatePromoCode(code: string): Promise<{ valid: boolean; plan?: PlanTier; error?: string }> {
  const { data } = await supabase
    .from('promo_codes')
    .select('*')
    .eq('code', code.toLowerCase().trim())
    .eq('is_active', true)
    .single();

  if (!data) return { valid: false, error: 'Invalid or expired promo code' };
  if (data.expires_at && new Date(data.expires_at) < new Date()) return { valid: false, error: 'This promo code has expired' };
  if (data.max_uses && data.use_count >= data.max_uses) return { valid: false, error: 'This promo code has reached its usage limit' };

  return { valid: true, plan: data.plan as PlanTier };
}

export async function applyPromoCode(userId: string, code: string): Promise<PlanTier> {
  const result = await validatePromoCode(code);
  if (!result.valid || !result.plan) throw new Error(result.error ?? 'Invalid promo code');

  // Update user plan
  await supabase.from('user_profiles').update({ plan_tier: result.plan, promo_code_used: code }).eq('id', userId);
  // Increment use count (best-effort, no RPC needed)
  try {
    const { data: promo } = await supabase.from('promo_codes').select('use_count').eq('code', code.toLowerCase().trim()).single();
    if (promo) await supabase.from('promo_codes').update({ use_count: (promo.use_count ?? 0) + 1 }).eq('code', code.toLowerCase().trim());
  } catch {}

  return result.plan;
}

// Dev mode plan change (no Stripe)
export async function devChangePlan(userId: string, plan: PlanTier): Promise<void> {
  const { error } = await supabase.from('user_profiles').update({ plan_tier: plan }).eq('id', userId);
  if (error) throw error;
}
