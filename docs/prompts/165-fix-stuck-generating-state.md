# ChefsBook — Session 165: Fix Stuck "Generating Recipe Image" State
# Source: Image generation placeholder never clears when Replicate fails
# Target: apps/web + apps/mobile

---

## CONTEXT

Read CLAUDE.md and DONE.md before starting.

When image generation fails (e.g. Replicate credits exhausted, API error),
the recipe detail page shows "Generating recipe image..." indefinitely.
The polling loop runs forever because image_generation_status stays
"pending" or "generating" and never changes to "complete" or "failed".

---

## PART 1 — Add timeout to polling

In the recipe detail page polling logic:

```typescript
const MAX_POLL_ATTEMPTS = 20   // 20 × 1.5s = 30 seconds max
const POLL_INTERVAL_MS = 1500

let pollAttempts = 0

const pollTimer = setInterval(async () => {
  pollAttempts++

  // Timeout after 30 seconds
  if (pollAttempts > MAX_POLL_ATTEMPTS) {
    clearInterval(pollTimer)
    setIsGenerating(false)
    setGenerationFailed(true)  // new state
    return
  }

  const res = await fetch(`/api/recipes/${recipeId}/image-status`)
  const { status, url } = await res.json()

  if (status === 'complete' && url) {
    clearInterval(pollTimer)
    setIsGenerating(false)
    setPrimaryPhotoUrl(url)
  } else if (status === 'failed') {
    clearInterval(pollTimer)
    setIsGenerating(false)
    setGenerationFailed(true)
  }
}, POLL_INTERVAL_MS)
```

### When generation fails or times out, show:

```tsx
{generationFailed ? (
  <div className="recipe-image-failed">
    <img src="/images/chefs-hat.png" className="failed-hat" />
    <p>Image generation is temporarily unavailable.</p>
    <button onClick={() => triggerGeneration()}>Try again</button>
  </div>
) : isGenerating ? (
  <div className="recipe-image-generating">
    <img src="/images/chefs-hat.png" className="generating-hat pulse" />
    <p>Generating recipe image...</p>
    <p className="subtext">This takes about 10–15 seconds</p>
  </div>
) : (
  <img src={primaryPhotoUrl} ... />
)}
```

---

## PART 2 — Fix stuck recipes in DB

Recipes where image_generation_status = 'pending' or 'generating'
but no image was ever created are stuck. Reset them:

```sql
-- Reset stuck generation status
UPDATE recipes
SET image_generation_status = 'failed'
WHERE image_generation_status IN ('pending', 'generating')
AND id NOT IN (
  SELECT recipe_id FROM recipe_user_photos
  WHERE is_ai_generated = true AND is_primary = true
);
```

Run on RPi5:
```bash
docker exec -it supabase-db psql -U postgres -d postgres -c "
UPDATE recipes
SET image_generation_status = 'failed'
WHERE image_generation_status IN ('pending', 'generating')
AND id NOT IN (
  SELECT recipe_id FROM recipe_user_photos
  WHERE is_ai_generated = true AND is_primary = true
);
"
```

Show count of recipes updated.

---

## PART 3 — Handle failed status in image-status API

Update GET /api/recipes/[id]/image-status to also check if
the recipe has no primary AI photo but status is pending/generating
(stuck state) and return 'failed' in that case:

```typescript
// If status is pending/generating but no AI photo exists after 60s,
// it's stuck — return failed
const isStuck = ['pending', 'generating'].includes(data.image_generation_status)
  && !primaryAiPhoto
  && minutesSince(data.image_generation_started_at) > 1

return NextResponse.json({
  status: isStuck ? 'failed' : (data.image_generation_status ?? 'none'),
  url: primaryPhoto?.url ?? null,
  isAiGenerated: primaryPhoto?.is_ai_generated ?? false
})
```

---

## PART 4 — Mobile: same timeout fix

In the mobile recipe detail, if there's a generating state,
add the same 30-second timeout before showing the failed state.

---

## DEPLOYMENT

```bash
ssh rasp@rpi5-eth

# Reset stuck recipes in DB first
docker exec -it supabase-db psql -U postgres -d postgres -c "
UPDATE recipes SET image_generation_status = 'failed'
WHERE image_generation_status IN ('pending', 'generating')
AND id NOT IN (
  SELECT recipe_id FROM recipe_user_photos
  WHERE is_ai_generated = true AND is_primary = true
);"

cd /mnt/chefsbook/repo
git pull
cd apps/web
rm -rf node_modules/react node_modules/react-dom .next
NODE_OPTIONS=--max-old-space-size=1536 npm run build 2>&1 | tail -20
pm2 restart chefsbook-web
```

---

## COMPLETION CHECKLIST

- [ ] Polling timeout: stops after 30 seconds
- [ ] Failed state shows friendly message + "Try again" button
- [ ] Stuck recipes in DB reset to 'failed' status
- [ ] image-status API returns 'failed' for stuck recipes
- [ ] Thai Chicken Satay and other stuck recipes no longer show
      "Generating recipe image..." forever
- [ ] Mobile: same timeout fix applied
- [ ] tsc --noEmit passes both apps
- [ ] Deployed to RPi5
- [ ] Run /wrapup
- [ ] At the end: how many stuck recipes were reset,
      confirm the spinning state is gone on affected recipes.
