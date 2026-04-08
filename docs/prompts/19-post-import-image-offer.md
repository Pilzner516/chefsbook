# ChefsBook — Session: Post-Import Image Offer Flow
# Source: Product discussion — scan/import should offer available images to user
# Target: apps/mobile + @chefsbook/ai

---

## CONTEXT

After any recipe import (URL, camera scan, file, speak), the user should be presented with
the best available image options before the recipe is saved. Currently images are either
silently stored or ignored. This session creates a consistent post-import image review step.

There are three import types, each with different image availability:

---

## SCENARIO A — URL import (web page scraping)

Web recipe pages almost always have a food photograph. The import pipeline already extracts
`image_url` from JSON-LD or page metadata — but the user never gets to review or choose it.

**Fix:**
After URL import, if `image_url` was extracted from the page, include it in the image offer
step as the first option labeled "From website".

If no `image_url` was found, go straight to the Pexels picker (already built).

---

## SCENARIO B — Camera scan (photo of recipe card or cookbook page)

The scanned page image is a photo of a document, not a dish. However, some cookbook pages
include a food photograph alongside the recipe text. Claude Vision should detect this.

**Fix:**
In the Claude Vision OCR prompt for recipe scanning (`scanRecipeMultiPage` in `@chefsbook/ai`),
add a field to the response JSON:

```json
{
  "title": "...",
  "ingredients": [...],
  "steps": [...],
  "has_food_photo": true,
  "food_photo_region": "top-right"
}
```

Prompt addition:
```
Also identify if the scanned page(s) contain a photograph of the finished dish (not the
recipe text, not ingredients laid out, but an actual plated food photo).
Return "has_food_photo": true if found, "food_photo_region": one of
"top-left", "top-right", "bottom-left", "bottom-right", "full-page", or null if not found.
```

If `has_food_photo` is true, include the scanned page image as an option in the offer step
labeled "From scan" — the user can choose it knowing it's a photo of the dish from the book.

If `has_food_photo` is false, do not offer the scan image (it's just text/document).

---

## SCENARIO C — Speak a Recipe

Already handled in session 04 — Pexels picker shown before save. No change needed.

---

## THE IMAGE OFFER STEP — consistent UI after all imports

After any import completes (URL, scan, file) and before the recipe is saved, show a
**"Choose a photo"** bottom sheet. This replaces/consolidates the existing "Add a cover
photo?" prompt.

### Layout of the bottom sheet

```
┌─────────────────────────────────────────┐
│  Choose a cover photo          [Skip]   │
│─────────────────────────────────────────│
│                                         │
│  [Option 1 — if available]              │
│  ┌─────────────┐                        │
│  │             │  From website          │
│  │  <image>    │  The recipe's original │
│  │             │  photo                 │
│  └─────────────┘                        │
│                                         │
│  [Option 2 — if scan has food photo]    │
│  ┌─────────────┐                        │
│  │             │  From scan             │
│  │  <image>    │  Photo found in        │
│  │             │  scanned page          │
│  └─────────────┘                        │
│                                         │
│  [Always shown — Pexels]               │
│  ┌──────┐ ┌──────┐ ┌──────┐           │
│  │      │ │      │ │      │  Find a    │
│  │ img1 │ │ img2 │ │ img3 │  photo     │
│  └──────┘ └──────┘ └──────┘           │
│  (tap one of the 3 Pexels results)     │
│                                         │
│  [Always shown — own photo]            │
│  📷 Take photo  📁 Choose from library │
│                                         │
│                [Skip →]                 │
└─────────────────────────────────────────┘
```

### Behaviour

- The bottom sheet always shows Pexels results (pre-fetched using the recipe title while
  the import was processing — do the Pexels search in parallel with the import, not after,
  so results are ready immediately when the sheet opens).
- Website image and scan image options only appear when available.
- Tapping any image selects it as the cover photo and closes the sheet.
- "Skip" saves the recipe without a cover photo (chef's hat placeholder shown).
- After selection, the recipe is saved with the chosen image uploaded to `recipe_user_photos`.

### Pre-fetching Pexels in parallel

```ts
// In the import handler, run these in parallel:
const [importResult, pexelsPhotos] = await Promise.all([
  importRecipeFromUrl(url),
  searchPexels(recipeTitleGuess ?? url)  // use URL domain as fallback query if title unknown
]);
```

If the Pexels search completes before the import, the results are ready to display instantly
when the sheet opens. If the import finishes first, show a brief loading state for Pexels only.

---

## IMPLEMENTATION ORDER

1. Update `scanRecipeMultiPage()` in `@chefsbook/ai` to return `has_food_photo` +
   `food_photo_region` in the response JSON.
2. Update the scan result type/interface to include these fields.
3. Create a shared `PostImportImageSheet` component (bottom sheet) with the layout above.
4. Wire it into:
   - URL import flow (after successful import, before save)
   - Camera scan flow (after OCR result, before save)
   - File import flow (after parse, before save)
5. Pre-fetch Pexels in parallel with the import in all three flows.
6. Remove the old "Add a cover photo?" prompt — replaced by this sheet.

---

## WHAT NOT TO CHANGE

- Speak a Recipe image picker (session 04) — already works well, leave it alone
- The hero gallery and edit mode image management (session 18) — unchanged
- The Pexels search function itself — reuse as-is

---

## COMPLETION CHECKLIST

- [ ] `scanRecipeMultiPage()` returns `has_food_photo` + `food_photo_region`
- [ ] `PostImportImageSheet` component created with correct layout
- [ ] Website image option shown when URL import returns an image_url
- [ ] Scan image option shown only when `has_food_photo` is true
- [ ] Pexels pre-fetched in parallel with import (not sequentially after)
- [ ] All 3 import flows (URL, scan, file) wire into `PostImportImageSheet`
- [ ] Old "Add a cover photo?" prompt removed
- [ ] Skip saves recipe without image (chef's hat shown)
- [ ] Selected image uploaded to recipe_user_photos and appears as hero
- [ ] No regressions in existing scan, URL import, or speak flows
- [ ] Run `/wrapup` to update DONE.md and CLAUDE.md
