# Prompt: ChefsBook — Personal Versions + Ask Sous Chef

## LAUNCH PROMPT (paste this into Claude Code to start the session)

```
Read and execute docs/prompts/sous-chef-personal-versions.md fully and autonomously, from pre-flight through deployment and /wrapup. Do not stop for questions unless you hit a genuine blocker.
```

---

## TYPE: FEATURE — WEB + MOBILE

## Overview

Users who have saved a public recipe to My Recipes can ask the Sous Chef for help
improving it after the fact. The Sous Chef takes their feedback and regenerates the
recipe. The result is saved as a private "personal version" that lives inside the
original recipe — invisible to everyone else, exclusive to the user who created it.

Each user gets a maximum of 2 personal version slots per saved recipe (V1 and V2).
Each slot can be regenerated in place via Sous Chef at any time. A version can be
promoted to a standalone shareable recipe (freeing the slot) or deleted (also freeing
the slot). Sharing the original recipe always shares the original only — personal
versions never surface publicly.

A modifier pill row on the original recipe shows up to 3 users who have created
personal versions of it (purple pills, rolling window — oldest drops at 4th).

---

## Agent files to read — ALL of these, in order, before writing a single line of code

- `.claude/agents/wrapup.md`
- `.claude/agents/testing.md`
- `.claude/agents/feature-registry.md`
- `.claude/agents/ui-guardian.md`
- `.claude/agents/data-flow.md`
- `.claude/agents/deployment.md`
- `.claude/agents/ai-cost.md`

Run ALL pre-flight checklists before writing any code.

---

## Pre-flight: before writing any code

1. Confirm next migration number from DONE.md — expected 074 but verify
2. Run `\d recipes` on RPi5 — confirm current columns before adding new ones
3. Run `\d recipe_saves` on RPi5 — confirm structure before writing save-check queries
4. Run `\d recipe_modifiers` on RPi5 — confirm it does NOT exist yet before creating
5. Check `packages/db/src/subscriptions.ts` — note existing PLAN_LIMITS structure
   before adding the new `personalVersionsPerRecipe` limit
6. Check `apps/web/app/recipe/[id]/page.tsx` — understand current attribution pill
   row rendering before modifying it
7. Check `apps/mobile/app/recipe/[id].tsx` — same for mobile attribution row
8. Check `packages/ai/src/` — note existing exports before adding new function
9. Confirm `logAiCall()` import path — used for AI usage tracking
10. Confirm `ChefsDialog` import path on web and mobile — used for delete confirmation

---

## Architecture

```
User opens a saved recipe (has a recipe_saves row for it)
        ↓
Recipe detail shows "Ask Sous Chef" button (non-owner only)
        ↓
User taps — modal opens with:
  · Pill selector: Original | V1 (if exists) | V2 (if exists)
  · When both slots full: Original pill hidden, only V1 and V2 shown
  · Feedback textarea: "What did the Sous Chef miss?"
        ↓
POST /api/recipes/[id]/ask-sous-chef
  · Fetches base recipe content (original, V1, or V2 depending on pill selected)
  · Calls Sonnet with recipe content + user feedback
  · Returns regenerated recipe (title, description, ingredients, steps, notes)
  · Does NOT save yet — returns for user review
        ↓
User reviews regenerated content in modal
  · "Save" button → POST /api/recipes/[id]/personal-versions (if baseVersion=original)
               OR → PUT  /api/personal-versions/[versionId] (if baseVersion=v1 or v2)
        ↓
Version saved as private recipe record (is_personal_version=true)
Auto-assigned to next empty slot (V1 first, then V2), silently
User added to recipe_modifiers for the original recipe
        ↓
Recipe detail now shows version tab switcher (only to this user)
Modifier pill appears on original recipe's attribution row (visible to all)
```

---

## Database migration — 074

Confirm number from DONE.md before applying. Apply on RPi5 via psql.

