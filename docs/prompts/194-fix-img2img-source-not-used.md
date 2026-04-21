# ChefsBook — Session 194: Diagnose + Fix img2img Not Using Source Image
# Target: apps/web/app/api/recipes/generate-image, packages/ai/src/imageGeneration.ts

---

## CONTEXT

Read CLAUDE.md, DONE.md, .claude/agents/testing.md, .claude/agents/deployment.md,
.claude/agents/image-system.md, and .claude/agents/ai-cost.md before starting.
Run all pre-flight checklists.

## PROBLEM

Level 1 (Very Faithful) is still generating completely wrong images after
session 192 implemented img2img. Sous Vide Pulled Pork Shoulder from
seriouseats.com generated a sliced rolled pork loin on noodles — completely
different dish, plating, and angle from the source (shredded pulled pork with
coleslaw and pickle on a white plate).

img2img is either not receiving the source image or falling back to
text-to-image silently.

---

## PART 1 — Diagnose via DB first, no code changes

```bash
docker exec -it supabase-db psql -U postgres -c "
  SELECT id, title, source_url, source_image_url,
         LEFT(source_image_description, 100) as desc_preview,
         LEFT(ai_image_prompt, 200) as prompt_preview
  FROM recipes
  WHERE title ILIKE '%pulled pork%'
  ORDER BY created_at DESC LIMIT 3;
"
```

Report:
1. Is source_image_url populated or NULL?
2. Does ai_image_prompt contain any reference to the source image or
   prompt_strength? Or does it look like a plain text-to-image prompt?
3. Does the prompt mention shredded/pulled pork or something else entirely?

Then check the Replicate call in the codebase:
```bash
grep -n "prompt_strength\|source_image\|image:" apps/web/app/api/recipes/generate-image/route.ts
grep -n "prompt_strength\|source_image\|image:" apps/web/lib/imageGeneration.ts
```

Confirm the prompt_strength and image parameters are actually being sent to
Replicate — not just computed but silently dropped.

Report all findings before writing any code.

---

## PART 2 — Fix the confirmed root cause

Based on Part 1, fix whichever of these is the actual problem:

**If source_image_url is NULL:**
The import pipeline is not saving the og:image URL for seriouseats.com recipes.
Find why and fix the import route to reliably capture and save source_image_url.
TYPE: CODE FIX.

**If source_image_url is populated but not passed to Replicate:**
The generate-image route is fetching it but dropping it before the API call.
Trace the full call chain and fix the gap. TYPE: CODE FIX.

**If prompt_strength is not in the Replicate payload:**
The parameter is being computed but not included in the API body sent to
Replicate. Fix the API call construction. TYPE: CODE FIX.

**If the Replicate API is rejecting the image URL:**
seriouseats.com may block hotlinking — Replicate cannot fetch the source image
directly. In this case the fix is to download the og:image server-side and
pass it as base64 or upload it to Supabase storage temporarily before sending
to Replicate. TYPE: CODE FIX.

---

## PART 3 — Verify with a live generation

After the fix, trigger a fresh Level 1 generation for the pulled pork recipe.

The generated image must show:
- Shredded/pulled pork (not sliced or rolled)
- White plate presentation
- Coleslaw or similar sides visible
- Bright casual BBQ plating — not dramatic close-up noodle bowl

Check ai_image_prompt in DB after generation to confirm the prompt references
the source image description, not generic pork language.

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

- [ ] Part 1 diagnostic run — source_image_url status and prompt content reported
- [ ] Root cause identified — one of the 4 scenarios confirmed
- [ ] Fix applied to root cause only — TYPE: CODE FIX
- [ ] Level 1 generation visually matches pulled pork source (shredded, white plate, BBQ style)
- [ ] ai_image_prompt confirms source description is being used
- [ ] tsc --noEmit passes clean
- [ ] Deployed to RPi5 — chefsbk.app HTTP 200
- [ ] Run /wrapup
