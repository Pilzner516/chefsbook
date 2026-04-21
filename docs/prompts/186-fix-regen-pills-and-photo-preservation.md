# ChefsBook — Session 186: Fix Regen Pill Selection + Preserve Original as Thumbnail
# Target: apps/web (regenerate-image route, Change Image popup, recipe photo gallery)

---

## CONTEXT

Read CLAUDE.md, DONE.md, .claude/agents/testing.md, .claude/agents/deployment.md,
.claude/agents/image-system.md, .claude/agents/ui-guardian.md, and
.claude/agents/feature-registry.md before starting.
Run all pre-flight checklists.

---

## TWO THINGS TO FIX

### Fix 1 — Verify and fix pill selection flowing into the Replicate prompt

Audit the full regen flow end to end:
- User selects a pill in the Change Image popup (e.g. "wrong_dish", "brighter",
  "closer")
- That selection must be sent in the POST body to /api/recipes/regenerate-image
- The route must pass it to buildImagePrompt() as a modifier
- buildImagePrompt() must include it in the final prompt string sent to Replicate

Trace this entire chain in the actual code. Do not assume it works.
Confirm at each step that the pill value is present and not being dropped.

If any step in the chain drops the pill selection, fix it.

Verify by checking the ai_image_prompt column in the DB after a regen with
a specific pill selected — the prompt must contain language matching that pill.

---

### Fix 2 — Regen adds a new photo, preserves original as selectable thumbnail

#### Current (wrong) behaviour
Regen overwrites the existing primary AI photo. The user loses their original
with no way to recover it.

#### Required behaviour
- When a regen completes, add the new image as a NEW row in recipe_user_photos
- Set the new image as primary (is_primary = true)
- Set the previous primary image to is_primary = false — do NOT delete it
- The previous image remains visible as a thumbnail in "Your Photos" gallery
- The user can tap any thumbnail to set it as primary
- The user can delete any non-primary photo manually
- regen_count increments as before

This means the user always has a choice between their images and can revert
to a previous generation if they prefer it.

#### Plan limits apply
The total number of photos per recipe is already governed by plan limits
(images_per_recipe in plan_limits table). Regen must respect this limit.
If the user is at their photo limit, regen should either:
- Replace the current primary (current behaviour) — only in this case
- Or prompt the user to delete a photo first before regenning

Check what the current plan limits are for images_per_recipe before deciding.

---

## RULES

- Diagnose before writing any code
- Fix root causes only — no patches
- Verify each fix with a real regen test, checking both the DB and the UI
- TYPE: CODE FIX required for both — data-only fixes are not acceptable here

---

## VERIFICATION

### Fix 1
- Select "wrong_dish" pill and trigger regen
- Check ai_image_prompt in DB — must contain explicit wrong_dish instruction
- Select "brighter" pill and trigger regen
- Check ai_image_prompt — must contain brighter instruction
- The two prompts must be materially different from each other

### Fix 2
- Trigger a regen on any recipe
- Check recipe_user_photos — must show 2 rows (old + new), new is_primary=true
- Old photo thumbnail must appear in "Your Photos" gallery
- Tapping old thumbnail must set it as primary
- regen_count must increment correctly

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

- [ ] Full pill → prompt chain traced and documented in wrapup
- [ ] Pill selection confirmed to reach Replicate prompt (verified via ai_image_prompt in DB)
- [ ] Regen adds new photo row — does not overwrite
- [ ] Previous primary photo preserved as thumbnail
- [ ] User can tap thumbnail to set as primary
- [ ] Plan photo limits respected during regen
- [ ] tsc --noEmit passes clean
- [ ] Deployed to RPi5 — chefsbk.app HTTP 200
- [ ] TYPE: CODE FIX confirmed for both fixes in wrapup
- [ ] Run /wrapup
