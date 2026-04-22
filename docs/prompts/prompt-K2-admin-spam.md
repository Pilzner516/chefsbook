# Prompt K2 — Admin Flagged Queue + AI Spam Detection
## Scope: apps/web (admin pages, moderateRecipe extension)

---

## AGENTS TO READ FIRST (in order)
1. `.claude/agents/wrapup.md`
2. `CLAUDE.md`
3. `DONE.md`
4. `.claude/agents/testing.md`
5. `.claude/agents/feature-registry.md`
6. `.claude/agents/deployment.md`
7. `.claude/agents/ui-guardian.md`
8. `.claude/agents/ai-cost.md`

Run ALL pre-flight checklists before writing a single line of code.
Inspect: `\d recipe_flags` `\d admin_users` `\d recipes`

---

## CONTEXT

Prompt K (Features 1-2) shipped the `recipe_flags` table and user-facing
flag dialog. This session adds:
- Feature 3: Admin UI to review and action flagged recipes
- Feature 4: AI proctor spam detection that auto-creates flags

---

## FEATURE 3 — Admin: Flagged recipes queue

### Where to add it
Find the existing admin pages at `apps/web/app/admin/` or `apps/web/app/dashboard/admin/`.
Check the existing admin layout — add a new "Flagged" tab or section
consistent with the existing admin UI style.

### API routes
Create:
- `GET /api/admin/flags` — list all recipes with pending flags
- `POST /api/admin/flags/[recipeId]/action` — take action on a flagged recipe

Both routes: use service role client, verify admin status via `admin_users`
table before executing any query.

#### GET /api/admin/flags
Returns recipes that have at least one flag with `status = 'pending'`,
grouped by recipe, sorted by flag count DESC then most recent flag DESC:

```sql
SELECT 
  r.id,
  r.title,
  r.visibility,
  r.moderation_status,
  u.username as owner_username,
  COUNT(f.id) as flag_count,
  ARRAY_AGG(DISTINCT f.reasons) as all_reasons,
  MAX(f.created_at) as latest_flag_at,
  r.image_url
FROM recipes r
JOIN recipe_flags f ON f.recipe_id = r.id AND f.status = 'pending'
JOIN user_profiles u ON u.id = r.user_id
GROUP BY r.id, r.title, r.visibility, r.moderation_status,
         u.username, r.image_url
ORDER BY flag_count DESC, latest_flag_at DESC;
```

Also return the full flag detail for each recipe:
```sql
SELECT f.*, u.username as flagged_by_username
FROM recipe_flags f
JOIN user_profiles u ON u.id = f.flagged_by
WHERE f.recipe_id = $1
ORDER BY f.created_at DESC;
```

#### POST /api/admin/flags/[recipeId]/action
Request body: `{ action: 'make_private' | 'hide' | 'delete' | 'dismiss', adminNotes?: string }`

Actions:
- `make_private`: SET visibility = 'private' on the recipe
- `hide`: SET moderation_status = 'hidden' on the recipe
- `delete`: DELETE the recipe (permanent — require admin confirmation)
- `dismiss`: UPDATE recipe_flags SET status = 'reviewed', reviewed_by = admin_id,
  reviewed_at = NOW(), admin_notes = adminNotes WHERE recipe_id = $1 AND status = 'pending'

All actions except `dismiss` also dismiss the flags (set to 'reviewed').

### Admin flagged queue UI

#### Queue list
A table/list showing:
- Recipe thumbnail (small, 48px)
- Recipe title (clickable — opens recipe detail in new tab)
- Owner username
- Flag count (badge)
- Reasons (aggregated pills — e.g. "Inappropriate (2)" "Spam (1)")
- Latest flag date
- Current visibility (Public/Private badge)
- Action buttons: **Make Private** | **Hide** | **Delete** | **Dismiss**

#### Flag detail drawer
Clicking anywhere on a row (not the action buttons) opens a side drawer:
- Recipe title + thumbnail
- Full flag list: flagged by @username, date, reasons, details text
- Same 4 action buttons at the bottom of the drawer
- "Source: AI Proctor" label if `flagged_by` is null (auto-detected spam)

