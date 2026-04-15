# ChefsBook — Session 41: Recipe AI Content Moderation
# Source: QA review 2026-04-10 — extend comment moderation to recipes
# Target: apps/mobile + apps/web + @chefsbook/ai + packages/db

---

## CROSS-PLATFORM REQUIREMENT
Moderation runs on every import and save on BOTH platforms.
Read .claude/agents/data-flow.md before starting.

---

## CONTEXT

Comment moderation (session 34) catches violations in user comments.
The same system must now apply to recipe content — title, description,
ingredients, steps, and notes — checked on every import and every edit save.

Violation levels mirror the comment system:
- **Clean** → save normally
- **Mild** → save but flag to admin, notify user their recipe is under review
- **Serious** → hide recipe immediately, freeze ALL user's public recipes,
  show account-under-review message, alert admin with red badge

---

## DB CHANGES

Migration `022_recipe_moderation.sql`:

```sql
CREATE TYPE recipe_moderation_status AS ENUM
  ('clean', 'flagged_mild', 'flagged_serious', 'approved', 'rejected');

ALTER TABLE recipes
  ADD COLUMN IF NOT EXISTS moderation_status recipe_moderation_status DEFAULT 'clean',
  ADD COLUMN IF NOT EXISTS moderation_flag_reason TEXT,
  ADD COLUMN IF NOT EXISTS moderation_flagged_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS moderation_reviewed_by UUID REFERENCES user_profiles(id),
  ADD COLUMN IF NOT EXISTS moderation_reviewed_at TIMESTAMPTZ;

-- Account freeze flag (separate from is_suspended which is manual admin action)
ALTER TABLE user_profiles
  ADD COLUMN IF NOT EXISTS recipes_frozen BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS recipes_frozen_reason TEXT,
  ADD COLUMN IF NOT EXISTS recipes_frozen_at TIMESTAMPTZ;

-- Hide frozen user's public recipes from all queries
-- (handled in RLS — frozen user's recipes return as private to others)
```

Apply to RPi5.

---

## MODERATION FUNCTION — @chefsbook/ai

Add `moderateRecipe()` alongside the existing `moderateComment()`:

```ts
export type RecipeModerationResult = {
  verdict: 'clean' | 'mild' | 'serious';
  reason?: string;
  flagged_fields?: string[]; // which fields triggered the flag
}

export async function moderateRecipe(recipe: {
  title: string;
  description?: string;
  ingredients?: Array<{ name: string }>;
  steps?: Array<{ instruction: string }>;
  notes?: string;
}): Promise<RecipeModerationResult>
```

Claude prompt:
```
You are a content moderator for a family-friendly recipe sharing app used by all ages.
Review the following recipe content for violations.

Rules:
- No profanity or swearing (any language)
- No hate speech or discrimination
- No sexual or violent content
- No content promoting dangerous activities
- No spam or completely off-topic content
- Must be genuinely food/cooking related
- Family-friendly — suitable for children to read

Recipe to review:
Title: "${recipe.title}"
Description: "${recipe.description ?? ''}"
Ingredients: ${recipe.ingredients?.map(i => i.name).join(', ') ?? ''}
Steps summary: ${recipe.steps?.slice(0, 3).map(s => s.instruction).join(' | ') ?? ''}
Notes: "${recipe.notes ?? ''}"

Classify as:
- "clean": no violations — normal cooking recipe
- "mild": borderline content, slightly inappropriate but not severe
  (flag for review but save the recipe, notify user)
- "serious": clear profanity, sexual/violent content, hate speech, completely
  non-food content used to post offensive material
  (hide recipe immediately, freeze user's public recipes)

Return JSON only:
{
  "verdict": "clean" | "mild" | "serious",
  "reason": "brief explanation if not clean, null if clean",
  "flagged_fields": ["title", "description"] // which fields triggered it
}
```

---

## INTEGRATION POINTS

### On every recipe import (URL, scan, speak, file, Instagram)
After the recipe object is built and before saving to DB:

