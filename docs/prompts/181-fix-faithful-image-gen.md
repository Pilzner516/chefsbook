# ChefsBook — Session 181: Fix Faithful Image Generation (Levels 1-2)
# Target: packages/ai/src/imageGeneration.ts, apps/web/app/api/recipes/generate-image/route.ts
# apps/web/app/api/recipes/regenerate-image/route.ts

---

## CONTEXT

Read CLAUDE.md, DONE.md, .claude/agents/testing.md, .claude/agents/deployment.md,
.claude/agents/ai-cost.md, and .claude/agents/feature-registry.md before starting.
Run all pre-flight checklists.

## PROBLEM

At creativity level 2 ("Faithful"), the generated image is completely wrong.
A rectangular sheet-pan Sicilian pizza with pepperoni, mushrooms, green peppers,
and bacon was regenerated as a round Neapolitan pizza with tomatoes and basil.
This is the opposite dish style — not a faithful interpretation.

Levels 1-2 are supposed to use describeSourceImage() to anchor the generation
to the original source photo. Something in this pipeline is broken.

---

## PART 1 — Diagnose before touching any code

### Step 1 — Check what creativity level is currently set
```bash
docker exec -it supabase-db psql -U postgres -c "
  SELECT key, value FROM system_settings
  WHERE key = 'image_creativity_level';
"
```
Report the value. If it is 3 or above, levels 1-2 were never being used —
the UI may have defaulted to 3 and never been changed. Note this.

### Step 2 — Check whether source_image_description is being populated
```bash
docker exec -it supabase-db psql -U postgres -c "
  SELECT id, title, source_image_description
  FROM recipes
  WHERE title ILIKE '%sicilian%' OR title ILIKE '%pizza%'
  ORDER BY created_at DESC
  LIMIT 5;
"
```
If source_image_description is NULL on the pizza recipe, describeSourceImage()
either was never called or failed silently. This is the root cause.

### Step 3 — Check buildImagePrompt() logic
Read packages/ai/src/imageGeneration.ts (or wherever buildImagePrompt lives).
Confirm:
- At levels 1-2, does it actually include source_image_description in the prompt?
- Does it fall back gracefully or silently drop it when the field is NULL?
- Is the creativityLevel parameter actually being passed from the route, or
  is it hardcoded / defaulting to 3?

Report findings from all 3 steps before writing any code.

---

## PART 2 — Fix describeSourceImage() population

### Problem
source_image_description is only useful at levels 1-2. If it is NULL,
faithful generation is impossible regardless of what the prompt says.

### Fix
In the import pipeline (apps/web/app/api/import/url/route.ts and
apps/web/app/api/extension/import/route.ts):

After a recipe is imported and has an og:image or source image URL:
- Call describeSourceImage() to get a text description of the source photo
- Save the result to recipes.source_image_description
- If describeSourceImage() fails or times out, set source_image_description
  to NULL silently — do not block the import

Check whether this is already wired. If it is wired but the field is still
NULL on imported recipes, find where it is breaking and fix it.

If describeSourceImage() is NOT being called at import time at all, add it.
Log the call via logAiCall() with action: 'describe_source_image', model: 'haiku'.

---

## PART 3 — Fix buildImagePrompt() for levels 1-2

Read the current implementation of buildImagePrompt() carefully.

### Required behaviour by level:
- Level 1 (Very Faithful): source_image_description MUST be in the prompt,
  prominently. If NULL, warn in logs and treat as level 3.
- Level 2 (Faithful): source_image_description included as strong guidance.
  If NULL, warn in logs and treat as level 3.
- Level 3 (Balanced): title + ingredients only. source_image_description ignored.
- Level 4-5 (Creative / Very Creative): title + ingredients only, with
  explicit instruction to be creative and not reproduce the source.

Fix the prompt construction so levels 1-2 produce meaningfully different
(more faithful) prompts than levels 3-5. The current output proves they are
not differentiated.

Example structure for level 2 prompt:
```
Generate a high-quality food photograph of: [dish title]

Style reference: The image should closely resemble this description of the
original dish: [source_image_description]

Key ingredients visible: [top ingredients list]

Requirements: professional food photography, same dish style and presentation
as described above, appetising, well-lit.
```

Example structure for level 3+ prompt:
```
Generate a high-quality food photograph of: [dish title]

Key ingredients: [top ingredients list]

Requirements: professional food photography, appetising, well-lit.
```

### Also fix: creativityLevel must be read from system_settings at call time
Confirm that generate-image/route.ts and regenerate-image/route.ts both:
1. Read image_creativity_level from system_settings (or pass it as a param)
2. Pass the actual value to buildImagePrompt()
3. Do NOT hardcode a default of 3 without reading the DB setting first

---

## PART 4 — Backfill source_image_description for existing recipes

For recipes that have a known source_url and NULL source_image_description,
we can attempt to backfill by re-fetching the og:image.

Do NOT build this as an automated backfill — too risky to run at scale.
Instead, add a button to the admin incomplete-recipes page or recipe detail
that triggers describeSourceImage() for a single recipe on demand.

This is a low-priority addition — only implement if Parts 1-3 are fully
complete and verified. If short on time, skip Part 4 and note it in wrapup.

---

## VERIFICATION

### After deploying:
1. On chefsbk.app, import a recipe that has a clear og:image (a recipe with a
   distinctive-looking dish — not a generic photo)
2. Check source_image_description was populated:
```bash
docker exec -it supabase-db psql -U postgres -c "
  SELECT title, LEFT(source_image_description, 200)
  FROM recipes
  ORDER BY created_at DESC
  LIMIT 3;
"
```
3. Set creativity level to 2 in /admin/settings
4. Regenerate the image for that recipe
5. Confirm the generated image resembles the source dish style — same shape,
   same dominant ingredients, same presentation style

---

## DEPLOYMENT

```bash
ssh rasp@rpi5-eth
cd /mnt/chefsbook/repo
git pull
rm -rf apps/web/.next
cd apps/web
NODE_OPTIONS=--max-old-space-size=1024 npx next build --no-lint 2>&1 | tail -20
pm2 restart chefsbook-web
```

---

## COMPLETION CHECKLIST

- [ ] Diagnosed: confirmed whether source_image_description was NULL on pizza recipe
- [ ] Diagnosed: confirmed creativity level in system_settings at time of regen
- [ ] Diagnosed: confirmed whether buildImagePrompt() differentiates levels 1-2 from 3+
- [ ] describeSourceImage() called at import time and saved to DB
- [ ] buildImagePrompt() produces meaningfully different prompts at levels 1-2 vs 3+
- [ ] creativityLevel read from system_settings in both generate + regenerate routes
- [ ] New import: source_image_description populated and non-null
- [ ] Level 2 regen: generated image visually resembles source dish style
- [ ] tsc --noEmit passes clean
- [ ] Deployed to RPi5 — chefsbk.app HTTP 200
- [ ] Run /wrapup to update DONE.md and CLAUDE.md
