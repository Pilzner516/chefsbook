# ChefsBook — Session 192: All Levels Use img2img with Fidelity Spectrum
# Target: packages/ai/src/imageGeneration.ts, apps/web/app/api/recipes/generate-image,
#         apps/web/app/api/recipes/regenerate-image, apps/web/app/admin/settings

---

## CONTEXT

Read CLAUDE.md, DONE.md, .claude/agents/testing.md, .claude/agents/deployment.md,
.claude/agents/image-system.md, and .claude/agents/ai-cost.md before starting.
Run all pre-flight checklists.

---

## CONCEPT

Every creativity level now uses img2img with the source og:image as the
reference anchor. The only thing that changes between levels is prompt_strength
— how far the AI is allowed to drift from the source.

| Level | Name | prompt_strength | What it produces |
|-------|------|----------------|-----------------|
| 1 | Very Faithful | 0.2 | Nearly identical — same angle, plate, lighting, composition |
| 2 | Faithful | 0.4 | Same style and presentation, minor variation |
| 3 | Balanced | 0.6 | Same dish, noticeably different interpretation |
| 4 | Creative | 0.8 | Inspired by source, heavily reimagined |
| 5 | Very Creative | 0.95 | Almost fully generative, source barely influences |

This replaces the current split behaviour (levels 1-2 text-to-image with
description, levels 3-5 text-to-image without). All levels use Flux Dev.
All levels use img2img. prompt_strength is the only variable.

---

## PART 1 — Verify Replicate Flux Dev img2img API before writing any code

Check the exact Replicate API schema for flux-dev:
https://replicate.com/black-forest-labs/flux-dev

Confirm:
- The `image` input parameter exists and accepts a URL string
- The `prompt_strength` parameter name and its 0.0-1.0 range
- Whether any other parameters change between text-to-image and img2img
- The cost model for img2img vs text-to-image

Report exact parameter names and any constraints before proceeding.

---

## PART 2 — Store source_og_image_url on every import

The og:image URL from the source site is needed as the img2img reference.
It must be stored permanently on the recipe row.

### Check first
```bash
docker exec -it supabase-db psql -U postgres -c "\d recipes" | grep -i "og\|source_image\|original"
```
If a suitable column already exists, use it. If not:

### Migration
Create migration 047:
```sql
ALTER TABLE recipes
  ADD COLUMN IF NOT EXISTS source_og_image_url TEXT;
```
Apply on RPi5 and restart PostgREST.

### Wire into import pipeline
In apps/web/app/api/import/url/route.ts and apps/web/app/api/extension/import/route.ts:
After extracting the og:image URL during import, save it to source_og_image_url.
This column is for internal AI use only — never displayed to users.
External URLs in this column are intentional and acceptable.

---

## PART 3 — Update image generation to use img2img for all levels

### prompt_strength map
```ts
const PROMPT_STRENGTH: Record<number, number> = {
  1: 0.2,
  2: 0.4,
  3: 0.6,
  4: 0.8,
  5: 0.95,
}
```

### Model
All levels now use Flux Dev (not Schnell). Remove the level-based model
switching added in session 190.

### Replicate call update
In the image generation function, when source_og_image_url is available:
- Pass it as the `image` parameter
- Pass the prompt_strength for the current level

When source_og_image_url is NULL (recipe imported before this session,
or no og:image was available):
- Fall back to text-to-image (no image param) at the equivalent prompt_strength
- Log a warning so we know the fallback was used

### Update generate-image and regenerate-image routes
Both routes must:
1. Fetch source_og_image_url from the recipe row
2. Pass it and the current creativity level to the generation function
3. The function handles the prompt_strength mapping internally

---

## PART 4 — Update /admin/settings creativity level descriptions

Update the label descriptions to reflect the new fidelity-based behaviour:

| Level | Label | Description |
|-------|-------|-------------|
| 1 | Very Faithful | Nearly identical to source photo |
| 2 | Faithful | Same style, small variation |
| 3 | Balanced | Same dish, different take |
| 4 | Creative | Inspired by source, reimagined |
| 5 | Very Creative | Fully AI, source as loose reference |

Remove the amber copyright warning on levels 1-2 — img2img at low
prompt_strength produces clearly AI-generated images that are not copies.

---

## PART 5 — Update cost tracking

All levels now use Flux Dev. Update the cost constant for all
image generation actions in logAiCall.

Check Replicate's actual billing for Flux Dev img2img from Part 1
and use the correct cost. If img2img billing differs from text-to-image,
track them separately (action: 'generate_image_img2img' vs 'generate_image').

---

## VERIFICATION

Import the Serious Eats Sicilian Pizza (seriouseats.com) — it has a distinctive
source photo: thick rectangular slice on a white plate, dark tile background,
dramatic close-up angle, pepperoni cups.

Test all 5 levels by generating the image at each setting:

- Level 1: must be nearly identical in composition to the source
- Level 3: same dish recognisably but different style
- Level 5: creative interpretation, rectangular pizza not required

Check source_og_image_url is stored on the recipe after import:
```bash
docker exec -it supabase-db psql -U postgres -c "
  SELECT title, LEFT(source_og_image_url, 80)
  FROM recipes
  ORDER BY created_at DESC LIMIT 3;
"
```

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

- [ ] Replicate img2img parameters confirmed — image param + prompt_strength range
- [ ] Migration 047 applied — source_og_image_url column exists
- [ ] Import pipeline saves source_og_image_url on URL and extension imports
- [ ] All 5 levels use Flux Dev with img2img
- [ ] prompt_strength values: 0.2 / 0.4 / 0.6 / 0.8 / 0.95 per level
- [ ] Fallback to text-to-image when source_og_image_url is NULL
- [ ] generate-image and regenerate-image routes pass source_og_image_url
- [ ] /admin/settings level descriptions updated
- [ ] Cost constants updated for Flux Dev img2img
- [ ] Level 1 test: generated image matches source composition
- [ ] Level 5 test: generated image is creatively different
- [ ] source_og_image_url stored on newly imported recipes
- [ ] tsc --noEmit passes clean
- [ ] Deployed to RPi5 — chefsbk.app HTTP 200
- [ ] TYPE: CODE FIX — no data patches
- [ ] Run /wrapup
