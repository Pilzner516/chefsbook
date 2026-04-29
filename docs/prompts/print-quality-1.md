# Prompt: ChefsBook Print — Plan Gating, AI Image Upscaling + Cover Upload

## LAUNCH PROMPT (paste this into Claude Code to start the session)

```
Read and execute docs/prompts/print-quality-1.md fully and autonomously, from pre-flight through deployment and /wrapup. Do not stop for questions unless you hit a genuine blocker.
```

---

## TYPE: FEATURE + CODE FIX — WEB ONLY

## Overview

Three things to build this session:
1. The print cookbook feature must be gated to paid plans (chef/family/pro). Currently any user can access it.
2. Recipe images are web resolution (72-96 DPI) which prints poorly. AI upscaling via Replicate must run at PDF generate time, using upscaled images only during generation then discarding them. No extra storage cost.
3. The canvas editor cover card shows "No cover image" with no interactivity. The upload API route already exists — wire it to the cover card UI.

---

## Agent files to read — ALL of these, in order, before writing a single line of code

- `.claude/agents/wrapup.md`
- `.claude/agents/testing.md`
- `.claude/agents/feature-registry.md`
- `.claude/agents/ui-guardian.md`
- `.claude/agents/deployment.md`
- `.claude/agents/pdf-design.md`
- `.claude/agents/image-system.md`
- `.claude/agents/ai-cost.md`

Run ALL pre-flight checklists before writing any code.

---

## Pre-flight: before writing any code

1. Read CLAUDE.md fully
2. Read DONE.md from the repo — use the current file, not any cached version.
   Understand the current state of the canvas editor, plan gating, and what upload routes exist.
3. Confirm next available DB migration number from DONE.md
4. Run `\d printed_cookbooks` and `\d user_profiles` on RPi5 to verify current schema
5. Check existing PLAN_LIMITS in codebase — confirm canPDF flag exists
6. Check existing plan gating patterns used in other features (e.g. canFollow, canLike)
7. Check existing ai_usage_log table schema on RPi5
8. Locate the cover upload API route — read it fully to understand exact request format and return value
9. Read `apps/web/lib/book-layout.ts` — understand how cover image URL is stored in book_layout JSONB
10. Only then write any code

---

## TASK 1 — Gate print cookbook to paid plans

### Plan limits

Find PLAN_LIMITS in the codebase. Add `canPrint` boolean:

```typescript
canPrint: {
  free: false,
  chef: true,
  family: true,
  pro: true,
}
```

### Route gating

Gate `/dashboard/print-cookbook/[id]`:
- If `canPrint` is false, redirect to `/dashboard/plans` with query param `?reason=print`
- Show message on plans page when redirected: "Print My ChefsBook is available on Chef, Family, and Pro plans."

Gate `/dashboard/print-cookbook/new` (or wherever a new cookbook is initiated):
- Same redirect behaviour

Gate the generate API route `/api/print-cookbooks/[id]/generate`:
- Return `403` with `{ error: "upgrade_required" }` for free users
- Check plan server-side — do not rely on client gating alone

### Plans page

On `/dashboard/plans`, ensure "Print My ChefsBook" is listed as a benefit on chef/family/pro tier cards. Check what is already listed there. Add it if missing. Use the same formatting as existing benefit items.

---

## TASK 2 — AI image upscaling at generate time

### Overview

When a paid user clicks Generate PDF, for each recipe image and the cover image:
- Check resolution using existing `apps/web/lib/print-quality.ts` logic
- Skip upscaling if image is already green (excellent quality)
- Upscale yellow and red images via Replicate Real-ESRGAN before passing to PDF renderer
- Never save the upscaled image to Supabase Storage — use it only in memory during generation
- If upscaling fails for any single image, log the failure and fall back to the original — do not abort the entire PDF

### Replicate API

Model: `nightmareai/real-esrgan`
Scale: 4x
Input: image URL (existing Supabase Storage URL)
Output: upscaled image URL (temporary — fetch into memory, do not store)

```typescript
const output = await replicate.run(
  "nightmareai/real-esrgan:42fed1c4974146d4d2414e2be2c5277c7fcf05fcc3a73abf41610695738c1d7b",
  { input: { image: imageUrl, scale: 4 } }
)
// output is a URL — fetch the image bytes and pipe into PDF renderer
// do NOT upload to Supabase
```

### Environment variable

Add to `.env.local` on RPi5:
```
REPLICATE_API_TOKEN=    # get from replicate.com/account/api-tokens
```

Document in CLAUDE.md under Environment Variables:
"Required for print cookbook AI upscaling. Get token from replicate.com/account/api-tokens. Set REPLICATE_API_TOKEN in .env.local on RPi5."

### Progress indicator

In the canvas editor UI, during generation show a two-phase progress indicator:
1. "Enhancing image quality for print..." — while upscaling runs
2. "Generating PDF..." — while PDF renders

