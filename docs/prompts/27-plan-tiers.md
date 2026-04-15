# ChefsBook — Session 27: Plan Tiers + Promo Codes
# Depends on: Session 26 (usernames)
# Target: apps/mobile + apps/web + packages/db

---

## CROSS-PLATFORM REQUIREMENT — READ FIRST

Every feature in this session MUST be implemented on BOTH platforms:
- `apps/mobile` — React Native / Expo
- `apps/web` — Next.js

Both must be fully working before /wrapup. Do not leave either platform with a TODO.

---

## CONTEXT

Four plan tiers replace the current Free/Pro/Family structure. No Stripe integration yet —
all plan changes are DB flags only. Build with flexibility for future Stripe wiring.
Read all applicable agents before starting.

---

## TIER DEFINITIONS

```
FREE
- View public recipes (unlimited)
- View shared recipe links
- 1 shopping list
- No imports, no AI, no scanning, no saving own recipes
- Likes on any recipe
- Cannot comment (searchable account required + Chef or above)

CHEF ($4.99/mo, $3.99/mo annual)
- Everything in Free
- 75 imported/scanned/created recipes (saved public recipes: unlimited)
- AI features (auto-tag, meal plan wizard, translation, dish identification)
- 5 shopping lists
- Meal planning
- 1 personal image per recipe
- Share via link
- Social (follow, comment if searchable)
- 10 cookbooks

FAMILY ($9.99/mo, $7.99/mo annual)
- Everything in Chef
- 200 imported/scanned/created recipes (saved public recipes: unlimited)
- Up to 3 family members sharing one account (own username/pw, shared recipes/lists/plans)
- 25 cookbooks
- 5 shopping lists (shared across family)

PRO ($14.99/mo, $11.99/mo annual)
- Everything in Family (single user, not family sharing)
- Unlimited imported/scanned/created recipes
- 5 personal images per recipe
- Unlimited cookbooks
- Unlimited shopping lists
- Priority AI (flag for future model upgrade)
- PDF export of recipes
```

---

## DB CHANGES

Migration `018_plan_tiers.sql`:

```sql
-- Plan enum
CREATE TYPE plan_tier AS ENUM ('free', 'chef', 'family', 'pro');

-- Add plan fields to user_profiles
ALTER TABLE user_profiles
  ADD COLUMN IF NOT EXISTS plan plan_tier DEFAULT 'free',
  ADD COLUMN IF NOT EXISTS plan_expires_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS plan_billing_cycle TEXT DEFAULT 'monthly',
  ADD COLUMN IF NOT EXISTS promo_code_used TEXT,
  ADD COLUMN IF NOT EXISTS stripe_customer_id TEXT,
  ADD COLUMN IF NOT EXISTS stripe_subscription_id TEXT;

-- Promo codes table
CREATE TABLE IF NOT EXISTS promo_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT UNIQUE NOT NULL,
  plan plan_tier NOT NULL,
  discount_percent INTEGER DEFAULT 100,
  max_uses INTEGER,
  use_count INTEGER DEFAULT 0,
  expires_at TIMESTAMPTZ,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Family members table
CREATE TABLE IF NOT EXISTS family_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  primary_user_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  member_user_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  joined_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(primary_user_id, member_user_id)
);

-- Seed promo code
INSERT INTO promo_codes (code, plan, discount_percent, is_active)
VALUES ('pro100', 'pro', 100, true)
ON CONFLICT (code) DO NOTHING;

-- RLS
ALTER TABLE promo_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE family_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read active promo codes"
  ON promo_codes FOR SELECT USING (is_active = true);

CREATE POLICY "Family members can read their family"
  ON family_members FOR SELECT
  USING (primary_user_id = auth.uid() OR member_user_id = auth.uid());
```

Apply to RPi5.

---

## PLAN LIMITS CONSTANTS

Create `packages/shared/src/planLimits.ts`:

```ts
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
    canComment: false,
    canPDF: false,
    canMealPlan: false,
    familyMembers: 0,
    priorityAI: false,
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
    canComment: true,
    canPDF: false,
    canMealPlan: true,
    familyMembers: 0,
    priorityAI: false,
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
    canComment: true,
    canPDF: false,
    canMealPlan: true,
    familyMembers: 3,
    priorityAI: false,
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
    canComment: true,
    canPDF: true,
    canMealPlan: true,
    familyMembers: 0,
    priorityAI: true,
  },
} as const;

export type PlanTier = keyof typeof PLAN_LIMITS;

export function getPlanLimits(plan: PlanTier) {
  return PLAN_LIMITS[plan];
}

export function canDo(plan: PlanTier, feature: keyof typeof PLAN_LIMITS.free): boolean {
  const limit = PLAN_LIMITS[plan][feature];
  if (typeof limit === 'boolean') return limit;
  if (typeof limit === 'number') return limit > 0;
  return false;
}
```

---

## PROMO CODE AT SIGNUP

Add promo code field to signup (mobile + web):
- Optional field, shown after password
- Label: "Promo code (optional)"
- On submit: validate against `promo_codes` table
- If valid: apply the plan to the new user's profile, increment `use_count`
- If invalid/expired: show error "Invalid or expired promo code"
- `pro100` gives free Pro access with no expiry

---

## PLAN GATES

Wrap all gated features with a `usePlanGate` hook:

```ts
// packages/shared/src/usePlanGate.ts
export function usePlanGate(feature: keyof typeof PLAN_LIMITS.free) {
  const { user } = useAuth();
  const plan = user?.plan ?? 'free';
  const allowed = canDo(plan, feature);

  const showUpgradePrompt = () => {
    // Navigate to upgrade/plans screen
  };

  return { allowed, showUpgradePrompt, plan };
}
```

Apply gates to:
- Import/scan → `canImport`
- AI features → `canAI`
- Share button → `canShare`
- Comment → `canComment`
- PDF export → `canPDF`
- Meal planning → `canMealPlan`
- Image upload (count) → `imagesPerRecipe`
- Own recipe count → `ownRecipes`

When a gated feature is triggered by a Free user, show:

```
┌─────────────────────────────────────────┐
│  🔒 Chef Plan Required                  │
│                                         │
│  Scanning recipes requires the          │
│  Chef plan or above.                    │
│                                         │
│  [See Plans]        [Maybe Later]       │
└─────────────────────────────────────────┘
```

---

## PLANS PAGE

### Web: `/dashboard/plans`
### Mobile: Settings → "Your Plan" → Plans screen

Show all 4 tiers as cards:
- Current plan highlighted with "Current Plan" badge
- Monthly/annual toggle (show 20% savings on annual)
- Features list per tier (use PLAN_LIMITS)
- "Upgrade" / "Downgrade" button (in dev mode: instant plan change, no Stripe)
- Promo code input at bottom of page

In dev mode (no Stripe): clicking Upgrade/Downgrade immediately updates
`user_profiles.plan` in the DB. Add a banner: "Dev mode — billing not active"

---

## COMPLETION CHECKLIST

- [ ] Migration 018 applied to RPi5
- [ ] PLAN_LIMITS constants in packages/shared
- [ ] `usePlanGate` hook implemented
- [ ] Promo code field on signup (mobile + web)
- [ ] `pro100` code works and grants Pro plan
- [ ] All gated features show upgrade prompt for Free users
- [ ] Plans page on web and mobile
- [ ] Monthly/annual toggle with 20% savings shown
- [ ] Dev mode banner (no billing active)
- [ ] Own recipe count enforced (Chef: 75, Family: 200, Pro: unlimited)
- [ ] Saved public recipes: unlimited for all plans
- [ ] Run /wrapup to update DONE.md and CLAUDE.md
