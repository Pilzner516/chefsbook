# Prompt K — Recipe Ownership: Delete/Remove + Flag Recipe + Admin Flagged Queue
## Scope: apps/web (recipe detail page, admin pages, new flag system)

---

## AGENTS TO READ FIRST (in order)
1. `.claude/agents/wrapup.md`
2. `CLAUDE.md`
3. `DONE.md`
4. `.claude/agents/testing.md`
5. `.claude/agents/feature-registry.md`
6. `.claude/agents/deployment.md`
7. `.claude/agents/ui-guardian.md`
8. `.claude/agents/data-flow.md`

Run ALL pre-flight checklists before writing a single line of code.
Inspect: `\d recipes` `\d recipe_saves` `\d admin_users`

---

## FEATURE 1 — Delete vs Remove: ownership-aware action button

### Context
Currently all users see a "Delete" button on recipe detail pages.
This is wrong — only the recipe owner should be able to delete.
Users who saved someone else's public recipe should see "Remove" instead.

### Rules
- **Recipe owner** → sees "Delete" button (existing behaviour, keep as-is)
- **Non-owner who saved the recipe** → sees "Remove" button instead of Delete
- **Non-owner who has NOT saved the recipe** → no Delete or Remove button
- **Admin** → always sees Delete regardless of ownership (existing admin override)

### Remove behaviour
When a non-owner clicks "Remove":
- Show ChefsDialog:
  - Message: *"This will remove the recipe from your My Recipes but it
    can always be added again later. Do you want to continue?"*
  - Buttons: **"Yes, remove it"** (primary) and **"No"** (ghost)
- On confirm: delete the row from `recipe_saves` for this user + recipe
- On success: redirect to `/dashboard` (My Recipes)
- Toast: *"Recipe removed from your My Recipes"*

### Delete behaviour (owner only)
Unchanged from current — keep existing Delete logic and confirmation.

### How to detect ownership
The recipe detail page already loads the recipe with `user_id`.
Compare `recipe.user_id` with the authenticated user's ID.
If they match → owner. If not → non-owner.

Also check `recipe_saves` to determine if the non-owner has saved it:
```sql
SELECT id FROM recipe_saves 
WHERE recipe_id = $1 AND user_id = $2
```

---

## FEATURE 2 — Flag Recipe button

