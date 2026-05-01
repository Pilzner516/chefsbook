# Prompt: ChefsBook — Instagram Export Import (Web Only)

## LAUNCH PROMPT (paste this into Claude Code to start the session)

```
Read and execute docs/prompts/instagram-export-import.md fully and autonomously, from pre-flight through deployment and /wrapup. Do not stop for questions unless you hit a genuine blocker.
```

---

## TYPE: FEATURE — WEB ONLY

## Overview

Pro plan users can upload their Instagram data export ZIP file on the Import & Scan page.
The system parses the ZIP client-side, classifies food photos using Claude Haiku Vision,
extracts recipe metadata from captions, and batch-creates recipe stubs — using the user's
own Instagram photos as recipe images. No AI image generation is needed or used.

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
- `.claude/agents/import-pipeline.md`
- `.claude/agents/import-quality.md`
- `.claude/agents/image-system.md`
- `.claude/agents/ui-guardian.md`

Run ALL pre-flight checklists before writing any code.

---

## Mobile / extension boundary — HARD RULE

These directories must NOT be modified under any circumstances:

- `apps/mobile/` — any file, any reason
- `apps/extension/` — any file, any reason

Allowed shared package changes:
- `packages/ai/src/` — new file `instagramExport.ts` only
- `packages/db/src/` — only to add `'instagram_export'` to the `SourceType` union

If you find yourself editing anything in `apps/mobile` or `apps/extension`, stop immediately.

---

## Pre-flight: before writing any code

1. Confirm next available DB migration number from DONE.md
2. Run `\d recipes` on RPi5 to check whether `source_type` is a CHECK constraint or a plain TEXT column — the migration approach differs
3. Confirm `recipe-images` storage bucket exists and is publicly readable
4. Read `packages/ai/src/instagramImport.ts` — this file is DEPRECATED (session 138, Meta scraping block). Note what exists. Do NOT re-enable it. The new `instagramExport.ts` is a separate file for a different context (local ZIP data, not URL scraping)
5. Confirm `checkPlanGate` pattern used by PDF export — this feature uses the same Pro-only gate
6. Confirm `addRecipePhoto()` signature in `packages/db/src/` — ZIP-extracted images are uploaded as binary blobs, not external URLs (external URLs throw)

---

## Architecture

```
User uploads Instagram export ZIP (client-side only — ZIP never sent to server)
        ↓
jszip parses ZIP in browser → extracts posts_*.json + image blobs
        ↓
Client batches 20 posts at a time → POST /api/import/instagram-export/classify
        ↓
Server: Haiku Vision classifies each image → YES (food) / NO (discard)
Server: Haiku text extracts caption metadata for food posts
        ↓
Client accumulates food posts, shows live progress
        ↓
Review screen: photo grid, editable titles, checkboxes
        ↓
User confirms selection → POST /api/import/instagram-export/save
        ↓
Server: upload image to Supabase storage → createRecipe() → addRecipePhoto() → finalize()
        ↓
Recipes appear in My Recipes with _incomplete tag → Sous Chef suggests completion
```

---

## Instagram export ZIP format

```
your-instagram-export.zip
├── content/
│   ├── posts_1.json        ← structured post data
│   └── posts_2.json        ← exists if account has >100 posts
└── media/
    └── posts/
        └── 202401/
            └── image.jpg
```

### posts_*.json structure

```json
[
  {
    "media": [
      {
        "uri": "media/posts/202401/image123.jpg",
        "creation_timestamp": 1704067200,
        "title": "Homemade pasta 🍝 from scratch. Full recipe in bio! #pasta #homecooking",
        "media_metadata": {}
      }
    ]
  }
]
```

Key fields: `media[0].uri` (image path inside ZIP), `media[0].title` (caption), `media[0].creation_timestamp`.
For posts with multiple images, use only `media[0]`.

---

## New files to create

```
docs/prompts/instagram-export-import.md          ← this file (commit to repo)
apps/web/app/api/import/instagram-export/
  classify/route.ts                              ← classification phase
  save/route.ts                                  ← batch save phase
apps/web/components/InstagramExportImporter.tsx  ← full UI component
packages/ai/src/instagramExport.ts               ← new AI functions
```

## Existing files to modify

```
apps/web/app/dashboard/scan/page.tsx             ← add Instagram Export card (Pro-gated)
packages/ai/src/index.ts                         ← export new functions
packages/db/src/types.ts                         ← add 'instagram_export' to SourceType
.claude/agents/ai-cost.md                        ← add two new Haiku action rows
.claude/agents/feature-registry.md              ← add new feature row
```

## DO NOT modify

```
apps/mobile/**
apps/extension/**
apps/web/app/api/import/url/route.ts            ← unrelated path, no changes
packages/ai/src/instagramImport.ts              ← stays deprecated, do not touch
```

---

## Plan gating

