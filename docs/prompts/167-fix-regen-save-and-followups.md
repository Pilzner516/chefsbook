# ChefsBook — Session 167: Fix Image Regeneration Not Saving + 166 Follow-ups
# Source: Regenerated images appear on Replicate dashboard but never saved to recipe
# Target: apps/web + apps/mobile

---

## CONTEXT

Read CLAUDE.md, DONE.md, feature-registry.md, and
.claude/agents/wrapup.md NOW before touching anything.

Two categories of work:
1. CRITICAL: Image regeneration generates on Replicate but never
   saves the new image to recipe_user_photos or updates the recipe
2. SMALL: 5 incomplete items from session 166

---

## PART 1 — CRITICAL: Fix image regeneration saving

### 1a — Diagnose the regeneration API route

Read apps/web/app/api/recipes/[id]/regenerate-image/route.ts fully.

The route must:
1. Call Replicate to generate a new image ✓ (working — Replicate shows it)
2. Download the generated image from Replicate URL
3. Apply watermark (ChefsBook badge bottom-left)
4. Upload to Supabase storage at ai-generated/{recipeId}-regen.jpg
5. Delete the old primary AI photo from recipe_user_photos
6. Insert new row in recipe_user_photos with new URL + is_ai_generated=true
7. Update recipe: image_generation_status='complete', has_ai_image=true
8. Increment regen_count on the old photo (or new photo row)

Check which of steps 2-8 are missing or broken.

### 1b — Fix the save flow

The complete working flow after Replicate returns:

```typescript
// After Replicate generation succeeds
const replicateImageUrl = prediction.output[0]

// Step 2: Download image
const imageRes = await fetch(replicateImageUrl)
const imageBuffer = Buffer.from(await imageRes.arrayBuffer())

// Step 3: Apply watermark
const watermarkedBuffer = await applyWatermarkBadge(imageBuffer)

// Step 4: Upload to Supabase storage
const storageKey = `ai-generated/${recipeId}-${Date.now()}.jpg`
const { error: uploadError } = await supabaseAdmin.storage
  .from('recipe-user-photos')
  .upload(storageKey, watermarkedBuffer, {
    contentType: 'image/jpeg',
    upsert: true
  })

if (uploadError) throw new Error(`Upload failed: ${uploadError.message}`)

const newUrl = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/recipe-user-photos/${storageKey}`

// Step 5: Remove old primary AI photo
await supabaseAdmin
  .from('recipe_user_photos')
  .update({ is_primary: false })
  .eq('recipe_id', recipeId)
  .eq('is_ai_generated', true)

// Step 6: Insert new photo
await supabaseAdmin
  .from('recipe_user_photos')
  .insert({
    recipe_id: recipeId,
    url: newUrl,
    is_primary: true,
    is_ai_generated: true,
    regen_count: 1  // mark as regenerated
  })

// Step 7: Update recipe status
await supabaseAdmin
  .from('recipes')
  .update({
    image_generation_status: 'complete',
    has_ai_image: true
  })
  .eq('id', recipeId)

return NextResponse.json({
  success: true,
  url: newUrl,
  isAiGenerated: true
})
```

### 1c — Verify the fix end-to-end

After fixing, test with a real recipe:
1. Open a recipe with an AI image + regen_count = 0
2. Click "Change image" → click "Dish looks wrong"
3. Confirm: loading spinner shows
4. Confirm: new image appears after generation
5. Confirm: recipe_user_photos has new row with new Supabase URL
6. Confirm: old AI photo is no longer primary
7. Confirm: regen_count = 1 (pills disabled in modal)

```bash
# Verify in DB
docker exec -it supabase-db psql -U postgres -d postgres -c "
SELECT url, is_primary, is_ai_generated, regen_count
FROM recipe_user_photos
WHERE recipe_id = 'YOUR_RECIPE_ID'
ORDER BY created_at DESC;"
```

---

## PART 2 — Activity feed auto-refresh (30 seconds)

In the admin overview page, the activity feed needs to auto-refresh.

Add to the activity feed component:
```typescript
useEffect(() => {
  const interval = setInterval(() => {
    fetchActivityFeed()  // re-fetch from API
  }, 30000)  // 30 seconds

  return () => clearInterval(interval)
}, [])
```

---

## PART 3 — System status row on admin overview

Add a status row at the top of the admin overview:

```tsx
<div className="system-status-row">
  <StatusIndicator label="Database" status="online" />
  <StatusIndicator label="AI API" status={anthropicStatus} />
  <StatusIndicator label="Replicate" status={replicateStatus}
    detail={`$${replicateBalance} credit`} />
  <StatusIndicator label="Storage" status="online" />
  <StatusIndicator label="Tunnel" status={tunnelStatus} />
  <span className="status-updated">Checked {lastChecked}</span>
