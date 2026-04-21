# ChefsBook — Session 195: Fix Image Gen Race Condition + Temp Unavailable
# Target: apps/web/app/api/import/url/route.ts, apps/web/app/api/extension/import/route.ts
#         apps/web/lib/imageGeneration.ts, apps/web/app/api/recipes/generate-image/route.ts

---

## CONTEXT

Read CLAUDE.md, DONE.md, .claude/agents/testing.md, .claude/agents/deployment.md,
.claude/agents/image-system.md, and .claude/agents/ai-cost.md before starting.
Run all pre-flight checklists.

---

## BUG 1 — Race condition: first generated image always worse than second

### Symptom
The auto-generated image on import is always lower quality / less faithful
than a manually triggered second generation. The second generation is
consistently better because source_image_description is available by then.

### Root cause hypothesis
describeSourceImage() and triggerImageGeneration() are both fired after
import completes. If they run in parallel, image generation races against
the description save. When image generation wins the race, it fires with
source_image_description = NULL and produces a generic result.

### Diagnose first
In the import routes (url/route.ts and extension/import/route.ts), find
the order of operations after a recipe is saved:
- Where is describeSourceImage() called?
- Where is triggerImageGeneration() called?
- Are they awaited sequentially or fired in parallel?

Check the DB on a freshly imported recipe immediately after import:
```bash
docker exec -it supabase-db psql -U postgres -c "
  SELECT title, source_image_url,
         LEFT(source_image_description, 100) as desc,
         image_generation_status
  FROM recipes
  ORDER BY created_at DESC LIMIT 3;
"
```
If source_image_description is NULL and image_generation_status is
'generating' or 'complete' on a brand new import, the race condition
is confirmed.

### Fix
In both import routes, ensure the post-import sequence is:
1. Save recipe to DB
2. await describeSourceImage() → save result to source_image_description
3. THEN fire triggerImageGeneration() (fire-and-forget after description is saved)

describeSourceImage() is a fast Haiku vision call (~$0.005, ~1-2 seconds).
The import response to the user does not need to wait for image generation
(that stays fire-and-forget) but it MUST wait for the description before
triggering generation.

TYPE: CODE FIX — sequential ordering, not parallel.

---

## BUG 2 — "Image generation temporarily unavailable" on some recipes

### Symptom
Some recipes show the "temporarily unavailable" error state instead of
generating an image. Other recipes on the same account generate fine.

### Diagnose first
Check what error is actually being thrown:
```bash
pm2 logs chefsbook-web --lines 100 | grep -i "replicate\|image\|error\|unavailable"
```

Also check the failed recipes in the DB:
```bash
docker exec -it supabase-db psql -U postgres -c "
  SELECT title, image_generation_status, source_image_url
  FROM recipes
  WHERE image_generation_status = 'failed'
  ORDER BY updated_at DESC LIMIT 10;
"
```

Likely causes to check in order:
1. Replicate is rejecting the source_image_url (site blocks hotlinking —
   Replicate cannot fetch the image directly)
2. Replicate credit exhaustion (account balance low)
3. The fallback to text-to-image when source_image_url is NULL is itself
   failing (not falling back correctly)

### Fix based on diagnosis

**If hotlink blocking (most likely):**
The source og:image URL from sites like seriouseats.com cannot be fetched
directly by Replicate. Fix: in the generate-image route, before passing
source_image_url to Replicate, fetch the image server-side and convert to
base64, then pass as a data URI. If the server-side fetch fails (403, timeout),
fall back to text-to-image gracefully without erroring.

```ts
// Pseudo-pattern — agent determines exact implementation
async function fetchImageAsBase64(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, { headers: { 'User-Agent': '...' }, signal: AbortSignal.timeout(5000) })
    if (!res.ok) return null
    const buffer = await res.arrayBuffer()
    const base64 = Buffer.from(buffer).toString('base64')
    const mimeType = res.headers.get('content-type') || 'image/jpeg'
    return `data:${mimeType};base64,${base64}`
  } catch {
    return null
  }
}
```

If base64 fetch returns null → proceed with text-to-image (no image param).
Never throw an error to the user for this — silent fallback.

**If credit exhaustion:**
Add a balance check before generation. If Replicate balance is low,
set image_generation_status = 'pending' and return a user-friendly message
rather than 'failed'. Admin should be alerted via the system health panel.

**If fallback itself is broken:**
Fix the fallback path so NULL source_image_url always results in a valid
text-to-image call, never an error state.

TYPE: CODE FIX for whichever cause is confirmed.

---

## VERIFICATION

### Bug 1
Import a fresh recipe from any site with a clear og:image.
Immediately after import completes, check:
```bash
docker exec -it supabase-db psql -U postgres -c "
  SELECT title, source_image_description IS NOT NULL as has_desc,
         image_generation_status
  FROM recipes ORDER BY created_at DESC LIMIT 1;
"
```
source_image_description must be non-null BEFORE image_generation_status
moves to 'generating'. The first auto-generated image should be as good
as any manually triggered generation.

### Bug 2
Find a recipe that was previously failing and trigger generation again.
It must either generate successfully or fall back gracefully to text-to-image —
never show "temporarily unavailable" unless Replicate itself is down.

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

- [ ] Bug 1 diagnosed — race condition confirmed or ruled out with evidence
- [ ] Bug 1 fixed — describeSourceImage() awaited before triggerImageGeneration() fires
- [ ] Bug 1 verified — fresh import: source_image_description populated before generation starts
- [ ] Bug 1 verified — first auto-generated image quality matches manually triggered generation
- [ ] Bug 2 diagnosed — actual error logged from PM2 + failed recipes identified
- [ ] Bug 2 fixed — hotlink blocking handled via server-side base64 fetch with fallback
- [ ] Bug 2 verified — previously failing recipes now generate or fall back gracefully
- [ ] No recipe ever shows "temporarily unavailable" due to a fixable code path
- [ ] tsc --noEmit passes clean
- [ ] Deployed to RPi5 — chefsbk.app HTTP 200
- [ ] TYPE: CODE FIX for both bugs
- [ ] Run /wrapup
