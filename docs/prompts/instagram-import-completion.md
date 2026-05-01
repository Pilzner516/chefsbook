# Prompt: ChefsBook — Instagram Import Auto-Completion via Sous Chef (Web Only)

## LAUNCH PROMPT (paste this into Claude Code to start the session)

```
Read and execute docs/prompts/instagram-import-completion.md fully and autonomously, from pre-flight through deployment and /wrapup. Do not stop for questions unless you hit a genuine blocker.
```

---

## TYPE: FEATURE — WEB ONLY

## Overview

After a user imports recipes from their Instagram export ZIP, those recipes land in
My Recipes with only a title, tags, notes (the raw caption), and a hero image. They
have no ingredients or steps. This session adds automatic Sous Chef completion that
fires immediately after the Instagram import save, using the recipe's hero image +
caption notes to generate ingredients and steps via Claude Sonnet vision.

This feature is web-only. It will NOT be built on mobile or extension.

---

## Agent files to read — ALL of these, in order, before writing a single line of code

- `.claude/agents/wrapup.md`
- `CLAUDE.md`
- `DONE.md`
- `.claude/agents/testing.md`
- `.claude/agents/feature-registry.md`
- `.claude/agents/deployment.md`
- `.claude/agents/ai-cost.md`
- `.claude/agents/sous-chef.md`
- `.claude/agents/import-pipeline.md`
- `.claude/agents/import-quality.md`
- `.claude/agents/image-system.md`

Run ALL pre-flight checklists before writing any code.

---

## Mobile / extension boundary — HARD RULE

These directories must NOT be modified under any circumstances:

- `apps/mobile/` — any file, any reason
- `apps/extension/` — any file, any reason

---

## Pre-flight: before writing any code

1. Read the existing Sous Chef completion logic — understand exactly how it currently
   generates ingredients + steps for `_incomplete` recipes. Find the function(s) responsible.
2. Read `packages/ai/src/instagramExport.ts` (created in session P-210) — understand
   what data is available per recipe after import: title, caption (in notes), image in
   Supabase storage, tags.
3. Read `apps/web/app/api/import/instagram-export/save/route.ts` — understand the
   current save flow. The completion trigger will be added here or called from here.
4. Confirm how the existing Sous Chef accesses recipe images from Supabase storage
   (apikey header requirement from image-system.md) — the same pattern must be used
   here when passing the image to Claude vision.
5. Confirm next available DB migration number from DONE.md (may not need one).
6. Check `ai-cost.md` for the current Sonnet vision cost — completion uses Sonnet,
   not Haiku, because we need quality ingredient + step generation.

---

## The problem