</div>
```

For Replicate balance:
```typescript
// GET /api/admin/system-status
const replicateRes = await fetch('https://api.replicate.com/v1/account', {
  headers: { Authorization: `Bearer ${process.env.REPLICATE_API_TOKEN}` }
})
// Returns account data — extract billing info if available
// If not available from API, just show 🟢 Online / 🔴 Error
```

For Anthropic — just check if the API key works:
```typescript
// Quick ping to Anthropic to verify key is valid
const anthropicOk = !!process.env.ANTHROPIC_API_KEY
```

For Cloudflare Tunnel — check if chefsbk.app returns 200:
```typescript
const tunnelRes = await fetch('https://chefsbk.app/api/health')
const tunnelOk = tunnelRes.ok
```

StatusIndicator component:
```tsx
// 🟢 = online, 🔴 = error, 🟡 = unknown
function StatusIndicator({ label, status, detail }) {
  const dot = status === 'online' ? '🟢'
    : status === 'error' ? '🔴' : '🟡'
  return (
    <span className="status-item">
      {dot} {label} {detail && <small>{detail}</small>}
    </span>
  )
}
```

---

## PART 4 — Daily aggregation cron trigger

The SQL aggregate function exists but never gets called automatically.

Add to apps/web/app/api/cron/route.ts:

```typescript
// Run daily at 2am: aggregate yesterday's AI usage
const yesterday = new Date()
yesterday.setDate(yesterday.getDate() - 1)
const dateStr = yesterday.toISOString().split('T')[0]

await supabaseAdmin.rpc('aggregate_ai_usage_daily', {
  target_date: dateStr
})
```

Wire into the existing cron schedule check.

---

## PART 5 — Throttle check in translateRecipeToLanguage

In /api/import/url/route.ts, before calling translateRecipeToLanguage():

```typescript
if (userId && await isUserThrottled(userId)) {
  // Skip translation — return in original language
  // Don't throw — silently degrade
  console.log(`[throttle] Translation skipped for throttled user ${userId}`)
} else {
  recipe = await translateRecipeToLanguage(recipe, userLanguage, sourceLanguage)
}
```

---

## DEPLOYMENT

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

## WRAPUP REQUIREMENT

Read .claude/agents/wrapup.md before running /wrapup.
Follow the format exactly.
Every DONE.md entry must start with [SESSION 167].
Every checklist item must have ✓ or ✗ with proof or reason.

---

## COMPLETION CHECKLIST

### Part 1 — Regeneration fix (CRITICAL)
- [ ] regenerate-image route diagnosed — which steps were missing?
- [ ] Image downloaded from Replicate URL after generation
- [ ] Watermark applied to regenerated image
- [ ] New image uploaded to Supabase storage (not Replicate URL)
- [ ] Old primary AI photo set to is_primary=false
- [ ] New photo row inserted in recipe_user_photos
- [ ] Recipe image_generation_status updated to 'complete'
- [ ] regen_count = 1 on new photo
- [ ] End-to-end test: regen pill → new image appears in UI
- [ ] DB verified: new Supabase URL in recipe_user_photos

### Part 2 — Activity feed auto-refresh
- [ ] 30-second interval added to activity feed
- [ ] Verified: feed updates without page reload

### Part 3 — System status row
- [ ] Status row added to admin overview
- [ ] Replicate balance shown
- [ ] Tunnel status checked
- [ ] GET /api/admin/system-status created

### Part 4 — Daily aggregation cron
- [ ] aggregate_ai_usage_daily called in cron route
- [ ] Runs for yesterday's date

### Part 5 — Throttle in translate
- [ ] isUserThrottled() checked before translateRecipeToLanguage()
- [ ] Throttled users get recipe in original language (silent degrade)

### General
- [ ] tsc --noEmit passes
- [ ] Deployed to RPi5
- [ ] Run /wrapup per .claude/agents/wrapup.md
- [ ] Every DONE.md entry starts with [SESSION 167]
- [ ] Full checklist audit with ✓/✗ for every item
