# Prompt R — Re-import: Move to My Techniques / Move to My Recipes
## Scope: apps/web (recipe detail page, technique detail page, new conversion API route)

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
Inspect: `\d recipes` `\d techniques` `\d recipe_user_photos`
`\d technique_steps` (or equivalent — find the actual steps table name)

Read the recipe detail page and technique detail page fully before
touching anything:
- `apps/web/app/recipe/[id]/page.tsx`
- `apps/web/app/technique/[id]/page.tsx`

---

## FEATURE: Move content type via Re-import button

### Context
The Re-import button on recipe/technique detail pages currently only
offers re-fetching from the original source. We are adding a second
option: move the content to the other type (Recipe ↔ Technique).

This corrects AI misclassification at import time — e.g. a technique
video imported as a recipe can be moved to My Techniques in two clicks.

---

## UI CHANGE: Re-import dropdown

### Current behaviour
Re-import button triggers re-fetch from source immediately.

### New behaviour
Re-import button opens a small dropdown/popover with two options:

**On a Recipe detail page:**
- "🔄 Re-import from source" — existing behaviour, unchanged
- "📚 Move to My Techniques" — new

**On a Technique detail page:**
- "🔄 Re-import from source" — existing behaviour, unchanged
- "🍳 Move to My Recipes" — new

The dropdown should be a simple popover — not a full modal.
Style consistent with existing dropdowns in the app.

---

## "Move to My Techniques" flow (from Recipe)

### Step 1 — Confirmation dialog
Clicking "Move to My Techniques" opens a ChefsDialog:
- Title: *"Move to My Techniques?"*
- Message: *"This will convert this recipe into a technique. Your title,
  description, steps, notes, tags, and photos will carry over.
  Ingredients will become Tools & Equipment.
  The original recipe will be deleted. This cannot be undone."*
- Buttons: **"Yes, move it"** (primary) and **"Cancel"** (ghost)

### Step 2 — Conversion
On confirm, call `POST /api/convert/recipe-to-technique` with the
recipe ID.

### Step 3 — Redirect
On success, redirect to `/technique/{newTechniqueId}`.
Show toast: *"Moved to My Techniques ✓"*

---

## "Move to My Recipes" flow (from Technique)

### Step 1 — Confirmation dialog
Clicking "Move to My Recipes" opens a ChefsDialog:
- Title: *"Move to My Recipes?"*
- Message: *"This will convert this technique into a recipe. Your title,
  description, steps, notes, tags, and photos will carry over.
  Tools & Equipment will become Ingredients.
  The original technique will be deleted. This cannot be undone."*
- Buttons: **"Yes, move it"** (primary) and **"Cancel"** (ghost)

### Step 2 — Conversion
On confirm, call `POST /api/convert/technique-to-recipe` with the
technique ID.

### Step 3 — Redirect
On success, redirect to `/recipe/{newRecipeId}`.
Show toast: *"Moved to My Recipes ✓"*

---

## API ROUTES

### POST /api/convert/recipe-to-technique
Auth: Required. User must own the recipe.

**Logic:**

1. Fetch the full recipe from DB including:
   - title, description, steps, notes, tags, image_url,
     youtube_video_id, source_url, user_id
   - All recipe_ingredients rows
   - All recipe_user_photos rows

2. Read the techniques table schema carefully (`\d techniques`)
   to understand exact column names and required fields.

3. Create new technique record with this field mapping:
   - `title` → `title`
   - `description` → `description`
   - `notes` → `notes` (if techniques has notes — check schema)
   - `tags` → `tags`
   - `image_url` → `image_url`
   - `youtube_video_id` → `youtube_video_id` (if exists on techniques)
   - `source_url` → `source_url`
   - `user_id` → `user_id`
   - DROP: cuisine, cook_time, prep_time, servings

4. Convert recipe steps → technique process steps:
   Read the technique steps table structure first.
   Map each recipe step `instruction` → technique step equivalent.
   Preserve step order.

