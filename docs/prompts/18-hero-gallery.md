# ChefsBook — Session: Hero Image Gallery + Primary Image Selection
# Source: Emulator screenshot — chef's hat showing alongside uploaded image instead of replacing it
# Target: apps/mobile

---

## CONTEXT

From the screenshot, the recipe detail shows:
- Chef's hat placeholder in the large hero zone at the top
- The actual uploaded image appearing as a small thumbnail below the title

These should not coexist. The uploaded image should BE the hero. Multiple images should be
a swipeable horizontal gallery in the hero zone. The chef's hat only shows when there are
zero images.

Read CLAUDE.md and the navigator agent map before starting.

---

## FIX 1 — Hero zone: replace placeholder with swipeable image gallery

### Current behaviour
- Chef's hat placeholder always renders in the hero zone regardless of whether images exist
- Uploaded images appear as a separate small thumbnail section below

### Target behaviour

The hero zone at the top of the recipe detail screen works as follows:

**When the recipe has 0 images:**
- Show the chef's hat logo centered in the hero zone (current placeholder — keep this)

**When the recipe has 1 image:**
- Show that image as the full-width hero, no chef's hat
- No swipe indicator needed

**When the recipe has 2–4 images:**
- Show a swipeable horizontal pager (use `FlatList` horizontal or `PagerView`)
- Each page is one image, full-width hero
- Show dot indicators below the image (e.g. ● ○ ○) to indicate position
- Swipe left/right to move between images
- The **primary image** (the one marked `is_primary = true` in `recipe_user_photos`, or
  the first image if none is marked) shows first

**Maximum 4 images displayed in the gallery.** If more exist in DB, show only the first 4
(ordered by `is_primary DESC, created_at ASC`).

### Implementation notes

- Query `recipe_user_photos` for this recipe, ordered by `is_primary DESC, created_at ASC`,
  limit 4
- All image `<Image>` components need the Kong apikey header (established in session 17):
  ```tsx
  source={{
    uri: photo.photo_url,
    headers: { apikey: SUPABASE_ANON_KEY }
  }}
  ```
- Remove the separate thumbnail gallery section that currently sits below the title —
  it is replaced entirely by the hero pager
- The hero zone height should remain consistent (same as current chef's hat zone height)

---

## FIX 2 — Primary image selection via long-press in edit mode

### Current behaviour
The edit mode shows image thumbnails with a `×` delete button. Long-press is mentioned in
the UI ("Long press to set primary image") but may not be fully wired.

### Target behaviour

In `EditImageGallery` (edit mode):

1. **Long-press on any thumbnail** → mark that image as primary:
   - Update `recipe_user_photos` SET `is_primary = true` WHERE `id = [this photo]`
   - Update all other photos for this recipe SET `is_primary = false`
   - Show a visual indicator on the primary image: a small red star or "★ Primary" label
     in the corner of the thumbnail
   - Show a brief toast: "Set as cover photo"

2. **If only 1 image exists:** it is automatically the primary, no long-press needed.
   Show the "★ Primary" indicator on it regardless.

3. **The primary image is what shows on recipe cards** in the list/grid view — this is
   already the case if `RecipeImage` uses the first `recipe_user_photos` row ordered by
   `is_primary DESC`.

### DB query for primary image on recipe cards
```ts
// In getRecipes() or wherever recipe card data is fetched:
// Join recipe_user_photos to get the primary photo URL
SELECT r.*, 
  (SELECT photo_url FROM recipe_user_photos 
   WHERE recipe_id = r.id 
   ORDER BY is_primary DESC, created_at ASC 
   LIMIT 1) as primary_photo_url
FROM recipes r
```
Use `primary_photo_url` as the image source on recipe cards. Fall back to chef's hat if null.

---

## FIX 3 — Remove the separate thumbnail strip from recipe detail (read-only)

The small thumbnail strip that currently appears below the recipe title/action bar in the
read-only recipe detail view should be removed. The hero pager (Fix 1) replaces it entirely.

If the thumbnails were added in an earlier session as a separate `recipe_user_photos` gallery
component, remove that component from the read-only recipe detail layout.

---

## FINAL LAYOUT — Recipe detail screen (read-only)

```
┌─────────────────────────────────┐
│  ← Recipe          [header]     │
├─────────────────────────────────┤
│                                 │
│   [Hero image pager — full      │
│    width, swipeable if >1 img,  │
│    chef's hat if 0 images]      │
│                                 │
│              ● ○ ○  (dots)      │
├─────────────────────────────────┤
│  ChefsBook header (lang/units)  │
├─────────────────────────────────┤
│  Title                          │
│  [tags] [cook time]             │
│  ♡  ⤴  📌  ✏️               │
│  [Add to Shopping List]         │
│  [Cook Mode]                    │
│  Ingredients...                 │
└─────────────────────────────────┘
```

---

## COMPLETION CHECKLIST

- [ ] Hero zone shows uploaded image(s) when they exist, chef's hat only when 0 images
- [ ] 2–4 images render as swipeable horizontal pager with dot indicators
- [ ] Primary image (is_primary = true) always shows first
- [ ] All image components use `apikey` header for Supabase storage URLs
- [ ] Separate thumbnail strip removed from read-only recipe detail
- [ ] Long-press on thumbnail in edit mode sets it as primary
- [ ] Primary thumbnail shows ★ indicator in edit mode
- [ ] Recipe card uses primary_photo_url, falls back to chef's hat
- [ ] No chef's hat showing alongside actual images anywhere
- [ ] Run `/wrapup` to update DONE.md and CLAUDE.md
