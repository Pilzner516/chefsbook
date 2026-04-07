# ChefsBook — Session: Recipe Image Picker — Pexels + Default Placeholder
# Source: Post-QA review
# Target: apps/mobile (primary), verify web already has this

---

## CONTEXT

Recipe image selection on mobile currently offers camera and photo library only. The web app
offers a third option: a Pexels-powered picker that searches for 3 relevant images by recipe
name and lets the user choose one. Mobile needs the same. Additionally, the default state when
a recipe has no image should show the ChefsBook chef's hat logo, not a generic placeholder.

Read CLAUDE.md and check the navigator agent map before starting. Check the web Speak a Recipe
implementation for the existing Pexels integration to reuse as much as possible.

---

## FEATURE 1 — Pexels 3-image picker on mobile

### Where it appears

Add the Pexels option in every place the image picker action sheet appears on mobile:
- Recipe detail edit mode (EditImageGallery component — the `+` button / dashed placeholder)
- Speak a Recipe Step 3 (already added in session 04 with camera/library — add Pexels here too)
- "Add a cover photo?" prompt shown after URL import with no image

### Behaviour

When the user taps "Find a photo" (or equivalent label) from the action sheet:

1. Show a loading state ("Searching for photos…") while the Pexels API call runs.
2. Search Pexels using the recipe title as the query. If the title is empty or too short,
   fall back to the recipe's cuisine or first ingredient.
3. Fetch exactly 3 results. Display them as a horizontal row of tappable image thumbnails
   in a modal or bottom sheet — same pattern as the web implementation.
4. Each thumbnail is tappable. Tapping one:
   - Selects it (show a checkmark or highlight border).
   - Closes the picker.
   - Sets it as the recipe's hero image (uploaded to Supabase Storage in `recipe-images`
     bucket, same as camera/library uploads).
5. Include a "Cancel" option to dismiss without selecting.

### Pexels API

The Pexels API key and search function should already exist in `@chefsbook/ai` or
`apps/web` — find and reuse it. Do not create a duplicate implementation.

If the key is only in `apps/web`, move it to `packages/shared` or `@chefsbook/ai` so both
platforms share it. The key must be in an environment variable — never hardcoded.

Pexels search endpoint:
```
GET https://api.pexels.com/v1/search?query=[recipe name]&per_page=3&orientation=landscape
Authorization: [PEXELS_API_KEY]
```

Response: use `photos[].src.medium` for thumbnails and `photos[].src.large2x` for the
full-resolution image that gets uploaded.

### Action sheet options (final list)

The image picker action sheet on mobile should now offer:
1. "Take photo" → camera
2. "Choose from library" → photo library
3. "Find a photo" → Pexels 3-image picker
4. "Cancel"

---

## FEATURE 2 — Default recipe image: ChefsBook chef's hat logo

### Current behaviour
When a recipe has no image, a generic placeholder is shown (cream background + restaurant icon,
or similar).

### Target behaviour
When a recipe has no image, display the ChefsBook chef's hat logo as the placeholder image.
This applies everywhere a recipe image is shown:
- Recipe detail hero image area
- Recipe cards in list/grid view
- Meal plan day cards
- Shopping list recipe group headers (if image shown)

### Implementation

1. Locate the chef's hat asset already used on the landing/splash screen. It should be in
   `apps/mobile/assets/` — confirm the filename.

2. Replace every generic placeholder with this asset. The pattern to use:
   ```tsx
   <Image
     source={recipe.image_url
       ? { uri: recipe.image_url }
       : require('../assets/chefs-hat.png')} // adjust path as needed
     style={styles.recipeImage}
   />
   ```

3. For the EditImageGallery dashed placeholder zone (edit mode, no images yet): keep the
   dashed border and `+` icon, but place the chef's hat logo centered inside the dashed area
   at reduced opacity (0.15–0.2) as a watermark-style hint. The `+` icon and "Add photo"
   label remain the primary affordance.

4. Apply consistently across all recipe card and detail components. Use a single shared
   `RecipeImage` component if one doesn't already exist, so the fallback logic lives in one
   place.

---

## WEB VERIFY

Confirm the web app already has:
- [ ] Pexels 3-image picker on recipe edit
- [ ] Chef's hat logo as default recipe image placeholder

If either is missing on web, add a `// TODO(web):` comment for the parity session.

---

## COMPLETION CHECKLIST

- [ ] Pexels 3-image picker added to EditImageGallery action sheet
- [ ] Pexels picker added to Speak a Recipe Step 3 action sheet
- [ ] Pexels picker added to "Add cover photo?" post-import prompt
- [ ] Pexels API key in env var, search function shared via `@chefsbook/ai` or `packages/shared`
- [ ] 3 thumbnails displayed in horizontal picker, tappable, full-res uploaded on select
- [ ] Action sheet shows all 4 options: Take photo / Choose from library / Find a photo / Cancel
- [ ] Chef's hat logo shown as default when recipe has no image (cards + detail + meal plan)
- [ ] Chef's hat shown at low opacity in edit mode dashed placeholder zone
- [ ] Single shared `RecipeImage` component used for consistent fallback logic
- [ ] No regressions in existing camera/library upload flow
- [ ] Web parity verified or TODOs added
- [ ] Run `/wrapup` to update DONE.md and CLAUDE.md
