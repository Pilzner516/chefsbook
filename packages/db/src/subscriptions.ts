import { supabase } from './client';
import type { PlanTier } from './types';

export const PLAN_LIMITS = {
  free: {
    maxRecipes: 50,
    maxScansPerMonth: 5,
    maxShoppingLists: 1,
    canPublish: false,
    canShareLink: true,
    canFollowers: false,
    canPublicProfile: false,
    maxFamilyMembers: 0,
  },
  pro: {
    maxRecipes: Infinity,
    maxScansPerMonth: Infinity,
    maxShoppingLists: 10,
    canPublish: true,
    canShareLink: true,
    canFollowers: true,
    canPublicProfile: true,
    maxFamilyMembers: 0,
  },
  family: {
    maxRecipes: Infinity,
    maxScansPerMonth: Infinity,
    maxShoppingLists: Infinity,
    canPublish: true,
    canShareLink: true,
    canFollowers: true,
    canPublicProfile: true,
    maxFamilyMembers: 6,
  },
} as const;

export function canDo(tier: PlanTier, feature: keyof typeof PLAN_LIMITS.pro): boolean {
  return !!PLAN_LIMITS[tier]?.[feature];
}

export async function isPro(userId: string): Promise<boolean> {
  const tier = await getUserPlanTier(userId);
  return tier === 'pro' || tier === 'family';
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
  if (limits.maxRecipes === Infinity) return { allowed: true };
  const { count } = await supabase
    .from('recipes')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId);
  const current = count ?? 0;
  if (current >= limits.maxRecipes) {
    return { allowed: false, reason: `Free plan limit: ${limits.maxRecipes} recipes. Upgrade to Pro for unlimited.`, limit: limits.maxRecipes, current, upgradeRequired: 'pro' };
  }
  return { allowed: true, limit: limits.maxRecipes, current };
}

export async function checkShoppingListLimit(userId: string): Promise<GateResult> {
  const tier = await getUserPlanTier(userId);
  const limits = PLAN_LIMITS[tier];
  if (limits.maxShoppingLists === Infinity) return { allowed: true };
  const { count } = await supabase
    .from('shopping_lists')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId);
  const current = count ?? 0;
  if (current >= limits.maxShoppingLists) {
    return { allowed: false, reason: `${tier.charAt(0).toUpperCase() + tier.slice(1)} plan limit: ${limits.maxShoppingLists} shopping list${limits.maxShoppingLists !== 1 ? 's' : ''}.`, limit: limits.maxShoppingLists, current, upgradeRequired: tier === 'free' ? 'pro' : 'family' };
  }
  return { allowed: true, limit: limits.maxShoppingLists, current };
}