**Pro plan only.** Use the existing `checkPlanGate` pattern (same as PDF export).

- Non-Pro users: show locked card with upgrade prompt on scan page — do not render the upload UI
- API routes: return 403 with `{ error: 'plan_required', plan: 'pro' }` if not Pro
- Review header: show "You can import N more recipes on your plan" — disable excess checkboxes if selection would exceed plan recipe limit

---

## API route: POST /api/import/instagram-export/classify

Accepts a batch of up to 20 posts. Auth required + Pro plan gate.

**Request body:**
```typescript
{
  batch: Array<{
    uri: string         // original path from ZIP JSON (used as dedup key)
    imageBase64: string // jpeg/png blob as base64
    caption: string     // raw caption text
    timestamp: number   // creation_timestamp
  }>
}
```

**Processing per post:**
1. Call `classifyFoodImage(imageBase64)` → boolean
2. If food: call `extractInstagramExportCaption(caption)` → structured metadata
3. Return result for each post

**Response:**
```typescript
{
  results: Array<{
    uri: string
    isFood: boolean
    extracted: {
      title: string | null
      cuisine: string | null
      tags: string[]
      notes: string | null    // full caption always stored here
    } | null                  // null if isFood=false
  }>
}
```

---

## API route: POST /api/import/instagram-export/save

Accepts the user-confirmed selection after review. Auth required + Pro plan gate.

**Request body:**
```typescript
{
  posts: Array<{
    uri: string
    imageBase64: string
    extracted: { title: string | null, cuisine: string | null, tags: string[], notes: string | null }
    timestamp: number
  }>
}
```

**Processing per post:**
1. Dedup check: query `recipes` where `user_id = auth.uid()` AND `source_instagram_uri = post.uri` — skip if exists, count as "already imported"
2. Check recipe count limit via `checkRecipeLimit()` — stop batch if limit reached
3. Upload image blob to `recipe-images` bucket via `supabaseAdmin` (not the user client — CORS)
4. `createRecipe()` with:
   - `title`: `extracted.title ?? 'Untitled Instagram Recipe'`
   - `source_type`: `'instagram_export'`
   - `source_url`: `'https://www.instagram.com'`
   - `source_instagram_uri`: `post.uri`
   - `notes`: `extracted.notes`
   - `cuisine`: `extracted.cuisine ?? null`
   - `tags`: `['instagram', '_incomplete', ...extracted.tags]`
   - `is_complete`: `false`
5. `addRecipePhoto()` with storage URL, `is_ai_generated: false`, `is_primary: true`
6. POST to `/api/recipes/finalize` (completeness gate + `isActuallyARecipe()`)
7. Log to `import_attempts` table

**Response:**
```typescript
{
  saved: number
  skipped: number      // duplicates
  limitReached: boolean
  recipeIds: string[]
}
```

---

## New AI functions: packages/ai/src/instagramExport.ts

### classifyFoodImage(imageBase64: string): Promise<boolean>

```typescript
// Model: HAIKU (vision)
// Cost: ~$0.001/image
// logAiCall action: 'instagram_food_classify'
// Prompt: "Is this a food or recipe photo? Respond with only the word YES or NO."
// On AI error: return false (safe default — don't import uncertain images)
```

### extractInstagramExportCaption(caption: string): Promise<ExtractedCaption>

```typescript
// Model: HAIKU (text only)
// Cost: ~$0.0002/call
// logAiCall action: 'instagram_caption_extract'
// Return: { title: string|null, cuisine: string|null, tags: string[], notes: string|null }
// Always store the full raw caption in notes — never discard it
// If caption has no useful recipe data: { title: null, cuisine: null, tags: [], notes: caption }
```

Both functions must call `logAiCall()` with the correct action string and model.
No Replicate calls anywhere in this feature — user photos are used directly.

---

## UI component: InstagramExportImporter.tsx

Lives on the Import & Scan page. Renders nothing (replaced by upgrade prompt) if user is not Pro.

### Phase 1 — Upload

- Card matching existing import card style on scan page
- Label: "Import from Instagram Export"
- Sub-label: "Upload your Instagram data ZIP to import all your food posts"
- "How to export your Instagram data" link → `https://www.instagram.com/download/request/`
- File input: `.zip` only, drag-and-drop supported
- "Start Import" button — disabled until ZIP is selected

### Phase 2 — Processing

- Progress bar + counter: "Scanning 47 / 312 posts…"
- Live sub-count: "Found 89 food photos so far"
- Processing happens in client-side batch loop (20 posts per API call)
- Cancel button stops the loop cleanly

```typescript
// Client-side batch loop pattern
for (let i = 0; i < allPosts.length; i += BATCH_SIZE) {
  if (cancelled) break
  const batch = allPosts.slice(i, i + BATCH_SIZE)
  const res = await fetch('/api/import/instagram-export/classify', {
    method: 'POST',
    body: JSON.stringify({ batch }),
    headers: { 'Content-Type': 'application/json' }
  })
  const { results } = await res.json()
  setFoodPosts(prev => [...prev, ...results.filter(r => r.isFood)])
  setProgress({ scanned: i + batch.length, total: allPosts.length })
}
```