Replace any existing single-phase indicator.

### Cost tracking

After each upscale call, log to `ai_usage_log` (check schema first — use correct column names):
```typescript
{
  model: "real-esrgan-4x",
  cost: 0.002,
  cookbook_id: printedCookbookId,
  recipe_id: null,
  user_id: userId,
}
```

---

## TASK 3 — Cover card image upload

The cover card currently shows a dashed placeholder with "No cover image" text.
The upload API route already exists — do not rebuild it, only wire it to the UI.

**Click to upload:**
- The entire placeholder area is a click target
- On click: trigger a hidden `<input type="file" accept="image/jpeg,image/png,image/webp">`
- On file selected: POST to the existing cover upload API route using the exact
  request format that route already expects (read the route first — do not guess)
- Show a loading spinner inside the placeholder while uploading
- On success: display the returned image URL as a preview filling the cover card area with `object-fit: cover`
- On error: show a brief inline error message ("Upload failed — try again") and restore the placeholder

**Drag and drop:**
- The placeholder area also accepts drag-and-drop
- On dragover: highlight the border (dashed → solid, accent colour)
- On drop: same upload flow as click

**After upload — image preview state:**
- Show the uploaded image filling the cover preview area
- Overlay a small "Change photo" button in the bottom-right corner
  (semi-transparent dark pill, white text, camera icon)
- Clicking "Change photo" triggers the file picker again

**Persist:**
- After a successful upload, save the returned cover image URL to the cookbook
- Check DONE.md and book-layout.ts to determine whether the URL lives in
  book_layout JSONB or a direct column — do not guess
- Use the existing auto-save pattern already in the canvas editor — do not create a new save mechanism

**What NOT to touch:**
- Do not modify the PDF generation route or any template files
- Do not modify recipe cards, TOC card, foreword card, or book settings card
- Do not modify the upload API route itself — only call it from the UI
- Do not add new dependencies unless absolutely necessary

---

## TASK 4 — Fix sidebar nav label

The sidebar currently shows "web.printCookbook" as the nav item label. Change it to "Print My ChefsBook".
Find the label in `apps/web/components/Sidebar.tsx` (or equivalent) and update the string.
Check all 5 locale files (en/fr/es/it/de) — if the label is i18n'd, update the translation key in each.
Do not change the route, icon, or PRO badge — only the display label.

---

## TASK 5 — Update quality badge messaging

Now that upscaling runs automatically, update badge tooltip/label text in the canvas editor:
- 🟢 Green: "Print ready"
- 🟡 Yellow: "Will be enhanced at print time"
- 🔴 Red: "Will be enhanced at print time"

Remove the pre-generate blocking for red images. The Generate button must never be blocked by image quality — upscaling handles it automatically. Badges are informational only.

---

## Testing

### Plan gating
1. Sign in as a free user — navigate to `/dashboard/print-cookbook/[id]` — confirm redirect to `/dashboard/plans`
2. Hit `POST /api/print-cookbooks/[id]/generate` as free user (curl with auth token) — confirm 403 response
3. Sign in as a paid user — confirm full access to canvas and generate

### Cover upload
1. Open canvas editor — confirm cover placeholder is clickable, file picker opens
2. Select a JPEG — confirm upload and preview appear
3. Confirm "Change photo" button appears over preview
4. Drag and drop an image — confirm it uploads correctly
5. Reload the page — confirm cover image persists

### Upscaling
1. Add a recipe with a low-resolution image (red badge) to a cookbook
2. Click Generate — confirm "Enhancing image quality for print..." appears first
3. Confirm PDF generates successfully
4. Confirm the upscaled image is NOT saved to Supabase Storage
5. Check ai_usage_log for the upscaling cost entry

### psql verification
```sql
-- Cover image saved
SELECT id, cover_image_url, book_layout->>'coverImageUrl'
FROM printed_cookbooks ORDER BY updated_at DESC LIMIT 3;

-- Upscaling logged
SELECT * FROM ai_usage_log WHERE model = 'real-esrgan-4x' ORDER BY created_at DESC LIMIT 5;
```

---

## Deploy

Follow `deployment.md`. Deploy web to RPi5.
Add `REPLICATE_API_TOKEN` placeholder to RPi5 `.env.local` before deploying.
Run regression smoke test from `testing.md` before wrapup.
Confirm `/dashboard/print-cookbook` list page still loads (HTTP 200).

---

## Wrapup

Follow `wrapup.md` fully.
Update `feature-registry.md` with:
- Print cookbook plan gating (canPrint flag)
- AI image upscaling at generate time
- Cover card image upload in canvas editor

Add to AGENDA.md:
- [ ] Set real REPLICATE_API_TOKEN value in RPi5 .env.local
- [ ] Test upscaling with a real low-res image end-to-end in production
