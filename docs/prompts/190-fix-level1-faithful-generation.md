# ChefsBook — Session 189: Fix Level 1 Faithful Generation Not Matching Source
# Target: apps/web/app/api/recipes/generate-image, packages/ai/src/imageGeneration.ts

---

## CONTEXT

Read CLAUDE.md, DONE.md, .claude/agents/testing.md, .claude/agents/deployment.md,
.claude/agents/image-system.md, and .claude/agents/ai-cost.md before starting.
Run all pre-flight checklists.

## PROBLEM

Image creativity is set to Level 1 (Very Faithful) in /admin/settings.
A Sicilian Pan Pizza was imported from kitchenandcraft.com — the source is a
rectangular sheet pan pizza with square slices, red onions, sausage, overhead shot.
The generated image is a round cast-iron pepperoni pizza — completely different
dish style, angle, and toppings.

Level 1 must produce an image that closely matches the source. It is not doing so.
Session 181 claimed to fix this — it has not held.

---

## PART 1 — Diagnose before touching any code

Run all of these before writing a single line.

### Check source_image_description on the affected recipe
```bash
docker exec -it supabase-db psql -U postgres -c "
  SELECT id, title, source_url,
         LEFT(source_image_description, 300) as description_preview
  FROM recipes
  WHERE title ILIKE '%sicilian%'
  ORDER BY created_at DESC LIMIT 5;
"
```
If source_image_description is NULL — describeSourceImage() was never called
or never saved for this recipe. This is the root cause.

### Check what creativity level is actually being read at generation time
```bash
docker exec -it supabase-db psql -U postgres -c "
  SELECT key, value FROM system_settings
  WHERE key = 'image_creativity_level';
"
```
Confirm it is '1', not '3'.

### Check ai_image_prompt used for the last generation
```bash
docker exec -it supabase-db psql -U postgres -c "
  SELECT ai_image_prompt FROM recipes
  WHERE title ILIKE '%sicilian%'
  ORDER BY created_at DESC LIMIT 3;
"
```
If the prompt does not reference the source description, buildImagePrompt()
is not receiving it — either source_image_description is NULL or the level
is being ignored.

### Check whether describeSourceImage() was logged for this recipe
```bash
docker exec -it supabase-db psql -U postgres -c "
  SELECT action, success, created_at FROM ai_usage_log
  WHERE recipe_id = '<id>'
  ORDER BY created_at ASC;
"
```

Report all findings before proceeding.

---

## PART 2 — Fix whatever the diagnosis reveals

The fix depends entirely on Part 1 findings. Do not pre-assume the cause.

Likely scenarios and their fixes:

**If source_image_description is NULL:**
describeSourceImage() is not being called during import for this recipe.
Find why — is it behind a condition that wasn't met? Did it fail silently?
Fix the import pipeline so describeSourceImage() is called and saved reliably
for every import that has a source image URL. This is a CODE FIX.

**If source_image_description is populated but not in the prompt:**
buildImagePrompt() is not reading it correctly at level 1.
Fix buildImagePrompt() to include it prominently at levels 1-2. CODE FIX.

**If the creativity level is being read as 3 instead of 1:**
The route is not reading system_settings correctly or is hardcoding a default.
Fix the route to read the live setting. CODE FIX.

**If all three are correct but the output is still wrong:**
The prompt is not strong enough to constrain Replicate at level 1.
Strengthen the level 1 prompt language to be more directive about matching
the source description. CODE FIX.

---

## PART 3 — Fix auto-image-generation on import

Every recipe import should automatically trigger image generation without the
user needing to click anything. Currently users have to open the recipe and
manually click "Generate Image" — this is wrong.

### Diagnose first
Find where in the import pipeline image generation is triggered after a
successful import. Check:
- apps/web/app/api/import/url/route.ts
- apps/web/app/api/extension/import/route.ts

Is triggerImageGeneration() (or equivalent) called after the recipe is saved?
If not, this is the missing piece. If yes, find why it is not firing reliably.

### Fix
After a successful import where the recipe has a title and at least 2
ingredients, automatically trigger image generation in the background.
This must be fire-and-forget — do not await it or block the import response.
The user should see their recipe immediately while the image generates in the
background (existing polling/status behaviour handles the loading state).

Apply to ALL import paths:
- URL import
- Extension import
- Any other import path that creates a recipe row

TYPE: CODE FIX required.

---

## PART 4 — Verify the fix end to end

After fixing, trigger a fresh image generation for the Sicilian Pan Pizza recipe.

Check:
1. `source_image_description` is non-null and describes a rectangular sheet pan pizza
2. `ai_image_prompt` contains the source description
3. The generated image visually resembles the source — rectangular shape,
   overhead angle, similar toppings — not a generic round pizza

If Replicate credits are available, run the full generation test.
If not, at minimum confirm points 1 and 2 from the DB before deploying.

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

- [ ] Auto-generation fires on URL import without user clicking anything
- [ ] Auto-generation fires on extension import without user clicking anything
- [ ] Image generation is fire-and-forget — import response is not delayed
- [ ] Diagnosed: source_image_description status confirmed for affected recipe
- [ ] Diagnosed: creativity level confirmed in system_settings
- [ ] Diagnosed: ai_image_prompt content checked for last generation
- [ ] Root cause identified and documented in wrapup
- [ ] Fix applied to root cause — TYPE: CODE FIX
- [ ] source_image_description populated and non-null on affected recipe
- [ ] ai_image_prompt contains source description at level 1
- [ ] Generated image visually matches source style (if Replicate credits available)
- [ ] tsc --noEmit passes clean
- [ ] Deployed to RPi5 — chefsbk.app HTTP 200
- [ ] Run /wrapup