Hard cap: stop parsing after 500 food posts found. Show banner: "We found 500+ food posts — showing the most recent 500. Your most recent posts are imported first."

### Phase 3 — Review screen

- Header: "Found [N] food photos — select which to import"
- "Select all" / "Deselect all" controls
- 3-column photo grid
- Each card: thumbnail, editable title input (pre-filled from extracted.title or blank), checkbox
- Footer: "Importing [N] recipes" + "Import Selected" button
- If N exceeds plan limit: show inline warning, disable excess checkboxes with "Plan limit reached" tooltip

---

## Database migration

Migration file: `supabase/migrations/XXX_instagram_export.sql`
(Replace XXX with the next migration number confirmed in pre-flight step 1)

```sql
-- Deduplication column for Instagram export import
ALTER TABLE recipes
  ADD COLUMN IF NOT EXISTS source_instagram_uri TEXT;

CREATE INDEX IF NOT EXISTS idx_recipes_source_instagram_uri
  ON recipes (source_instagram_uri)
  WHERE source_instagram_uri IS NOT NULL;

-- If source_type is a CHECK constraint, extend it to include 'instagram_export'
-- Confirm with \d recipes before writing this line — may not be needed
```

After applying migration: `docker restart supabase-rest` on RPi5 (mandatory).

---

## AI cost table additions

Add these rows to `.claude/agents/ai-cost.md` MODEL SELECTION GUIDE:

| Action | Function | Model | Est. cost | Notes |
|--------|----------|-------|-----------|-------|
| `instagram_food_classify` | `classifyFoodImage()` | HAIKU | ~$0.001/image | Vision, binary YES/NO, safe-default false on error |
| `instagram_caption_extract` | `extractInstagramExportCaption()` | HAIKU | ~$0.0002/call | Text only, structured JSON, always stores full caption in notes |

No Replicate costs for this import path. `describeSourceImage()` and `generateRecipeImage()` are explicitly skipped — the Instagram photo is the recipe image.

---

## Feature registry addition

Add to `.claude/agents/feature-registry.md`:

| Feature | Status | Sessions | Notes |
|---------|--------|----------|-------|
| Instagram export import | LIVE | [this session] | Web only, Pro plan. ZIP parsed client-side. Haiku vision food classifier → review grid → batch save. User's own photos used directly — no Replicate. New `instagramExport.ts` — do NOT confuse with deprecated `instagramImport.ts` (session 22, removed session 138). |

---

## Testing

### Pre-deploy verification

1. Upload a real Instagram export ZIP — confirm ZIP parses and post count appears
2. Confirm Phase 2 progress counter increments correctly across multiple batches
3. Confirm food/non-food classification looks correct on a mixed account
4. Confirm review screen shows correct thumbnails and extracted titles
5. Import a small selection (3–5 posts) — confirm recipes appear in My Recipes with:
   - Correct title (or "Untitled Instagram Recipe" fallback)
   - `instagram` and `_incomplete` tags
   - User's photo as hero image
   - Full caption in notes field
6. Confirm non-Pro user sees upgrade prompt, not the upload UI
7. Import same ZIP a second time — confirm duplicates are skipped and counted

### psql verification

```sql
SELECT id, title, source_type, source_instagram_uri, tags
FROM recipes
WHERE source_type = 'instagram_export'
ORDER BY created_at DESC
LIMIT 10;

SELECT COUNT(*) FROM recipe_user_photos
WHERE is_ai_generated = false
  AND recipe_id IN (
    SELECT id FROM recipes WHERE source_type = 'instagram_export'
  );
```

### Web UI verification

- `/dashboard/scan` loads without errors for Pro user — Instagram Export card visible
- `/dashboard/scan` loads for non-Pro user — card shows upgrade prompt, no file input
- No TypeScript errors: `cd apps/web && npx tsc --noEmit`

---

## Deploy

Follow `deployment.md`. Deploy web to RPi5 via `deploy-staging.sh`.
Run full regression smoke test from `testing.md` before wrapup.
Verify `curl https://chefsbk.app/dashboard/scan` returns HTTP 200.

---

## Wrapup

Follow `wrapup.md` fully. Required before closing the session:

- [ ] `tsc --noEmit` clean on `apps/web`
- [ ] Migration applied on RPi5 + `docker restart supabase-rest`
- [ ] `ai-cost.md` updated with two new Haiku action rows
- [ ] `feature-registry.md` updated with new row
- [ ] `DONE.md` entry written
- [ ] Deployed to RPi5 and smoke-tested
- [ ] TYPE classification: CODE (new feature)