### Placement
On the recipe detail page, next to the Public/Private badge.
Show to ALL authenticated users EXCEPT the recipe owner
(owners don't flag their own recipes).

### Button
Label: "🚩 Flag" — small, subtle, not prominent. Ghost/outline style.
Should not draw attention away from the recipe content.

### Flag dialog
Clicking opens a ChefsDialog:
- Title: *"Flag this recipe"*
- Subtitle: *"Help us keep Chefsbook safe and accurate"*
- Pill options (multi-select allowed, at least one required):
  - Inappropriate content
  - Copyright violation
  - Missing or incorrect information
  - Spam or self-promotion
  - Duplicate recipe
  - Other
- Optional text field: *"Additional details (optional)"* — max 300 chars
- Buttons: **"Submit flag"** (primary) and **"Cancel"** (ghost)

### Storage
Create a new table `recipe_flags`:
```sql
CREATE TABLE IF NOT EXISTS recipe_flags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recipe_id UUID NOT NULL REFERENCES recipes(id) ON DELETE CASCADE,
  flagged_by UUID NOT NULL REFERENCES auth.users(id),
  reasons TEXT[] NOT NULL,
  details TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'reviewed', 'dismissed')),
  reviewed_by UUID REFERENCES auth.users(id),
  reviewed_at TIMESTAMPTZ,
  admin_notes TEXT
);

CREATE INDEX idx_recipe_flags_recipe_id ON recipe_flags(recipe_id);
CREATE INDEX idx_recipe_flags_status ON recipe_flags(status);

ALTER TABLE recipe_flags ENABLE ROW LEVEL SECURITY;

-- Users can create flags and read their own
CREATE POLICY "Users can flag recipes" ON recipe_flags
  FOR INSERT TO authenticated WITH CHECK (flagged_by = auth.uid());

CREATE POLICY "Users can view own flags" ON recipe_flags
  FOR SELECT TO authenticated USING (flagged_by = auth.uid());

-- Admins can read all flags (via service role in API routes)
```

Apply migration on RPi5 and restart supabase-rest.

### After flagging
- Toast: *"Thank you for flagging this recipe. Our team will review it."*
- The flag button changes to "🚩 Flagged" (disabled, grey) for this user
  so they know their flag was received
- Do NOT immediately hide or change the recipe — admin reviews first

### Prevent duplicate flags
A user can only flag a recipe once. Check before inserting:
```sql
SELECT id FROM recipe_flags 
WHERE recipe_id = $1 AND flagged_by = $2
```
If already flagged: show toast *"You've already flagged this recipe"*
and do not open the dialog.

---

## FEATURE 3 — Admin: Flagged recipes queue

### Where
Add a "Flagged" section to the existing admin pages.
Check how the admin pages are structured first:
`apps/web/app/admin/` — find the existing admin layout and add a new tab
or section called "Flagged Recipes".

### The queue
Show a table/list of all recipes with pending flags, sorted by:
1. Flag count (most flagged first)
2. Most recently flagged

Each row shows:
- Recipe title (link to recipe detail)
- Flag count
- Reasons (aggregated — e.g. "Inappropriate (3), Spam (1)")
- Most recent flag date
- Recipe owner username
- Recipe visibility (public/private)

### Actions per flagged recipe
Each row has action buttons:
- **"Edit"** — opens the recipe detail page for direct editing by admin
- **"Make Private"** — sets visibility = 'private' immediately
- **"Hide"** — sets moderation_status = 'hidden' (removes from all public views)
- **"Delete"** — permanently deletes the recipe (with ChefsDialog confirmation)
- **"Dismiss"** — marks all flags for this recipe as 'reviewed', removes
  from the queue

### Flag detail drawer
Clicking a recipe row opens a side drawer showing:
- Full flag history: who flagged, when, which reasons, any details text
- Recipe preview (title, description, thumbnail)
- All action buttons (same as above)

### API route
Create `apps/web/app/api/admin/flags/route.ts` (GET — list pending flags)
and `apps/web/app/api/admin/flags/[id]/route.ts` (POST — take action).
Use service role client. Verify admin status before any action:
check `admin_users` table for the requesting user.

---

## FEATURE 4 — AI Proctor: automatic spam detection

### Context
The existing `moderateRecipe` function checks for inappropriate content
but does not explicitly detect spam. Spam includes: recipes that are
clearly not food-related, recipes used as ad placements, recipes with
keyword-stuffed titles/descriptions, and recipes that are duplicates
submitted repeatedly.

### What to add
In `packages/ai/src/moderateRecipe.ts`, extend the moderation prompt
to explicitly check for spam signals:
- Title or description promoting a product, service, or website
- Keyword stuffing (unnatural repetition of search terms)
- Content clearly unrelated to cooking or food
- URLs or contact information embedded in description/notes

Add a new verdict option: `'spam'` alongside existing verdicts.

When verdict is `'spam'`:
- Set `moderation_status = 'flagged'`
- Set `ai_recipe_verdict = 'spam'`
- Auto-create a `recipe_flags` row with:
  - `flagged_by` = system user (use a known admin UUID or null)
  - `reasons = ['Spam or self-promotion']`
  - `details = 'Auto-detected by AI proctor'`
  - `status = 'pending'`
- Do NOT immediately delete — queue for admin review

This means spam recipes automatically appear in the admin Flagged queue
(Feature 3) with the reason "Spam or self-promotion" and source
"AI Proctor" so admins can review and take action.

### Also apply to existing moderation triggers
The spam check runs wherever `moderateRecipe` is already called:
- At import time
- On post-publish edits (added in Prompt J)

No new triggers needed — just extend the existing function.

---

## IMPLEMENTATION ORDER
1. Apply `recipe_flags` table migration on RPi5
2. Feature 1 — Delete vs Remove (recipe detail page)
3. Feature 2 — Flag button + dialog + API route to save flag
4. Feature 3 — Admin flagged queue page + actions
5. Feature 4 — Extend moderateRecipe with spam detection + auto-flag
6. TypeScript check: `cd apps/web && npx tsc --noEmit` — must be clean
7. Deploy per `deployment.md`

---

## GUARDRAILS
- Only admins (admin_users table) can Delete recipes they don't own
- Remove only deletes from recipe_saves, never from recipes table
- Flag button never shows to recipe owner
- Admin actions (Hide, Delete) must verify admin status server-side
- Use ChefsDialog for all destructive confirmations
- Never expose flagging user identity to the recipe owner

---

## TESTING REQUIREMENTS
1. As recipe owner: see Delete button, no Flag button
2. As non-owner who saved recipe: see Remove button, Flag button
3. As non-owner who hasn't saved: no Delete/Remove, Flag button visible
4. Remove → dialog → confirm → removed from My Recipes → redirect to dashboard
5. Flag → dialog → select reasons → submit → toast → button shows "Flagged"
6. Flag same recipe twice → "already flagged" toast, no dialog
7. Admin page: flagged recipes appear with flag count and reasons
8. Admin: Make Private → recipe visibility changes immediately
9. Admin: Dismiss → recipe removed from flagged queue

---

## WRAPUP REQUIREMENT
DONE.md entry must include:
- Migration SQL applied and supabase-rest restarted confirmed
- How ownership is detected (field name used)
- Admin flagged queue route paths
- tsc clean + deploy confirmed
