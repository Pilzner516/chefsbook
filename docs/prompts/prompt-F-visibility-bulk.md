# Prompt F — Recipe Visibility: Bulk Actions + Onboarding Hint
## Scope: apps/web only. My Recipes page, Settings page, onboarding system.

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
Inspect the recipes table schema before writing any queries: `\d recipes`
Inspect the user_profiles table schema: `\d user_profiles`

---

## FEATURE 1 — My Recipes: Make Private / Make Public in Select mode

### Context
The My Recipes page already has a "Select" mode (used for Re-Import bulk actions).
When the user enters Select mode and selects one or more recipes, a "Re-Import" button
appears. We are adding two more buttons alongside it.

### What to build
When the user is in Select mode AND has at least one recipe selected, show three
buttons in the action bar:
1. **Re-Import** (already exists — do not change)
2. **Make Private** (new)
3. **Make Public** (new)

Button placement: alongside Re-Import in the same action bar, consistent styling.

**Make Private button:**
- Only enabled if at least one selected recipe is currently public
- Clicking opens a ChefsDialog confirmation:
  - Message: *"This will make [N] recipe(s) private. They won't be visible to other
    members until you change them back to Public."*
  - Buttons: **Cancel** (ghost) / **Make Private** (primary, pomodoro red)
- On confirm: bulk UPDATE selected recipes where `visibility = 'public'`
  → set `visibility = 'private'`
- On success: toast *"[N] recipe(s) set to private"*, exit Select mode, refresh list

**Make Public button:**
- Only enabled if at least one selected recipe is currently private
- Clicking opens a ChefsDialog confirmation:
  - Message: *"This will make [N] recipe(s) public and visible to all Chefsbook members."*
  - Buttons: **Cancel** (ghost) / **Make Public** (primary, pomodoro red)
- On confirm: bulk UPDATE selected recipes where `visibility = 'private'`
  → set `visibility = 'public'`
- On success: toast *"[N] recipe(s) set to public"*, exit Select mode, refresh list

**Important:**
- Both buttons can be visible simultaneously (mixed selection of public + private recipes)
- The count [N] in the dialog reflects only the recipes that will actually change
  (e.g. if 3 selected but 2 are already private, Make Private dialog says "1 recipe")
- Use the existing recipe update mutation/endpoint — do not create a new API route
  if one already handles visibility updates. If none exists for bulk, create
  `POST /api/recipes/bulk-visibility` accepting `{ ids: string[], visibility: 'public' | 'private' }`

---

## FEATURE 2 — Settings: Make all recipes private

### What to build
In the user's Settings page, add a new section or add to an existing "Privacy" section:

**Button**: *"Make all my recipes private"*
Style: secondary/destructive — not the primary red, but visually distinct enough to
signal it's a significant action. Ghost button with red text, or outlined red.

Clicking opens a ChefsDialog confirmation:
- Title: *"Make all recipes private?"*
- Message: *"This will set all your public recipes to private. They won't be visible
  to other members until you change them back to Public. Are you sure?"*
- Buttons: **Cancel** (ghost) / **Make all private** (primary, pomodoro red)

On confirm:
- Call the bulk-visibility endpoint (or a dedicated server action) with all the user's
  recipe IDs and `visibility = 'private'`
- Alternatively, a single SQL UPDATE: `UPDATE recipes SET visibility = 'private'
  WHERE user_id = $1 AND deleted_at IS NULL`
- On success: toast *"All your recipes are now private"*
- Button should be disabled and show a spinner during the operation

---

## FEATURE 3 — YouTube embed: verify no autoplay

### What to check
Find wherever YouTube video embeds are rendered on the recipe detail page.
Verify the embed URL contains `autoplay=0` (or simply does not contain `autoplay=1`).

If `autoplay=1` is present anywhere in the embed URL, remove it.
If `autoplay=0` is not explicitly set, add it to be safe:
`https://www.youtube.com/embed/{videoId}?autoplay=0&rel=0`

This is a verification + minor fix only. No UX changes to the video embed.

---

## FEATURE 4 — First-import onboarding hint: visibility

### Context
The app already has an onboarding hint system (help bubbles). This adds one more
hint that fires once, the first time a user imports or saves a recipe.

### Trigger
Fire this hint when:
- The user successfully imports/saves their **first** recipe (import count goes from 0 to 1)
- OR on first visit to My Recipes if they already have recipes but haven't seen the hint

### Storage
Add a boolean column to user_profiles (or use the existing onboarding flags pattern
— check how existing hints are stored before creating anything new):
`visibility_hint_seen BOOLEAN DEFAULT FALSE`

If the existing system uses a different pattern (e.g. a JSONB flags column), follow
that pattern instead of adding a new column.

### The hint
Display as a dismissible banner or tooltip consistent with existing onboarding hints:

> "Your recipes are shared with the Chefsbook community by default — that's what
> makes it great. 🍳 Want to keep something just for you? You can set any recipe
> to private, or change your default in Settings."

**"Got it"** button dismisses the hint and sets `visibility_hint_seen = true`.
The hint never appears again after dismissal.

### Migration
If a new column is needed:
```sql
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS
  visibility_hint_seen BOOLEAN DEFAULT FALSE;
```
Apply on RPi5 and restart supabase-rest after migration.

---

## IMPLEMENTATION ORDER
1. Check user_profiles schema for existing onboarding flag pattern (`\d user_profiles`)
2. Apply migration for visibility_hint_seen if needed
3. Feature 3 — YouTube autoplay verification (quick check, do first)
4. Feature 1 — My Recipes bulk select Make Private / Make Public
5. Feature 2 — Settings bulk make all private
6. Feature 4 — Onboarding hint
7. TypeScript check: `cd apps/web && npx tsc --noEmit` — must be clean
8. Deploy per `deployment.md`

---

## GUARDRAILS
- Do NOT change the Re-Import button behaviour in Select mode
- Do NOT touch recipe visibility logic outside of these explicit bulk actions
- Use ChefsDialog for ALL confirmations — never native browser confirm/alert
- The bulk-visibility API route must use the service role client and verify
  the requesting user owns all recipe IDs in the payload (prevent IDOR)
- Never set `visibility = 'shared_link'` via these actions — only 'public' or 'private'
- If the user has 0 public recipes, the "Make all private" button should be disabled
  with a tooltip: *"All your recipes are already private"*

---

## TESTING REQUIREMENTS
1. Select 2 recipes (1 public, 1 private) → both Make Private and Make Public buttons appear
2. Click Make Private → dialog shows "1 recipe" (only the public one changes) → confirm → list updates
3. Click Make Public → dialog shows "1 recipe" (only the private one changes) → confirm → list updates
4. Settings: Make all private → confirmation dialog → confirm → all recipes now private → button disabled
5. YouTube embed on a video recipe: confirm no autoplay on page load
6. New user (or reset hint flag): import a recipe → onboarding hint appears → "Got it" → never appears again

---

## WRAPUP REQUIREMENT
DONE.md entry must include:
- Whether bulk-visibility used existing endpoint or new route (and path if new)
- Migration SQL applied (if any) and `docker restart supabase-rest` confirmed
- YouTube autoplay: was autoplay=1 present? What was changed?
- Onboarding hint: which storage pattern was used
- tsc clean confirmed
- Deploy confirmed