Session P-210 built the Instagram import pipeline correctly. Recipes are saved with:
- ✅ Title (extracted from caption)
- ✅ Hero image (user's own Instagram photo)
- ✅ Notes (full raw caption)
- ✅ Tags: `['instagram', '_incomplete', ...hashtags]`
- ❌ No ingredients
- ❌ No steps
- ❌ `is_complete = false`

The `_incomplete` tag was intended to signal Sous Chef to complete these later, but
there is no automatic trigger. Users are left with recipe stubs and no clear path to
completion. This session fixes that.

---

## Solution: Post-import batch completion

After the save route successfully creates all recipe stubs, trigger Sous Chef completion
for each one automatically, using:

1. **The hero image** — passed to Claude Sonnet vision so it can see what the dish
   looks like and infer ingredients from visual cues
2. **The caption/notes** — the raw Instagram caption often contains ingredient hints,
   cooking techniques, and dish descriptions
3. **The title** — provides dish identity context

This gives Sonnet everything it needs to generate a reasonable first-pass recipe even
when the caption is just hashtags.

---

## Architecture

```
POST /api/import/instagram-export/save (existing)
  │
  ├─ [existing] Create recipe stubs (title, image, notes, tags)
  │
  └─ [NEW] For each saved recipe:
       POST /api/import/instagram-export/complete (new route)
         │
         ├─ Fetch hero image from Supabase storage (with apikey header)
         ├─ Build prompt with image + caption + title
         ├─ Call completeInstagramRecipe() → Claude Sonnet vision
         │    Returns: { ingredients[], steps[], description, cuisine }
         ├─ Insert ingredients into recipe_ingredients table
         ├─ Insert steps into recipe_steps table
         ├─ Update recipe: is_complete=true, description, cuisine
         ├─ Remove '_incomplete' tag, keep 'instagram' tag
         └─ Call /api/recipes/finalize
```

### Processing strategy

Run completion **asynchronously after save** — do not block the save response waiting
for all completions. The save route responds immediately with the list of created
recipe IDs, then fires off completion calls in the background (or streams progress
back to the client).

Preferred approach: return recipe IDs from save, then the client calls
`/api/import/instagram-export/complete` in batches of 5 (Sonnet is slower + more
expensive than Haiku — don't parallelize all at once).

Show a second progress phase in the UI: "Generating recipes… 3 / 12 complete"

---

## New API route: POST /api/import/instagram-export/complete

Auth required + Pro plan gate.

**Request body:**
```typescript
{
  recipeIds: string[]   // batch of up to 5 recipe IDs to complete
}
```

**Processing per recipe:**
1. Fetch recipe row: `id, title, notes, tags, user_id`
2. Fetch primary photo URL via `getPrimaryPhotos(recipeId)`
3. Download image from Supabase storage with apikey header → base64
4. Call `completeInstagramRecipe({ title, notes, imageBase64 })`
5. Insert ingredients: `recipe_ingredients` table (name, amount, unit, order_index)
6. Insert steps: `recipe_steps` table (instruction, order_index)
7. Update recipe:
   - `description`: generated description
   - `cuisine`: generated cuisine (if not already set)
   - `is_complete`: true
   - `tags`: remove `'_incomplete'`, keep `'instagram'` and hashtag tags
8. POST `/api/recipes/finalize`
9. Log to `import_attempts` with action `'instagram_export_complete'`

**Response:**
```typescript
{
  completed: Array<{
    recipeId: string
    title: string
    ingredientCount: number
    stepCount: number
  }>
  failed: Array<{
    recipeId: string
    error: string
  }>
}
```

---

## New AI function: completeInstagramRecipe()

Add to `packages/ai/src/instagramExport.ts`

```typescript
// Model: SONNET (vision — needs quality + image understanding)
// Cost: ~$0.01–0.02 per recipe (vision input + structured output)
// logAiCall action: 'instagram_recipe_complete'
// Input: { title: string, notes: string, imageBase64: string }
// Output: {
//   description: string       // 1-2 sentence dish description
//   cuisine: string | null
//   ingredients: Array<{
//     name: string
//     amount: string | null   // e.g. "2", "1/2"
//     unit: string | null     // e.g. "cup", "tbsp", "g"
//   }>
//   steps: Array<{
//     instruction: string     // full step text
//   }>
// }
```

### Prompt guidance for completeInstagramRecipe()

The prompt must instruct Sonnet to:
- Look at the image carefully to identify ingredients visible in the dish
- Use the caption/notes for any explicit ingredient or technique mentions
- Generate realistic quantities (not just ingredient names)
- Generate clear, numbered cooking steps
- If the caption is only hashtags with no recipe info, rely primarily on the image
- Return valid JSON only — no markdown, no preamble
- Minimum 3 ingredients, minimum 2 steps
- If the dish cannot be identified at all, return null (caller will leave as _incomplete)

---

## UI changes: InstagramExportImporter.tsx

Add a third progress phase after the existing two:

**Phase 1** — Upload (existing)
**Phase 2** — Scanning & classifying (existing)
**Phase 3 — Review** (existing)
**Phase 4** — Saving & generating recipes (NEW)

Phase 4 UI:
- "Saving your recipes and generating ingredients & steps…"
- Progress: "3 / 12 recipes complete"
- Each completed recipe shows a checkmark with its title
- Failed recipes show a warning icon — "Could not generate — you can complete this manually with Sous Chef"
- "Done — View My Recipes" button appears when all complete (or all attempted)

---

## AI cost table additions

Add to `.claude/agents/ai-cost.md`:

| Action | Function | Model | Est. cost | Notes |
|--------|----------|-------|-----------|-------|
| `instagram_recipe_complete` | `completeInstagramRecipe()` | SONNET | ~$0.015/recipe | Vision + structured JSON. Generates ingredients, steps, description from image + caption. |

---

## Feature registry update

Update the existing `instagram_export_import` row in `.claude/agents/feature-registry.md`
to note this session added post-import Sous Chef completion. Do not create a new row —
this is an extension of the P-210 feature.

---

## Testing

1. Import 3–5 posts via Instagram export on `/dashboard/scan`
2. Confirm Phase 4 progress UI appears after review + save
3. After completion, open each recipe — confirm:
   - Ingredients present (minimum 3)
   - Steps present (minimum 2)
   - Description populated
   - `is_complete = true`
   - `_incomplete` tag removed, `instagram` tag still present
   - Hero image is still the user's Instagram photo

### psql verification

```sql
SELECT r.title, r.is_complete, r.tags,
       COUNT(DISTINCT ri.id) as ingredient_count,
       COUNT(DISTINCT rs.id) as step_count
FROM recipes r
LEFT JOIN recipe_ingredients ri ON ri.recipe_id = r.id
LEFT JOIN recipe_steps rs ON rs.recipe_id = r.id
WHERE r.source_type = 'instagram_export'
GROUP BY r.id, r.title, r.is_complete, r.tags
ORDER BY r.created_at DESC;
```

Expected: all rows show `is_complete = true`, ingredient_count ≥ 3, step_count ≥ 2,
tags contain `instagram` but NOT `_incomplete`.

### Edge case tests

- Caption is only hashtags (no recipe text) — should still generate from image alone
- Very short caption ("Dinner 🍝") — should generate from image + title
- Recipe where image is unclear — should fall back gracefully, leave as `_incomplete`
  rather than inserting garbage data

---

## Deploy

Follow `deployment.md`. Deploy web to RPi5 via `deploy-staging.sh`.
Run regression smoke test from `testing.md` before wrapup.
Verify `curl https://chefsbk.app/dashboard/scan` returns HTTP 200.

---

## Wrapup

Follow `wrapup.md` fully.

- [ ] `tsc --noEmit` clean on `apps/web`
- [ ] `ai-cost.md` updated with `instagram_recipe_complete` Sonnet row
- [ ] `feature-registry.md` P-210 row updated (not a new row)
- [ ] `DONE.md` entry written
- [ ] Deployed to RPi5 and smoke-tested
- [ ] psql verification query above returns expected results
- [ ] TYPE classification: CODE (new feature extending P-210)