#### Confirmation
- Delete requires ChefsDialog confirmation:
  *"This will permanently delete this recipe. This cannot be undone."*
  **Delete** / **Cancel**
- All other actions execute immediately with a success toast

#### Empty state
When no pending flags: *"No flagged recipes — the community is behaving! 🎉"*

---

## FEATURE 4 — AI Proctor: automatic spam detection

### Where
In `packages/ai/src/moderateRecipe.ts`, extend the existing moderation
function to detect spam.

### Read the existing function first
Before modifying, read the full current implementation of `moderateRecipe`.
Note the current prompt text, verdict options, and return shape.

### Changes to the prompt
Add spam detection criteria to the existing Haiku prompt:

```
Also flag as 'spam' if the content shows these signals:
- Title or description promoting a product, service, or website unrelated to cooking
- Embedded URLs, phone numbers, or contact information in description/notes
- Keyword stuffing: unnatural repetition of search terms
- Content clearly unrelated to food or cooking
- Promotional language ("buy now", "click here", "visit us at")
```

Add `'spam'` to the verdict type alongside existing options.

### Changes to the return handling
When verdict is `'spam'`:
1. Set `moderation_status = 'flagged'`
2. Set `ai_recipe_verdict = 'spam'`
3. Auto-create a `recipe_flags` row using the service role client:
   ```typescript
   await supabaseAdmin.from('recipe_flags').insert({
     recipe_id: recipeId,
     flagged_by: null,  // null = AI proctor (no human user)
     reasons: ['Spam or self-promotion'],
     details: 'Auto-detected by AI proctor',
     status: 'pending'
   });
   ```
4. Do NOT delete the recipe — queue for admin review only

### Verify null flagged_by is handled
The `recipe_flags` table was created in Prompt K with
`flagged_by UUID NOT NULL REFERENCES auth.users(id)`.
This needs to be changed to allow null for AI-generated flags:

```sql
ALTER TABLE recipe_flags 
ALTER COLUMN flagged_by DROP NOT NULL;
```

Apply this migration on RPi5 before inserting AI flags.

### Update ai-cost.md
The spam check adds no new AI calls — it extends the existing
`moderateRecipe` call. Note this in ai-cost.md.

---

## IMPLEMENTATION ORDER
1. Apply migration: `ALTER TABLE recipe_flags ALTER COLUMN flagged_by DROP NOT NULL`
   on RPi5, then `docker restart supabase-rest`
2. Feature 4 — Extend moderateRecipe with spam detection
3. Feature 3 — Admin API routes (GET flags, POST action)
4. Feature 3 — Admin flagged queue UI
5. Update ai-cost.md and feature-registry.md
6. TypeScript check: `cd apps/web && npx tsc --noEmit` — must be clean
7. Deploy per `deployment.md`

---

## GUARDRAILS
- Admin routes MUST verify admin status via admin_users table server-side
- Never expose flagging user's identity to the recipe owner
- Spam auto-flags use null for flagged_by — handle gracefully in UI
  (show "AI Proctor" instead of a username)
- Delete action is permanent — always require ChefsDialog confirmation
- The existing moderateRecipe verdict handling must not break — only extend it

---

## TESTING REQUIREMENTS
1. Admin page shows flagged recipes list with flag counts and reasons
2. Clicking a row opens the detail drawer with full flag history
3. Make Private → recipe visibility changes, flags dismissed, removed from queue
4. Dismiss → flags marked reviewed, recipe removed from queue, recipe unchanged
5. Delete → ChefsDialog → confirm → recipe deleted, removed from queue
6. Import a spammy recipe (title with "Buy now" or a URL) → appears in flagged queue
   with "AI Proctor" as source
7. Empty state shows when no pending flags

---

## WRAPUP REQUIREMENT
DONE.md entry must include:
- Migration applied (flagged_by nullable) confirmed
- Admin route paths created
- Spam detection: what was added to the moderateRecipe prompt
- tsc clean + deploy confirmed