```ts
const moderation = await moderateRecipe(recipe);

if (moderation.verdict === 'clean') {
  // Save normally
  await saveRecipe({ ...recipe, moderation_status: 'clean' });

} else if (moderation.verdict === 'mild') {
  // Save but flag
  await saveRecipe({
    ...recipe,
    moderation_status: 'flagged_mild',
    moderation_flag_reason: moderation.reason,
    moderation_flagged_at: new Date().toISOString(),
    visibility: 'private' // force private until reviewed
  });
  // Notify admin (insert into admin notification queue)
  await notifyAdminOfRecipeFlag(recipeId, 'mild', moderation.reason);
  // Show user message:
  // "Your recipe was saved but is under review. It will be private until approved."

} else if (moderation.verdict === 'serious') {
  // Save as hidden
  await saveRecipe({
    ...recipe,
    moderation_status: 'flagged_serious',
    moderation_flag_reason: moderation.reason,
    moderation_flagged_at: new Date().toISOString(),
    visibility: 'private'
  });
  // Freeze user's public recipes
  await freezeUserRecipes(recipe.user_id, moderation.reason);
  // Notify admin with red alert
  await notifyAdminOfRecipeFlag(recipeId, 'serious', moderation.reason);
  // Show user account-under-review message (see below)
}
```

### On every recipe edit save
Run the same moderation check. If a previously clean recipe now has a violation
after editing, apply the same rules above.

### `freezeUserRecipes()` function
```ts
// In packages/db:
export async function freezeUserRecipes(userId: string, reason: string) {
  await supabase
    .from('user_profiles')
    .update({
      recipes_frozen: true,
      recipes_frozen_reason: reason,
      recipes_frozen_at: new Date().toISOString()
    })
    .eq('id', userId);

  // Hide all their public recipes
  await supabase
    .from('recipes')
    .update({ visibility: 'private' })
    .eq('user_id', userId)
    .eq('visibility', 'public');
}
```

---

## USER-FACING MESSAGES

### Mild violation — shown after import/save:
```
┌─────────────────────────────────────────┐
│  ⚠️  Recipe Under Review               │
│                                         │
│  Your recipe has been saved privately   │
│  while our team reviews it for          │
│  compliance with our community          │
│  guidelines. This usually takes less    │
│  than 24 hours.                         │
│                                         │
│  [OK]                                   │
└─────────────────────────────────────────┘
```

### Serious violation — shown on next app/web load:
```
┌─────────────────────────────────────────┐
│  🔒 Account Under Review               │
│                                         │
│  Your account is currently under        │
│  review for a possible violation of     │
│  our Terms of Service.                  │
│                                         │
│  Your public recipes have been          │
│  temporarily hidden pending review.     │
│  You can still access your private      │
│  recipes.                               │
│                                         │
│  If you believe this is an error,       │
│  please contact support.                │
│                                         │
│  [Contact Support]    [OK]              │
└─────────────────────────────────────────┘
```

Show this banner/modal on every login until the admin unfreezes the account.

---

## ADMIN DASHBOARD — RECIPE MODERATION QUEUE

Extend the existing Recipe Moderation section in the admin dashboard:

- **Red badge "AUTO-HIDDEN — SERIOUS"**: recipe hidden, user frozen
  → Approve: restore recipe + unfreeze user's recipes
  → Reject: delete recipe, keep user frozen pending further review

- **Yellow badge "FLAGGED — MILD"**: recipe private, visible to owner only
  → Approve: restore recipe to original visibility
  → Reject: keep private, notify user

Both actions send a notification to the affected user (stored in notifications table).

---

## DEPLOYMENT

```bash
ssh rasp@rpi5-eth
cd /mnt/chefsbook/repo
git pull
cd apps/web
npm run build 2>&1 | tail -20
pm2 restart chefsbook-web
```

---

## COMPLETION CHECKLIST

- [ ] Migration 022 applied to RPi5
- [ ] `moderateRecipe()` added to @chefsbook/ai
- [ ] Moderation runs on every import path (URL, scan, speak, file, Instagram)
- [ ] Moderation runs on every recipe edit save
- [ ] Clean recipes save normally
- [ ] Mild violations: recipe saved privately, admin notified, user shown review message
- [ ] Serious violations: recipe hidden, user's public recipes frozen, admin red alert
- [ ] `freezeUserRecipes()` in packages/db
- [ ] Account-under-review banner shown to frozen users on login
- [ ] Admin dashboard recipe moderation queue updated with approve/reject
- [ ] Approve restores recipe + unfreezes user
- [ ] Mobile + web both run moderation on save
- [ ] Deployed to RPi5 and verified
- [ ] Run /wrapup to update DONE.md and CLAUDE.md