```sql
-- Migration 074: Personal versions + recipe modifiers

-- Add personal version columns to recipes table
ALTER TABLE recipes
  ADD COLUMN IF NOT EXISTS is_personal_version BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS personal_version_of UUID REFERENCES recipes(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS personal_version_slot INTEGER CHECK (personal_version_slot IN (1, 2));

-- Index for fetching personal versions of a recipe by owner
CREATE INDEX IF NOT EXISTS idx_recipes_personal_version_of
  ON recipes(personal_version_of, user_id)
  WHERE is_personal_version = TRUE;

-- Ensure max 2 personal versions per user per original recipe
CREATE UNIQUE INDEX IF NOT EXISTS idx_recipes_personal_version_slot
  ON recipes(personal_version_of, user_id, personal_version_slot)
  WHERE is_personal_version = TRUE;

-- recipe_modifiers: tracks who has created a personal version of a recipe
-- Used to render the modifier pill row on the original recipe
CREATE TABLE IF NOT EXISTS recipe_modifiers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recipe_id UUID NOT NULL REFERENCES recipes(id) ON DELETE CASCADE,
  modifier_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  modifier_username TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(recipe_id, modifier_user_id)
);

CREATE INDEX IF NOT EXISTS idx_recipe_modifiers_recipe_id
  ON recipe_modifiers(recipe_id, created_at);

ALTER TABLE recipe_modifiers ENABLE ROW LEVEL SECURITY;

-- Anyone can read modifier pills (they display on public recipe pages)
CREATE POLICY "Public read recipe_modifiers"
  ON recipe_modifiers FOR SELECT USING (TRUE);

-- Only the modifier themselves can insert/delete their own row
CREATE POLICY "Modifier owns their row"
  ON recipe_modifiers FOR ALL USING (modifier_user_id = auth.uid());
```

After applying: `docker restart supabase-rest`

Verify:
```sql
-- Confirm columns exist
SELECT column_name, data_type FROM information_schema.columns
WHERE table_name = 'recipes'
AND column_name IN ('is_personal_version', 'personal_version_of', 'personal_version_slot');

-- Confirm recipe_modifiers table
SELECT COUNT(*) FROM recipe_modifiers;
```

---

## Public query guard — CRITICAL

Personal versions must NEVER appear in any public query. Add the following filter
to EVERY query that returns recipes for public consumption:

```typescript
.eq('is_personal_version', false)
```

Files that MUST be updated:

1. `packages/db/src/queries/recipes.ts`
   - `listPublicRecipes()` — add `.eq('is_personal_version', false)`
   - `listRecipes()` (user's own My Recipes list) — add `.eq('is_personal_version', false)`
     Personal versions do NOT appear in the user's recipe list; only accessible via
     the original recipe detail page.
   - Any other query returning recipe arrays

2. `supabase/migrations/[next].sql` — RPi5 RPC updates:
   Add `AND r.is_personal_version = FALSE` to both RPCs:
   - `search_recipes` function
   - `get_public_feed` function

   Apply after migration 074:
   ```sql
   -- Patch search_recipes to exclude personal versions
   CREATE OR REPLACE FUNCTION search_recipes(...)
   -- [copy existing function body from RPi5, add AND r.is_personal_version = FALSE
   --  to the WHERE clause of the public results branch]

   -- Patch get_public_feed similarly
   CREATE OR REPLACE FUNCTION get_public_feed(...)
   -- [add AND r.is_personal_version = FALSE]
   ```
   Read the existing function bodies from RPi5 before rewriting them:
   ```bash
   ssh rasp@rpi5-eth "psql postgresql://supabase_admin:<pw>@localhost:5432/postgres \
     -c '\sf search_recipes'"
   ssh rasp@rpi5-eth "psql postgresql://supabase_admin:<pw>@localhost:5432/postgres \
     -c '\sf get_public_feed'"
   ```

---

## Plan gating

Ask Sous Chef for personal versions is **Chef plan and above** (same tier as all AI
import features). Free users who have saved a recipe do NOT see the Ask Sous Chef
button.

Add to `packages/db/src/subscriptions.ts` PLAN_LIMITS:
```typescript
personalVersionsPerRecipe: {
  free: 0,
  chef: 2,
  family: 2,
  pro: 2,
}
```

Check the gate in the API route and in the UI button render using the existing
`canUseFeature()` / `PLAN_LIMITS` pattern.

---

## New DB query functions — packages/db/src/queries/recipes.ts

Add these functions. Follow the existing patterns in the file exactly.

```typescript
// Fetch the current user's personal versions of a recipe
// Returns [] if user has no versions or is not authenticated
export async function getPersonalVersions(
  originalRecipeId: string,
  userId: string
): Promise<Recipe[]> {
  const { data, error } = await supabase
    .from('recipes')
    .select('*, recipe_ingredients(*), recipe_steps(*)')
    .eq('personal_version_of', originalRecipeId)
    .eq('user_id', userId)
    .eq('is_personal_version', true)
    .order('personal_version_slot', { ascending: true });
  if (error) throw error;
  return data ?? [];
}

// Count how many personal version slots a user has used for a recipe
export async function getPersonalVersionCount(
  originalRecipeId: string,
  userId: string
): Promise<number> {
  const { count, error } = await supabase
    .from('recipes')
    .select('*', { count: 'exact', head: true })
    .eq('personal_version_of', originalRecipeId)
    .eq('user_id', userId)
    .eq('is_personal_version', true);
  if (error) throw error;
  return count ?? 0;
}

// Fetch modifier pills for a recipe
// Returns all modifiers ordered by created_at ASC (oldest first)
// UI displays only the last 3 (most recent)
export async function getRecipeModifiers(
  recipeId: string
): Promise<{ modifier_user_id: string; modifier_username: string; created_at: string }[]> {
  const { data, error } = await supabase
    .from('recipe_modifiers')
    .select('modifier_user_id, modifier_username, created_at')
    .eq('recipe_id', recipeId)
    .order('created_at', { ascending: true });
  if (error) throw error;
  return data ?? [];
}

// Upsert a modifier entry (called when a personal version is created)
export async function upsertRecipeModifier(
  recipeId: string,
  modifierUserId: string,
  modifierUsername: string
): Promise<void> {
  const { error } = await supabase
    .from('recipe_modifiers')
    .upsert(
      { recipe_id: recipeId, modifier_user_id: modifierUserId, modifier_username: modifierUsername },
      { onConflict: 'recipe_id,modifier_user_id' }
    );
  if (error) throw error;
}

// Remove a modifier entry — called when a user deletes ALL their personal versions
export async function removeRecipeModifier(
  recipeId: string,
  modifierUserId: string
): Promise<void> {
  const { error } = await supabase
    .from('recipe_modifiers')
    .delete()
    .eq('recipe_id', recipeId)
    .eq('modifier_user_id', modifierUserId);
  if (error) throw error;
}
```

Export all new functions from `packages/db/src/index.ts`.

---

## New AI function — packages/ai/src/askSousChef.ts

```typescript
import { callClaude } from './callClaude';
import type { Recipe } from '@chefsbook/db';

export interface SousChefFeedbackResult {
  title: string;
  description: string;
  ingredients: Array<{ name: string; quantity: string; unit: string; group?: string }>;
  steps: Array<{ instruction: string; duration_minutes?: number }>;
  notes?: string;
}

export async function askSousChef(
  recipe: Recipe & { ingredients: any[]; steps: any[] },
  userFeedback: string
): Promise<SousChefFeedbackResult> {
  const ingredientList = recipe.ingredients
    .map(i => `${i.quantity ?? ''} ${i.unit ?? ''} ${i.name}`.trim())
    .join('\n');

  const stepList = recipe.steps
    .map((s, idx) => `${idx + 1}. ${s.instruction}`)
    .join('\n');

  const prompt = `You are a professional recipe editor. The user has a recipe that was
AI-generated and they have identified something that is missing or incorrect.

CURRENT RECIPE:
Title: ${recipe.title}
Description: ${recipe.description ?? ''}

Ingredients:
${ingredientList}

Steps:
${stepList}

Notes: ${recipe.notes ?? 'none'}

USER FEEDBACK:
${userFeedback}

Your task: Produce a corrected and improved version of this recipe that incorporates
the user's feedback fully. Keep everything that is already correct. Only change what
the feedback identifies as wrong or missing.

Respond ONLY with valid JSON — no preamble, no markdown fences. Schema:
{
  "title": "string",
  "description": "string (2-3 sentences)",
  "ingredients": [
    { "name": "string", "quantity": "string", "unit": "string", "group": "string or null" }
  ],
  "steps": [
    { "instruction": "string", "duration_minutes": number or null }
  ],
  "notes": "string or null"
}`;

  const raw = await callClaude(prompt, undefined, 'sonnet');
  const result = JSON.parse(raw) as SousChefFeedbackResult;
  return result;
}
```

Export from `packages/ai/src/index.ts`.

---

## API routes

### POST /api/recipes/[id]/ask-sous-chef

File: `apps/web/app/api/recipes/[id]/ask-sous-chef/route.ts`

**Purpose:** Takes user feedback + base version selector, calls Sonnet, returns
regenerated recipe content. Does NOT save — returns content for user review.

**Auth:** Required. User must have a `recipe_saves` row for this recipe (or be the
recipe owner). Chef+ plan required.

**Request body:**
```typescript
{
  feedback: string;           // what the user says is missing/wrong
  baseVersion: 'original' | 'v1' | 'v2';  // which recipe to base regeneration on
}
```

**Response:**
```typescript
{
  regenerated: SousChefFeedbackResult;  // title, description, ingredients, steps, notes
}
```

**Logic:**
1. Auth check — 401 if not authenticated
2. Plan check — 403 with `{ error: 'PLAN_REQUIRED', requiredPlan: 'chef' }` if Free tier
3. Fetch the original recipe by `params.id`
4. If `baseVersion === 'original'`: use original recipe content
5. If `baseVersion === 'v1'` or `'v2'`: fetch the user's personal version in that slot
   — 404 if that slot is empty
6. Call `askSousChef(recipe, feedback)` from `@chefsbook/ai`
7. Log via `logAiCall({ action: 'ask_sous_chef', model: 'sonnet', recipeId: params.id })`
8. Return `{ regenerated }`

---

### POST /api/recipes/[id]/personal-versions

File: `apps/web/app/api/recipes/[id]/personal-versions/route.ts`

**Purpose:** Creates a new personal version in the next available slot.

**Auth:** Required. User must have a `recipe_saves` row for this recipe. Chef+ plan.

**Request body:** Full recipe content from the Sous Chef review:
```typescript
{
  title: string;
  description: string;
  ingredients: Array<{ name: string; quantity: string; unit: string; group?: string }>;
  steps: Array<{ instruction: string; duration_minutes?: number }>;
  notes?: string;
}
```

**Response:** `{ version: Recipe }`

**Logic:**
1. Auth + plan check
2. Confirm user has `recipe_saves` row for `params.id` — 403 if not
3. Count existing personal versions: `getPersonalVersionCount(params.id, userId)`
4. If count >= 2: return 409 `{ error: 'SLOTS_FULL' }`
5. Determine slot: if count === 0 → slot 1; if count === 1 → slot 2
6. Auto-name: `"My Version ${slot}"` (user can rename later)
7. Create recipe record:
   ```typescript
   {
     user_id: userId,
     title: body.title,
     description: body.description,
     notes: body.notes,
     visibility: 'private',
     is_personal_version: true,
     personal_version_of: params.id,
     personal_version_slot: slot,
     original_submitter_id: userId,
     original_submitter_username: currentUsername,
     // Copy cuisine/course/tags from original recipe
   }
   ```
8. Insert ingredients and steps for the new version
9. `upsertRecipeModifier(params.id, userId, username)`
10. Return `{ version }`

---

### PUT /api/personal-versions/[versionId]

File: `apps/web/app/api/personal-versions/[versionId]/route.ts`

**Purpose:** Updates a personal version in place (content update from Sous Chef,
or a title/name rename).

**Auth:** Required. Version must be owned by current user.

**Request body:**
```typescript
{
  title?: string;
  description?: string;
  ingredients?: Array<{ name: string; quantity: string; unit: string; group?: string }>;
  steps?: Array<{ instruction: string; duration_minutes?: number }>;
  notes?: string;
}
```

**Logic:**
1. Auth check
2. Fetch version — confirm `is_personal_version = true` AND `user_id = current user`
   — 403 if not
3. Update recipe fields (title, description, notes if provided)
4. If ingredients provided: `replaceIngredients(versionId, ingredients)`
5. If steps provided: `replaceSteps(versionId, steps)`
6. Return updated version

---

### DELETE /api/personal-versions/[versionId]

File: `apps/web/app/api/personal-versions/[versionId]/route.ts` (add DELETE handler)

**Purpose:** Deletes a personal version, freeing its slot. Removes modifier pill
if this was the user's last version of the original recipe.

**Auth:** Required. Version must be owned by current user.

**Logic:**
1. Auth check
2. Fetch version — confirm ownership — 403 if not
3. Store `original_recipe_id = version.personal_version_of`
4. Delete all child rows: recipe_ingredients, recipe_steps, recipe_user_photos
   for the version (cascade should handle this — verify ON DELETE CASCADE is set)
5. Delete the version recipe record
6. Check remaining count: `getPersonalVersionCount(original_recipe_id, userId)`
7. If count === 0: `removeRecipeModifier(original_recipe_id, userId)`
8. Return `{ success: true }`

---

### POST /api/personal-versions/[versionId]/promote

File: `apps/web/app/api/personal-versions/[versionId]/route.ts` (add promote handler
as a nested route or use the POST method with `action` body param)

**Purpose:** Promotes a personal version to a standalone shareable recipe.
Frees the slot. Removes modifier pill if this was the user's last version.

**Auth:** Required. Version must be owned by current user.

**Logic:**
1. Auth check
2. Fetch version + its ingredients + steps — confirm ownership
3. Fetch original recipe for attribution note
4. Update the version record to become standalone:
   ```typescript
   {
     is_personal_version: false,
     personal_version_of: null,
     personal_version_slot: null,
     // Append attribution note to description:
     description: version.description +
       `\n\nOriginally a version of "${originalRecipe.title}" by @${originalRecipe.original_submitter_username}.`,
     visibility: 'private',  // user decides when/if to publish
   }
   ```
5. Check remaining versions after this promotion:
   `getPersonalVersionCount(original_recipe_id, userId)` — will be 0 or 1
6. If 0: `removeRecipeModifier(original_recipe_id, userId)`
7. Return `{ promotedRecipe }` — client navigates to the new standalone recipe

---

### GET /api/recipes/[id]/personal-versions

File: `apps/web/app/api/recipes/[id]/personal-versions/route.ts`

**Purpose:** Returns the current user's personal versions of a recipe.
Called on recipe detail page load when user has a recipe_saves row.

**Auth:** Required.

**Response:** `{ versions: Recipe[] }` — array of 0, 1, or 2 versions ordered by slot

---

## Orphan cascade — original recipe deleted

Modify the existing `DELETE /api/recipes/[id]` route to handle personal versions
before deletion completes.

Add this logic BEFORE the recipe is deleted:

```typescript
// Find all users who have personal versions of this recipe
const { data: orphanedVersions } = await supabaseAdmin
  .from('recipes')
  .select('id, user_id, personal_version_slot')
  .eq('personal_version_of', recipeId)
  .eq('is_personal_version', true)
  .order('personal_version_slot', { ascending: true });

if (orphanedVersions && orphanedVersions.length > 0) {
  // Group by user
  const byUser = groupBy(orphanedVersions, v => v.user_id);

  for (const [userId, userVersions] of Object.entries(byUser)) {
    const sorted = userVersions.sort((a, b) => a.personal_version_slot - b.personal_version_slot);
    const v1 = sorted[0];
    const v2 = sorted[1] ?? null;

    // Promote V1 to standalone
    await supabaseAdmin.from('recipes').update({
      is_personal_version: false,
      personal_version_of: null,
      personal_version_slot: null,
      description: v1.description
        ? v1.description + `\n\nOriginally a version of "${recipe.title}" by @${recipe.original_submitter_username}.`
        : `Originally a version of "${recipe.title}" by @${recipe.original_submitter_username}.`,
    }).eq('id', v1.id);

    // If V2 exists: attach it to V1 using the existing version system
    if (v2) {
      await supabaseAdmin.from('recipes').update({
        is_personal_version: false,
        personal_version_of: null,
        personal_version_slot: null,
        parent_recipe_id: v1.id,
        version_number: 2,
        version_label: 'Version 2',
      }).eq('id', v2.id);

      // Ensure V1 is marked as a parent
      await supabaseAdmin.from('recipes').update({
        is_parent: true,
      }).eq('id', v1.id);
    }
  }
}
// Then proceed with the original recipe deletion as normal
```

---

## Web UI changes

### 1. Recipe detail page — apps/web/app/recipe/[id]/page.tsx

**Add version tab switcher (visible only to the user who has personal versions):**

On page load, if `session.user` has a `recipe_saves` row for this recipe:
- Call `GET /api/recipes/[id]/personal-versions` to fetch their versions
- If versions exist (or slots are available), show the version switcher

Version switcher UI (below the recipe header, above the body):
```
[  Original  |  My Version 1  ···  |  My Version 2  ···  ]   [ + Ask Sous Chef ]
```

- "Original" tab: always present, shows original recipe content
- "My Version 1 / 2" tabs: shown only when that slot is filled. "···" opens a
  dropdown menu: Rename, Promote to My Recipe, Delete
- "+ Ask Sous Chef" button: opens the Ask Sous Chef modal
  - Greyed out with upgrade prompt if user is Free tier
  - When both slots are full: still shown, but Original pill is hidden in the modal

**Ask Sous Chef modal:**
- Pill selector at top: [Original] [My Version 1 (if exists)] [My Version 2 (if exists)]
  - When both slots full, only V1 and V2 pills are shown (Original hidden)
- Textarea: placeholder "What did the Sous Chef miss? Add any corrections or
  extra details below."
- "Generate" button → POST /api/recipes/[id]/ask-sous-chef
- Loading state: "Your Sous Chef is reviewing this recipe…"
- After generation: shows a review panel with the regenerated content
  (same pattern as the existing RecipeReviewPanel component)
- "Save" button at bottom of review panel → saves/updates the version
- "Cancel" button → closes without saving

**Rename inline:**
- Clicking "Rename" from the "···" menu shows an inline input on the tab label
- On blur/enter: PUT /api/personal-versions/[versionId] with `{ title: newName }`

**Delete confirmation:**
- ChefsDialog: "Delete this version? This can't be undone."
- On confirm: DELETE /api/personal-versions/[versionId] → removes tab, shows success toast

**Promote confirmation:**
- ChefsDialog: "This will create a standalone recipe in your collection that you
  can edit and share. The version slot will be freed."
- On confirm: POST /api/personal-versions/[versionId]/promote
  → show toast "Recipe added to your collection"
  → remove the version tab

### 2. Attribution pill row — modifier pills

In the existing attribution pill row (web):
- After the existing `original_submitter` (red) and `shared_by` (gray) pills,
  render modifier pills
- Fetch `getRecipeModifiers(recipeId)` — returns all modifiers ordered ASC
- Display the LAST 3 entries from the array (most recent 3 modifiers)
- Order left to right: oldest of the 3 shown on left, newest on right
- Each pill: purple background (`bg-purple-100 text-purple-800 border-purple-300`)
  using the existing pill styling pattern
- Pills are NOT removable (no × button) — auto-managed
- Pill label: `@${modifier_username}`

```typescript
// Display logic — show last 3 modifiers
const displayModifiers = modifiers.slice(-3);
// Render oldest-to-newest left-to-right (slice preserves ASC order)
```

---

## Mobile UI changes

Mobile has feature parity with web. Apply equivalent changes to:

### apps/mobile/app/recipe/[id].tsx

**Version tab switcher:**
- Check if current user has a recipe_saves row for this recipe
- Fetch personal versions via the same API route
- Render a horizontal tab row below the recipe header
- Same tab structure: Original | V1 (with "..." sheet) | V2 (with "..." sheet)
- "..." opens a bottom sheet (ActionSheet pattern) with: Rename, Promote, Delete

**Ask Sous Chef button:**
- Red button consistent with existing Sous Chef button styling
- Opens a modal sheet with pill selector + textarea
- Same flow as web — calls the same API routes

**Attribution pill row — modifier pills:**
- Same display logic as web
- Use the existing pill styling from `apps/mobile/app/recipe/[id].tsx`
- Purple pills using `useTheme().colors` — map to the existing purple theme color
  or use the `c-purple` ramp equivalent in React Native

**Rename:**
- Alert.prompt on iOS, or a modal text input on Android
- Same PUT /api/personal-versions/[versionId] call

**Delete:**
- Alert.alert confirm dialog (or ChefsDialog if already used in mobile)

**Promote:**
- Alert.alert confirm → POST /api/personal-versions/[versionId]/promote
  → navigate to the promoted recipe

---

## i18n

Add keys to all 5 locale files (en/fr/es/it/de). Add English first, then translate.

```json
// apps/web/locales/en/personalVersions.json
{
  "askSousChef": "Ask Sous Chef",
  "askSousChefPlaceholder": "What did the Sous Chef miss? Add any corrections or extra details.",
  "generating": "Your Sous Chef is reviewing this recipe…",
  "saveVersion": "Save Version",
  "myVersion": "My Version {{number}}",
  "original": "Original",
  "rename": "Rename",
  "promote": "Save as My Recipe",
  "delete": "Delete Version",
  "deleteConfirm": "Delete this version? This can't be undone.",
  "promoteConfirm": "This will create a standalone recipe in your collection. The version slot will be freed.",
  "slotsFull": "Both version slots are in use. Refine V1 or V2, or delete/promote one to free a slot.",
  "promoted": "Recipe added to your collection",
  "planRequired": "Ask Sous Chef requires Chef plan or above"
}
```

Add the `personalVersions` namespace to both web and mobile i18n setup.

---

## Feature registry update

Add to `.claude/agents/feature-registry.md` under a new "PERSONAL VERSIONS" section:

| Feature | Status | Platform | Session |
|---------|--------|----------|---------|
| Personal versions (2 slots per saved recipe) | LIVE | Web + Mobile | [this session] |
| Ask Sous Chef on saved recipe | LIVE | Web + Mobile | [this session] |
| Modifier pills on original recipe | LIVE | Web + Mobile | [this session] |
| Promote version to standalone recipe | LIVE | Web + Mobile | [this session] |
| Orphan cascade on original deletion | LIVE | Web | [this session] |

---

## AI cost entry

Add to `.claude/agents/ai-cost.md`:

| Action | Function | Model | Estimated cost |
|--------|----------|-------|----------------|
| ask_sous_chef | askSousChef() | sonnet | ~$0.003–0.008/call |

---

## Testing

### psql verification
```sql
-- Confirm new columns on recipes
SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_name = 'recipes'
AND column_name IN ('is_personal_version', 'personal_version_of', 'personal_version_slot');

-- Confirm recipe_modifiers table
\d recipe_modifiers

-- Confirm personal versions are excluded from public feed
SELECT COUNT(*) FROM recipes WHERE is_personal_version = TRUE;
-- Should be 0 initially

-- Confirm unique slot index prevents a 3rd version
-- (manual test — insert 2 versions for same user+recipe, then attempt 3rd and confirm error)
```

### API verification
```bash
# 1. Attempt ask-sous-chef without auth — expect 401
curl -s -X POST "https://chefsbk.app/api/recipes/[any-id]/ask-sous-chef" | jq .

# 2. Attempt ask-sous-chef with free tier user — expect 403 PLAN_REQUIRED
# (use a test token for a free tier user)

# 3. Happy path — use valid Chef+ user token
curl -s -X POST "https://chefsbk.app/api/recipes/[saved-recipe-id]/ask-sous-chef" \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"feedback": "The recipe is missing heavy cream in the ingredients", "baseVersion": "original"}' | jq .

# 4. Create personal version
curl -s -X POST "https://chefsbk.app/api/recipes/[saved-recipe-id]/personal-versions" \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"title":"My Version 1","description":"...", "ingredients":[...], "steps":[...]}' | jq .

# 5. Confirm it does NOT appear in public search
curl -s "https://chefsbk.app/api/recipes/[the-new-version-id]" | jq '.is_personal_version'
# Should return true — confirms it's private
```

### Web UI verification
1. Log in as a Chef+ user
2. Find a public recipe you've saved — confirm "Ask Sous Chef" button appears
3. Log in as a Free user — confirm button is absent or shows upgrade prompt
4. As Chef+ user: open Ask Sous Chef modal — confirm Original pill shown
5. Submit feedback — confirm regenerated recipe appears for review
6. Save as version — confirm V1 tab appears in the version switcher
7. Open Ask Sous Chef again — confirm only V1 pill (no V2 yet) is shown for refinement
8. Save second version — confirm V2 tab appears, Original pill now hidden in modal
9. Rename V1 — confirm tab label updates inline
10. Check modifier pill on original recipe — confirm purple pill with your @username
11. Delete V1 — confirm slot freed, V2 becomes V1 (or remains in its slot)
12. Promote V2 — confirm it disappears from version switcher, appears in My Recipes

### Mobile UI verification
- Repeat key flows from Web UI verification on the Android/iOS app
- Confirm version switcher renders without safe-area violations
- Confirm Ask Sous Chef modal has proper bottom padding with useSafeAreaInsets()
- Confirm delete/promote flows work via native alerts

### Regression
- Open any public recipe you have NOT saved — confirm no version switcher, no Ask Sous Chef button
- Open your own recipe — confirm no version switcher (this feature is for saved recipes only)
- Public search for a recipe — confirm no personal versions appear in results
- Original recipe page (as a different user) — confirm modifier pill visible if any

---

## Deploy

Follow `.claude/agents/deployment.md` fully.

Deploy web to RPi5:
```bash
ssh rasp@rpi5-eth "cd /mnt/chefsbook/repo && git pull"
ssh rasp@rpi5-eth "/mnt/chefsbook/deploy-staging.sh"
pm2 restart chefsbook-web
```

Smoke test after deploy:
- https://chefsbk.app/ — HTTP 200
- https://chefsbk.app/dashboard — HTTP 200
- Any existing recipe detail page — loads without error, no JS console errors
- Confirm existing attribution pills (original_submitter, shared_by) still render correctly

---

## Wrapup

Follow `.claude/agents/wrapup.md` fully.

In DONE.md, log:
- Migration 074 applied
- New columns on recipes: is_personal_version, personal_version_of, personal_version_slot
- New table: recipe_modifiers
- New AI function: askSousChef() in @chefsbook/ai
- New API routes: ask-sous-chef, personal-versions (GET/POST), personal-versions/[id] (PUT/DELETE/promote)
- Public query guard applied to listPublicRecipes, listRecipes, search_recipes RPC, get_public_feed RPC
- Web + mobile: version tab switcher, Ask Sous Chef modal, modifier pills, rename/promote/delete actions
- Orphan cascade added to recipe delete route
- i18n: personalVersions namespace added to all 5 locales
- feature-registry.md updated
- ai-cost.md updated
