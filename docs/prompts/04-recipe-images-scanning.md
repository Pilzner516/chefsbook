# ChefsBook — Session: Recipe Images & Multi-Page Scanning
# Source: QA Report 2026-04-07 · Items 5, 9, 10 (scanning only)
# Target: apps/mobile (primary), apps/web (parity flags)

---

## CONTEXT

Three related improvements to how images and scanning work for recipes. All three interact with the recipe detail screen, the import flow, and the image gallery system already built on the web. Read CLAUDE.md before starting. Check the navigator agent map for current screen layouts before modifying any screen.

---

## FEATURE 1 — Image management in recipe edit mode (Item 5)

### Current behaviour
Recipe images are shown in the detail view but cannot be managed from the mobile edit mode.

### Target behaviour

When a recipe is in **edit mode** on the recipe detail screen:

1. **If the recipe has images:** Show the existing image(s) in a horizontal scroll gallery. Each image has:
   - A `×` delete button (top-right corner of the thumbnail).
   - A "Set as primary" option (long-press or secondary tap) to make that image the hero image.
   - An `+` Add button as the last item in the gallery row to add more images.

2. **If the recipe has no images:** Show a large dashed placeholder zone with a centered `+` icon and the text "Add photo". This makes it obvious that images can be added here.

3. **Tapping the `+` / placeholder** opens an action sheet with:
   - "Take photo" (camera)
   - "Choose from library" (photo gallery)
   - "Generate image" (AI-generated — calls existing Pexels/generated image flow from the Speak a Recipe feature)

4. **Plan-gating:** The option to add personal photos is limited by plan level. Check the current user's plan from the preferences/auth store. If the user is on Free tier and at their photo limit, show an upgrade prompt instead of the file picker. Check CLAUDE.md or the existing subscription guard pattern for the correct plan gate implementation.

5. **Saving:** Image changes are saved when the user saves the recipe (not immediately on selection). Photos are uploaded to Supabase Storage in `recipe_user_photos` bucket as per the existing web implementation.

---

## FEATURE 2 — Multiple images on scanned/spoken recipes + image selection (Item 9)

### Current behaviour
Scanned and spoken recipes on mobile import without offering image selection. The web Speak flow already offers a Pexels image picker — mobile does not.

### Changes required

**Scan flow (receipt/photo scan → recipe):**
- The scanned page image(s) should automatically be added to `recipe_user_photos` for that recipe once it's saved. The scan photo is one of the images, not the hero unless the user sets it.
- After the recipe is confirmed and saved, show a brief "Add a cover photo?" prompt (non-blocking, dismissible) that opens the image picker (camera / library / generated). This is not mandatory — user can skip.

**Speak a Recipe flow (mobile):**
- After the recipe is generated from voice, before saving, show the same 3-image Pexels picker that already exists in the web Speak flow.
- Reuse the Pexels search logic from `@chefsbook/ai` or the web implementation. The search query should be the recipe title.
- The user can skip image selection — recipe saves without a hero image in that case.

**All import flows (URL, file, YouTube):**
- If the import result has no image, after save show the same non-blocking "Add a cover photo?" prompt.

**Multiple images:**
- `recipe_user_photos` already supports multiple images per recipe (from the web implementation).
- On mobile recipe detail, the image gallery already renders from this table.
- Ensure the mobile gallery allows scrolling through multiple images (horizontal `FlatList` or `ScrollView`), consistent with the web gallery behaviour.

---

## FEATURE 3 — Multi-page recipe scanning (Item 10, scanning portion only)

### Current behaviour
The scan flow supports a single page/photo per scan session.

### Target behaviour

In the Scan/Import tab, when the user initiates a recipe scan:

1. Show the camera view as usual. After capturing the first page, instead of immediately processing:
   - Show a preview of the captured page (small thumbnail).
   - Show two buttons: **"Add another page"** and **"Done scanning"**.
2. "Add another page" returns to the camera to capture additional pages (up to 5 pages max).
3. All captured page images are shown in a horizontal thumbnail strip above the action buttons so the user can review what they've captured. Individual thumbnails can be removed with a `×` button.
4. "Done scanning" sends all captured images to the Claude Vision OCR pipeline.
5. Claude Vision OCR: send all pages in a single API call as multiple images in the `content` array. Prompt Claude to treat them as a single multi-page recipe and return one unified recipe JSON.
6. The first scanned page image is automatically added to `recipe_user_photos` for the saved recipe (as per Feature 2 above).
7. Subsequent pages are not auto-added as recipe photos (they are source material, not presentation images).

**API call structure for multi-page:**
```ts
// In @chefsbook/ai — extend the existing recipe scan function
content: [
  { type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: page1 } },
  { type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: page2 } },
  // ... up to 5 pages
  { type: 'text', text: 'These images are pages of a single recipe. Extract all ingredients and steps into one unified recipe. ...' }
]
```

---

## WEB PARITY FLAGS

Add `// TODO(web): replicate multi-page scan support` in the scan API route in `apps/web`.
Add `// TODO(web): show image picker after Speak a Recipe save if no image` if not already present.

---

## MIGRATION

If new columns are needed on `recipe_user_photos` (e.g. `source: 'scan' | 'user' | 'generated'`), create `packages/db/migrations/013_recipe_photo_source.sql`. Apply to RPi5. Keep it minimal.

---

## COMPLETION CHECKLIST

Before wrapping:
- [ ] Edit mode shows image gallery with add/delete/set-primary controls
- [ ] Empty image state shows dashed placeholder with `+`
- [ ] Plan gate applied to personal photo uploads
- [ ] Scan pages are auto-added to recipe photos on save
- [ ] Speak a Recipe shows Pexels picker before save (mobile)
- [ ] Import flows show "Add cover photo?" prompt when no image
- [ ] Multi-page scan: capture up to 5 pages, thumbnail strip UI
- [ ] Multi-page: all pages sent to Claude Vision in single call
- [ ] No regressions in existing scan, speak, or import flows
- [ ] Web parity TODO comments added
- [ ] Run `/wrapup` to update DONE.md and CLAUDE.md
