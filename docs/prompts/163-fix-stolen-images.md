# ChefsBook — Session 163: Audit + Fix Stolen Source Images
# Source: Crispy Chicken Katsu showing original Half-Baked Harvest photo directly
#         External image URLs in DB are a copyright violation
# Target: database + packages/ai + scripts

---

## CONTEXT

Read CLAUDE.md and DONE.md before starting.

CRITICAL: Some recipe_user_photos rows contain URLs pointing to
external domains (e.g. halfbakedharvest.com) instead of Supabase
storage. These are the original site photos — storing and displaying
them is a copyright violation.

All recipe images MUST be stored in Supabase storage and be either:
- AI-generated (is_ai_generated = true, stored in recipe-user-photos bucket)
- User-uploaded (uploaded by the user, stored in recipe-user-photos bucket)

Never: external URLs from recipe source sites.

---

## STEP 1 — Audit all recipe_user_photos for external URLs

```sql
-- Find all photos NOT in Supabase storage
SELECT
  p.id,
  p.recipe_id,
  p.url,
  p.is_ai_generated,
  p.is_primary,
  r.title,
  r.source_url
FROM recipe_user_photos p
JOIN recipes r ON r.id = p.recipe_id
WHERE
  p.url NOT LIKE '%100.110.47.62%'
  AND p.url NOT LIKE '%chefsbk.app%'
  AND p.url NOT LIKE '%supabase%'
  AND p.url IS NOT NULL
ORDER BY p.created_at DESC;
```

Show the full list before taking any action.
Count how many external URLs are found.

---

## STEP 2 — Delete all external URL photos

For every row found in Step 1:

```sql
-- Delete external URL photo records
DELETE FROM recipe_user_photos
WHERE
  url NOT LIKE '%100.110.47.62%'
  AND url NOT LIKE '%chefsbk.app%'
  AND url NOT LIKE '%supabase%'
  AND url IS NOT NULL;
```

After deletion, identify which recipes now have NO primary photo:

```sql
SELECT r.id, r.title
FROM recipes r
LEFT JOIN recipe_user_photos p ON p.recipe_id = r.id AND p.is_primary = true
WHERE p.id IS NULL;
```

---

## STEP 3 — Generate AI images for recipes missing photos

For every recipe identified in Step 2 (no primary photo after deletion):

Run the image generation script:

```bash
ssh rasp@rpi5-eth
cd /mnt/chefsbook/repo
export SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiAiSFMyNTYiLCAidHlwIjogIkpXVCJ9.eyJyb2xlIjogInNlcnZpY2Vfcm9sZSIsICJpc3MiOiAic3VwYWJhc2UiLCAiaWF0IjogMTc1MTAwMDAwMCwgImV4cCI6IDE5MDg3NjY0MDB9.d0A4kE4okczvSWbLw9WxzVr9sr2AMdzh09Lnu7T1eXQ
export REPLICATE_API_TOKEN=r8_ZE9sar6UuIxFjL7aEBrTrUJkaoe8Mt80sd6Og
node scripts/generate-recipe-images.mjs
```

The script already processes recipes without a primary photo.
Verify each generated image:
- URL stored in Supabase storage (not external)
- is_ai_generated = true
- image_generation_status = 'complete'

---

## STEP 4 — Prevent future external URLs

In the import pipeline, ensure source image URLs are NEVER saved
as recipe photos. The source_image_url column on recipes is for
description generation only — it must never become a recipe_user_photo.

Check packages/ai/src/importFromUrl.ts and all import handlers:
- source_image_url should only be used for describeSourceImage()
- It must NEVER be inserted into recipe_user_photos
- After import, only AI-generated or user-uploaded photos go in
  recipe_user_photos

Add a safety check in the recipe_user_photos insert logic:

```typescript
async function saveRecipePhoto(recipeId: string, url: string, isAiGenerated: boolean) {
  // Safety check: never save external URLs
  const isInternalUrl = url.includes('100.110.47.62')
    || url.includes('chefsbk.app')
    || url.includes('supabase')

  if (!isInternalUrl) {
    console.error(`[SAFETY] Blocked attempt to save external URL as recipe photo: ${url}`)
    throw new Error('External URLs cannot be saved as recipe photos')
  }

  await supabaseAdmin.from('recipe_user_photos').insert({
    recipe_id: recipeId,
    url,
    is_primary: true,
    is_ai_generated: isAiGenerated
  })
}
```

---

## STEP 5 — Verify the Crispy Chicken Katsu recipe

After Steps 2-3:
1. Check: recipe_user_photos for "Crispy Chicken Katsu Noodle Bowls"
   — should have exactly 1 row with Supabase URL + is_ai_generated = true
2. Open the recipe on chefsbk.app — image should be AI-generated
3. Verify "Change image" modal shows regeneration pills (is_ai_generated = true)
4. Verify no external halfbakedharvest.com image is displayed

---

## STEP 6 — Apply watermarks to newly generated images

After generating new AI images in Step 3, apply watermarks:

```bash
node scripts/apply-watermarks.mjs
```

Verify watermark badge visible on new images.

---

## STEP 7 — Also fix the watermark script reliability

The watermark has been consistently failing silently.
Read scripts/apply-watermarks.mjs and scripts/create-watermark-badge.mjs.

Diagnose why watermark is not visible after running:
1. Run the red square test from session 160:
   - Composite a solid red 100×100 square onto a downloaded image
   - If red square appears: sharp works, badge PNG is the issue
   - If red square doesn't appear: sharp compositing is broken

2. Check badge PNG dimensions and content:
```bash
node -e "
import sharp from 'sharp'
const meta = await sharp('apps/web/public/images/watermark-chefsbook.png').metadata()
console.log(meta)
" --input-type=module
```

3. Fix root cause — do not proceed until badge is visually confirmed.

4. Re-run apply-watermarks.mjs after fix.

5. Download an image and verify badge is visible before marking done.

---

## DEPLOYMENT

Only needed if import pipeline code was changed:

```bash
ssh rasp@rpi5-eth
cd /mnt/chefsbook/repo
git pull
cd apps/web
rm -rf node_modules/react node_modules/react-dom .next
NODE_OPTIONS=--max-old-space-size=1536 npm run build 2>&1 | tail -20
pm2 restart chefsbook-web
```

---

## COMPLETION CHECKLIST

### Audit
- [ ] All recipe_user_photos audited for external URLs
- [ ] Count of external URLs found and listed
- [ ] All external URL rows deleted from recipe_user_photos

### Image replacement
- [ ] All affected recipes identified (no primary photo after deletion)
- [ ] AI images generated for all affected recipes
- [ ] All new images stored in Supabase storage (verified URLs)
- [ ] is_ai_generated = true on all new photos

### Prevention
- [ ] saveRecipePhoto() safety check added (blocks external URLs)
- [ ] source_image_url confirmed never inserted into recipe_user_photos
- [ ] Import pipeline verified: no external URLs stored as photos

### Specific recipe fix
- [ ] "Crispy Chicken Katsu Noodle Bowls" verified: AI image, Supabase URL
- [ ] Recipe detail shows correct AI image (not source site photo)
- [ ] Change image modal shows regeneration pills correctly

### Watermark
- [ ] Red square test run to diagnose sharp compositing
- [ ] Root cause of invisible watermark identified and fixed
- [ ] apply-watermarks.mjs re-run after fix
- [ ] Image downloaded and badge visually confirmed bottom-right
- [ ] Watermarks applied to all newly generated images

### General
- [ ] feature-registry.md updated
- [ ] Committed and pushed
- [ ] Run /wrapup
- [ ] At the end: how many external URLs were found and deleted,
      how many AI images generated as replacements,
      confirm watermark is now visible (describe what you see).
