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
  },
  pro: {
    maxRecipes: Infinity,
    maxScansPerMonth: Infinity,
    maxShoppingLists: 10,
    canPublish: true,
    canShareLink: true,
    canFollowers: true,
    canPublicProfile: true,
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