5. Convert recipe ingredients → technique tools/equipment:
   Read the technique tools table structure (if separate table).
   Map each ingredient `ingredient` (name) → tool name.
   Map `quantity` + `unit` → quantity/amount if the tools table
   supports it, otherwise just use the name.
   Preserve order.

6. Copy recipe_user_photos rows to the equivalent technique photos
   table (check if one exists: `\d technique_user_photos` or similar).
   If no technique photos table exists, just carry over `image_url`.

7. Delete the original recipe record (and all cascade-deleted rows).

8. Return `{ techniqueId: newTechnique.id }`

### POST /api/convert/technique-to-recipe
Auth: Required. User must own the technique.

**Logic (mirror of above):**

1. Fetch full technique including steps, tools, photos.

2. Read recipes table schema to understand required fields.

3. Create new recipe record:
   - `title` → `title`
   - `description` → `description`
   - `notes` → `notes`
   - `tags` → `tags`
   - `image_url` → `image_url`
   - `youtube_video_id` → `youtube_video_id`
   - `source_url` → `source_url`
   - `user_id` → `user_id`
   - `visibility` → `'private'` (start private, user can publish)
   - `is_complete` → false (will be re-evaluated)
   - DROP: difficulty, technique-specific fields

4. Convert technique steps → recipe steps (recipe_steps table).
   Preserve order.

5. Convert technique tools → recipe ingredients (recipe_ingredients).
   Map tool name → `ingredient` field.
   Leave `quantity` = 0, `unit` = null (user can fill in later).

6. Copy photos if technique photo table exists.

7. Run `checkRecipeCompleteness()` on the new recipe to set
   `missing_fields` and `is_complete` correctly.

8. Delete the original technique record.

9. Return `{ recipeId: newRecipe.id }`

---

## IMPORTANT: READ SCHEMAS FIRST

Before writing ANY conversion logic, run these on RPi5 and read
the output carefully:

```sql
\d techniques
\d technique_steps  (or find actual steps table name)
SELECT * FROM techniques LIMIT 1;  (see actual data shape)
```

The conversion must use exact column names. Do NOT guess field names —
this is a destructive operation (original is deleted) and wrong field
names will cause silent data loss.

---

## IMPLEMENTATION ORDER
1. Inspect all schemas on RPi5 (mandatory before any code)
2. Create `/api/convert/recipe-to-technique/route.ts`
3. Create `/api/convert/technique-to-recipe/route.ts`
4. Update recipe detail page Re-import button → dropdown
5. Update technique detail page Re-import button → dropdown
6. TypeScript check: `cd apps/web && npx tsc --noEmit` — must be clean
7. Deploy per `deployment.md`

---

## GUARDRAILS
- NEVER delete the original record until the new record is successfully
  created AND all steps/ingredients/photos are copied. Use a try/catch
  that rolls back (deletes the new record) if any step fails.
- Both API routes must verify the requesting user owns the content
- Use service role client for all DB operations
- The new recipe/technique starts as `visibility = 'private'`
- Do NOT trigger re-moderation on conversion — the content was already
  moderated at import time
- If youtube_video_id column doesn't exist on techniques table,
  skip that field and note it in DONE.md

---

## REGRESSION CHECKS — MANDATORY
1. Re-import button on recipe opens dropdown with two options ✓
2. Re-import button on technique opens dropdown with two options ✓
3. "Re-import from source" still works as before (no regression) ✓
4. Recipe → Technique: new technique has correct title, description,
   steps, and tools (from ingredients) ✓
5. Technique → Recipe: new recipe has correct title, description,
   steps, and ingredients (from tools) ✓
6. Original record is deleted after successful conversion ✓
7. Redirect goes to correct new detail page ✓
8. New recipe starts as private ✓
9. My Recipes images still show ✓
10. Search page images still show ✓

---

## WRAPUP REQUIREMENT
DONE.md entry must include:
- Schemas found for techniques, technique_steps, technique tools
- Whether youtube_video_id exists on techniques table
- Whether technique_user_photos table exists
- Rollback strategy confirmed (new record deleted on failure)
- All 10 regression checks confirmed
- tsc clean + deploy confirmed
