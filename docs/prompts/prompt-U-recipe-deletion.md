# Prompt U — Recipe Deletion: Ownership Rules + Admin Nuclear Delete
## Scope: apps/web (recipe detail page, admin recipe actions, delete API route)

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

Read Prompt K in DONE.md — it added Delete vs Remove logic to the
recipe detail page. This prompt EXTENDS that work, do not duplicate it.

Inspect:
```sql
\d recipe_saves
\d recipes

-- Check current delete route
-- Find apps/web/app/api/recipes/[id]/route.ts or equivalent DELETE handler
```

---

## CONTEXT

The current Delete button allows recipe owners to delete any recipe
regardless of whether others have saved it. This is wrong.

Rules being enforced:
1. Owner cannot delete a recipe that others have saved
2. Owner CAN make it private (hides from discovery, saved users keep access)
3. Admin can always delete any recipe — removes it from ALL users' collections
4. Private recipes: owner + anyone who saved it can still see and use it

---

## FIX 1 — Owner delete: block if others have saved it

### Where
Find the recipe DELETE API route. Also find the Delete button
handler on the recipe detail page.

### Logic change in DELETE API route

Before deleting, check how many OTHER users (not the owner) have
saved this recipe:

```typescript
const { count } = await supabase
  .from('recipe_saves')
  .select('*', { count: 'exact', head: true })
  .eq('recipe_id', recipeId)
  .neq('user_id', ownerId);

if (count > 0) {
  return NextResponse.json(
    { error: 'RECIPE_HAS_SAVERS', saverCount: count },
    { status: 403 }
  );
}
```

### UI response when blocked
When the API returns `RECIPE_HAS_SAVERS`, show a ChefsDialog:
- Title: *"This recipe can't be deleted"*
- Message: *"[X] member(s) have saved this recipe to their collection.
  You can make it private so it no longer appears in search,
  but it will remain available to those who've saved it."*
- Two buttons:
  - **"Make it private"** (primary) — sets visibility = 'private',
    closes dialog, shows toast: *"Recipe is now private"*
  - **"Keep it"** (ghost) — dismisses dialog, no action

### Show saver count on recipe detail
On the recipe detail page, for the owner only, show the number of
people who have saved their recipe. This gives the owner context
about their recipe's reach.

Find where likes/comments counts are shown (♥ 0  💬 0).
Add: 🔖 X saves — next to the existing counts.

This count comes from `recipe_saves` where `user_id ≠ owner_id`.
Only visible to the recipe owner.

---

## FIX 2 — Admin nuclear delete

### Context
Admin delete is a complete removal — removes the recipe AND all
`recipe_saves` rows, meaning it disappears from every user's
My Recipes list.

### Where
Find the admin recipe management page and any existing admin delete
action (from Prompt K2 flagged queue). Also update the DELETE API
route to handle admin deletes differently.

### Admin delete flow

Add an `adminDelete` parameter to the DELETE route:
`DELETE /api/recipes/[id]?adminDelete=true`

When `adminDelete=true`:
1. Verify the requesting user is in `admin_users` table
2. Get the saver count for the confirmation message
3. Delete the recipe — cascade should handle related rows
   (recipe_saves, recipe_ingredients, recipe_steps, recipe_user_photos,
   recipe_flags, recipe_translations, recipe_comments etc.)
4. Verify cascade is set up: `\d recipe_saves` — check ON DELETE CASCADE
   If cascade is NOT set, manually delete related rows before recipe

### Admin delete confirmation dialog
Before calling the API, show ChefsDialog:
- Title: *"Permanently delete this recipe?"*
- Message: *"This will permanently delete this recipe and remove it
  from [X] member(s) who have saved it. This cannot be undone."*
  (If 0 savers: *"This will permanently delete this recipe.
  This cannot be undone."*)
- Buttons: **"Delete permanently"** (destructive red) / **"Cancel"** (ghost)

### Where to add admin delete button
On the recipe detail page: admins already see the Delete button.
The existing Delete button for admins should trigger the admin
nuclear delete flow (with saver count in the confirmation).
Non-admin owners see the restricted delete (blocked if savers exist).

### After admin delete
- Redirect to `/dashboard`
- Toast: *"Recipe permanently deleted"*
- The recipe is gone from all users' My Recipes lists immediately

---

## FIX 3 — Private recipe visibility rule

### Rule
When an owner sets a recipe to **private**:
- The recipe is removed from public search/discovery
- The recipe is removed from What's New and Following feeds
- Users who have NOT saved it can no longer find or access it
- Users who HAVE saved it (`recipe_saves` row exists) can still
  see and use it in their My Recipes

### Where to enforce
Find the recipe detail page access control. Currently it likely
checks `visibility = 'public'` OR `user_id = current_user`.

Update to: allow access if:
- `visibility = 'public'` OR
- `user_id = current_user` (owner) OR
- EXISTS a `recipe_saves` row for `recipe_id + current_user_id`

Also update the `listRecipes()` query for My Recipes dashboard —
it should show private recipes that the user has saved (not just
their own private recipes).

---

## IMPLEMENTATION ORDER
1. Inspect recipe_saves schema and DELETE cascade setup
2. FIX 1 — Update DELETE API route with saver count check
3. FIX 1 — Update recipe detail Delete button UI response
4. FIX 1 — Add saver count display to recipe detail (owner only)
5. FIX 2 — Admin nuclear delete (extend existing Delete for admins)
6. FIX 3 — Private recipe visibility for savers
7. TypeScript check: `cd apps/web && npx tsc --noEmit` — must be clean
8. Deploy per `deployment.md`

---

## GUARDRAILS
- Admin delete MUST verify admin_users table server-side — never
  trust client-side admin check for destructive operations
- Owner delete block is server-side — client UI is just UX,
  the API enforces the rule
- Private recipe access for savers must be checked server-side
  in the recipe detail API route — not just client-side
- Never expose other users' identity when showing saver count
  (just show the number, not who saved it)
- CASCADE delete must be verified before admin delete —
  no orphaned rows allowed

---

## REGRESSION CHECKS — MANDATORY
1. Owner with 0 savers: Delete works normally ✓
2. Owner with 1+ savers: Delete blocked, "Make it private" offered ✓
3. Making private: recipe disappears from search/discovery ✓
4. Making private: users who saved it still see it in My Recipes ✓
5. Admin delete: shows saver count in confirmation dialog ✓
6. Admin delete: recipe gone from all users' My Recipes after delete ✓
7. Saver count visible on recipe detail to owner only ✓
8. Non-owner, non-saver: cannot access private recipe ✓
9. Non-owner saver: can access private recipe they saved ✓
10. My Recipes images still show ✓
11. Recipe detail page still works ✓

---

## WRAPUP REQUIREMENT
DONE.md entry must include:
- Whether recipe_saves has ON DELETE CASCADE (verified via \d)
- Saver count query used
- Admin delete verification method
- All 11 regression checks confirmed
- tsc clean + deploy confirmed
