# ChefsBook — Session 161: Regeneration Pills → Change Image Popup
# Source: Regeneration pills should be in the Change Image hover popup, not below image
# Target: apps/web + apps/mobile

---

## CONTEXT

Read CLAUDE.md and DONE.md before starting.

Currently the 6 regeneration pills ("Dish looks wrong", "Change the
scene", etc.) sit permanently below every AI-generated image.
This is visually noisy and takes up permanent space.

The correct UX: pills appear inside the "Change image" popup that
shows when hovering the image. The pills disappear from below the
image entirely.

---

## PART 1 — Web: New "Change Image" popup

### Current behaviour:
- Hover image → "Change image" button appears
- Click → opens image upload gallery
- Regeneration pills sit permanently below image (wrong)

### New behaviour:
- Hover image → "Change image" button appears
- Click → opens a choice modal:

```
┌─────────────────────────────────────┐
│  Change Recipe Image                │
│                                     │
│  📸 Upload your own photo           │
│     Use your own food photo         │
│                                     │
│  ─────────────────────────────────  │
│                                     │
│  🎨 Regenerate with AI              │
│     Get a new AI-generated image    │
│                                     │
│  Why doesn't it look right?         │
│  [Dish looks wrong] [Change scene]  │
│  [Make it brighter] [Make it moodier│
│  [Zoom in closer]   [Overhead view] │
│                                     │
│  1 regeneration remaining           │
│                                     │
│  [Cancel]                           │
└─────────────────────────────────────┘
```

### Behaviour:
- "Upload your own photo" → opens existing file upload flow
  (same as before, includes copyright confirmation dialog)
- Clicking a regeneration pill → immediately triggers regeneration:
  - Modal closes
  - Image area shows loading state:
    ```
    [Spinning animation / pulsing chef hat placeholder]
    Regenerating your image...
    This takes about 10-15 seconds
    ```
  - When complete: new image fades in smoothly
  - Success toast: "New image generated ✓"
- If regeneration limit reached (regen_count ≥ 1):
  - Pills are shown but disabled (greyed out)
  - Below pills: "You've used your regeneration for this recipe"
  - Only "Upload your own photo" remains active

### If NOT an AI-generated image (is_ai_generated = false):
- "Change image" popup only shows:
  - 📸 Upload your own photo
  - 🎨 Generate an AI image (first time generation, not regen)
- No pills shown (pills are only for regenerating existing AI images)

### Remove pills from below image
Remove the "Not quite right?" section and pill row that currently
sits below the image. All of this moves into the popup.

---

## PART 2 — Regeneration loading state

When regeneration is triggered, the image area must show a clear
loading state. The user should never see a broken/blank image.

```tsx
// Image area during regeneration
{isRegenerating ? (
  <div className="recipe-image-regenerating">
    <div className="regen-placeholder">
      <img src="/images/chefs-hat.png" className="regen-hat pulse" />
      <p className="regen-text">Regenerating your image...</p>
      <p className="regen-subtext">This takes about 10–15 seconds</p>
    </div>
  </div>
) : (
  <img src={primaryPhoto.url} ... />
)}
```

Style .recipe-image-regenerating:
- Same dimensions as the image container
- Cream background (var(--bg))
- Centered chef hat with gentle pulse animation
- Text below hat: "Regenerating your image..."
- Subtext: "This takes about 10–15 seconds"

After regeneration completes:
- New image fades in (opacity 0 → 1, 0.4s transition)
- Success toast: "New image ready ✓"

### Polling for completion

Since image generation is async, the client needs to poll for
completion:

```typescript
// After triggering regeneration via API
const pollForNewImage = async (recipeId: string) => {
  const maxAttempts = 20  // 20 × 1.5s = 30 seconds max
  let attempts = 0

  const poll = setInterval(async () => {
    attempts++
    if (attempts > maxAttempts) {
      clearInterval(poll)
      showError('Image generation is taking longer than expected. Please try again.')
      return
    }

    const res = await fetch(`/api/recipes/${recipeId}/image-status`)
    const { status, url } = await res.json()

    if (status === 'complete' && url) {
      clearInterval(poll)
      setIsRegenerating(false)
      setPrimaryPhotoUrl(url)
      showToast('New image ready ✓')
    } else if (status === 'failed') {
      clearInterval(poll)
      setIsRegenerating(false)
      showError('Image generation failed. Please try again.')
    }
    // status === 'generating': keep polling
  }, 1500)
}
```

Create GET /api/recipes/[id]/image-status:
```typescript
// Returns current image_generation_status and primary photo URL
export async function GET(req, { params }) {
  const { data } = await supabaseAdmin
    .from('recipes')
    .select('image_generation_status, recipe_user_photos(url, is_primary, is_ai_generated)')
    .eq('id', params.id)
    .single()

  const primaryPhoto = data.recipe_user_photos?.find(p => p.is_primary)

  return NextResponse.json({
    status: data.image_generation_status ?? 'none',
    url: primaryPhoto?.url ?? null,
    isAiGenerated: primaryPhoto?.is_ai_generated ?? false
  })
}
```

---

## PART 3 — Mobile: Same popup pattern

On mobile recipe detail, the image currently has a tap handler.

New behaviour:
- Tap image → bottom sheet opens with same options:
  - 📸 Upload your own photo
  - 🎨 Regenerate with AI + pills (if AI image + regen available)
- Tap a pill → bottom sheet closes, loading state shown
- Poll for completion, swap image when ready

Use ChefsDialog or a bottom sheet modal pattern.

---

## PART 4 — Verify regeneration actually works

The agent noted regeneration may not be working. Test end-to-end:

1. Find a recipe with an AI-generated image and regen_count = 0
2. Open "Change image" popup
3. Click "Dish looks wrong" pill
4. Confirm: loading state appears
5. Confirm: POST /api/recipes/[id]/regenerate-image is called
6. Confirm: new image appears after ~10-15 seconds
7. Confirm: regen_count is now 1
8. Confirm: pills are now disabled

If regeneration is broken, diagnose and fix the API route.

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

## COMPLETION CHECKLIST

### Web popup
- [ ] "Change image" click opens choice modal (not direct upload)
- [ ] Modal has: Upload photo / Regenerate with AI sections
- [ ] AI section shows 6 pills (if is_ai_generated + regen available)
- [ ] Clicking pill triggers regeneration and closes modal
- [ ] If regen_count ≥ 1: pills disabled with "used" message
- [ ] If not AI image: modal shows Upload + Generate (no pills)
- [ ] Permanent pill row below image REMOVED

### Loading state
- [ ] Regenerating state shows chef hat + "Regenerating..." text
- [ ] Polling every 1.5 seconds for up to 30 seconds
- [ ] New image fades in smoothly on completion
- [ ] Success toast shown
- [ ] Error shown if generation fails or times out
- [ ] GET /api/recipes/[id]/image-status created

### Mobile
- [ ] Tap image → bottom sheet with same options
- [ ] Pills shown for AI images with regen available
- [ ] Loading state shown during regeneration
- [ ] New image swaps in when ready

### Verification
- [ ] End-to-end regeneration tested and confirmed working
- [ ] regen_count increments correctly
- [ ] Pills disabled after use

### General
- [ ] feature-registry.md updated
- [ ] tsc --noEmit passes both apps
- [ ] Deployed to RPi5
- [ ] Run /wrapup
- [ ] At the end: confirm regeneration works end-to-end,
      describe the complete user flow, what was left incomplete.
