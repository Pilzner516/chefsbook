# ChefsBook — Session 155: Fix AI Image Watermark
# Source: Watermark missing from AI-generated images + design update
# Target: packages/ai + scripts + apps/web/public/images

---

## CONTEXT

Read CLAUDE.md and DONE.md before starting.

Two issues:
1. The CBHat.png watermark is NOT appearing on AI-generated images
   — sharp or the hat PNG path failed silently during generation
2. The watermark design needs to change from just the hat icon
   to a "ChefsBook [hat]" branded badge

No new images need to be generated (that costs money).
This session only adds watermarks to existing AI images.

---

## PART 1 — Diagnose why watermark is missing

### 1a — Check sharp is installed on RPi5

```bash
ssh rasp@rpi5-eth
cd /mnt/chefsbook/repo
node -e "
import('sharp').then(s => console.log('sharp ok:', s.default.versions))
  .catch(e => console.log('sharp missing:', e.message))
" --input-type=module
```

If missing: `cd apps/web && npm install sharp --save`

### 1b — Find CBHat.png

```bash
find /mnt/chefsbook/repo -name "CBHat.png" 2>/dev/null
find /mnt/chefsbook/repo -name "*hat*" -o -name "*Hat*" 2>/dev/null | grep -i png
```

Note the exact path found — use it in the watermark script.

### 1c — Check the generate script for silent failures

Read scripts/generate-recipe-images.mjs.
Find the addWatermarks() function.
Check if it has a try/catch that silently swallows errors.
If so — add explicit logging so failures are visible.

---

## PART 2 — New watermark design

### Design spec

The watermark should be a branded pill/badge:

```
┌──────────────────────────┐
│  Chefs book  [hat icon]  │
└──────────────────────────┘
```

- "Chefs" in #ce2b37 (pomodoro red)
- "book" in #1a1a1a (near black)
- Followed by the chef's hat icon (CBHat.png or equivalent)
- Background: white pill with slight transparency rgba(255,255,255,0.88)
- Rounded corners: border-radius equivalent ~16px
- Subtle drop shadow: 0 2px 8px rgba(0,0,0,0.15)
- Total size: approximately 140×32px
- Position: bottom-right corner, 12px padding from edges
- Font: Inter or system sans-serif, ~13px, font-weight 600

### Implementation approach

Since sharp doesn't natively render HTML/CSS, create the watermark
badge as a pre-rendered PNG file and composite it onto images.

Create scripts/create-watermark-badge.mjs:

```javascript
#!/usr/bin/env node
/**
 * Creates the ChefsBook watermark badge PNG
 * Run once to generate the badge, then composite onto images
 */
import sharp from 'sharp'

const WIDTH = 160
const HEIGHT = 36
const PADDING = 10

// Create SVG watermark badge
const svg = `
<svg width="${WIDTH}" height="${HEIGHT}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <filter id="shadow">
      <feDropShadow dx="0" dy="2" stdDeviation="3" flood-opacity="0.15"/>
    </filter>
  </defs>

  <!-- White pill background -->
  <rect x="0" y="0" width="${WIDTH}" height="${HEIGHT}"
    rx="18" ry="18"
    fill="rgba(255,255,255,0.88)"
    filter="url(#shadow)"
  />

  <!-- "Chefs" in red -->
  <text
    x="${PADDING}" y="${HEIGHT/2 + 5}"
    font-family="Inter, Arial, sans-serif"
    font-size="13"
    font-weight="700"
    fill="#ce2b37"
  >Chefs</text>

  <!-- "book" in near-black -->
  <text
    x="${PADDING + 38}" y="${HEIGHT/2 + 5}"
    font-family="Inter, Arial, sans-serif"
    font-size="13"
    font-weight="700"
    fill="#1a1a1a"
  >book</text>

  <!-- Chef hat icon (simple SVG path) -->
  <g transform="translate(${WIDTH - 28}, ${HEIGHT/2 - 8}) scale(0.7)">
    <!-- Simple chef hat shape -->
    <rect x="2" y="14" width="20" height="6" rx="1" fill="#ce2b37"/>
    <ellipse cx="12" cy="12" rx="10" ry="8" fill="white" stroke="#ce2b37" stroke-width="1.5"/>
    <ellipse cx="6" cy="14" rx="5" ry="5" fill="white" stroke="#ce2b37" stroke-width="1"/>
    <ellipse cx="18" cy="14" rx="5" ry="5" fill="white" stroke="#ce2b37" stroke-width="1"/>
    <rect x="4" y="8" width="16" height="8" fill="white"/>
  </g>
</svg>`

const svgBuffer = Buffer.from(svg)

await sharp(svgBuffer)
  .resize(WIDTH, HEIGHT)
  .png({ compressionLevel: 9 })
  .toFile('apps/web/public/images/watermark-chefsbook.png')

console.log('Watermark badge created: apps/web/public/images/watermark-chefsbook.png')
```

Run this script first to generate the badge PNG:
```bash
node scripts/create-watermark-badge.mjs
```

Verify the badge looks correct before applying to images.

---

## PART 3 — Apply watermarks to all AI images

Create scripts/apply-watermarks.mjs:

```javascript
#!/usr/bin/env node
/**
 * Apply ChefsBook watermark to all AI-generated recipe images.
 * Downloads from Supabase storage, composites watermark, re-uploads.
 * Does NOT regenerate images (no Replicate cost).
 *
 * Usage: node scripts/apply-watermarks.mjs
 * Environment: SUPABASE_SERVICE_ROLE_KEY
 */
import { createClient } from '@supabase/supabase-js'
import sharp from 'sharp'
import { existsSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))

const SUPABASE_URL = process.env.SUPABASE_URL
  || process.env.NEXT_PUBLIC_SUPABASE_URL
  || 'http://100.110.47.62:8000'
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!SERVICE_KEY) { console.error('SUPABASE_SERVICE_ROLE_KEY required'); process.exit(1) }

const supabase = createClient(SUPABASE_URL, SERVICE_KEY)

const WATERMARK_PATH = join(__dirname, '../apps/web/public/images/watermark-chefsbook.png')
const DELAY_MS = 1000  // 1 second between images

async function sleep(ms) {
  return new Promise(r => setTimeout(r, ms))
}

function embedLsbWatermark(buffer, recipeId) {
  try {
    const payload = `chefsbk.app|${recipeId}|${Date.now()}`
    const bits = payload.split('').flatMap(c => {
      const code = c.charCodeAt(0)
      return Array.from({length: 8}, (_, i) => (code >> (7 - i)) & 1)
    })
    const result = Buffer.from(buffer)
    for (let i = 0; i < bits.length && i + 20 < result.length; i++) {
      result[i + 20] = (result[i + 20] & 0xFE) | bits[i]
    }
    return result
  } catch {
    return buffer
  }
}

async function applyWatermark(imageBuffer, recipeId) {
  if (!existsSync(WATERMARK_PATH)) {
    throw new Error(`Watermark badge not found at ${WATERMARK_PATH}. Run create-watermark-badge.mjs first.`)
  }

  // Get image dimensions
  const metadata = await sharp(imageBuffer).metadata()
  const { width, height } = metadata

  // Resize watermark to fit nicely (max 160px wide, 36px tall)
  const watermarkBuffer = await sharp(WATERMARK_PATH)
    .resize(160, 36, { fit: 'inside' })
    .png()
    .toBuffer()

  // Position: bottom-right with 12px padding
  const watermarkMeta = await sharp(watermarkBuffer).metadata()
  const left = width - watermarkMeta.width - 12
  const top = height - watermarkMeta.height - 12

  // Apply visible watermark
  let result = await sharp(imageBuffer)
    .composite([{
      input: watermarkBuffer,
      left,
      top,
      blend: 'over'
    }])
    .jpeg({ quality: 88 })
    .toBuffer()

  // Apply invisible LSB watermark
  result = embedLsbWatermark(result, recipeId)

  return result
}

async function main() {
  console.log('ChefsBook Watermark Applicator')
  console.log('================================')

  if (!existsSync(WATERMARK_PATH)) {
    console.error(`ERROR: Watermark badge missing at ${WATERMARK_PATH}`)
    console.error('Run: node scripts/create-watermark-badge.mjs first')
    process.exit(1)
  }

  // Get all AI-generated images
  const { data: photos, error } = await supabase
    .from('recipe_user_photos')
    .select('id, recipe_id, url')
    .eq('is_ai_generated', true)

  if (error) {
    console.error('Failed to fetch photos:', error.message)
    process.exit(1)
  }

  console.log(`Found ${photos.length} AI-generated images to watermark`)
  console.log('')

  let succeeded = 0
  let failed = 0

  for (const photo of photos) {
    console.log(`[${succeeded + failed + 1}/${photos.length}] Recipe ${photo.recipe_id}`)

    try {
      // Extract storage path from URL
      const urlPath = photo.url.split('/storage/v1/object/public/recipe-user-photos/')[1]
      if (!urlPath) {
        console.log(`  ⚠ Could not parse storage path from URL: ${photo.url}`)
        failed++
        continue
      }

      // Download image from Supabase storage
      const { data: fileData, error: downloadError } = await supabase.storage
        .from('recipe-user-photos')
        .download(urlPath)

      if (downloadError || !fileData) {
        console.log(`  ✗ Download failed: ${downloadError?.message}`)
        failed++
        continue
      }

      const imageBuffer = Buffer.from(await fileData.arrayBuffer())

      // Apply watermarks
      const watermarkedBuffer = await applyWatermark(imageBuffer, photo.recipe_id)

      // Re-upload (overwrite)
      const { error: uploadError } = await supabase.storage
        .from('recipe-user-photos')
        .upload(urlPath, watermarkedBuffer, {
          contentType: 'image/jpeg',
          upsert: true
        })

      if (uploadError) {
        console.log(`  ✗ Upload failed: ${uploadError.message}`)
        failed++
        continue
      }

      console.log(`  ✓ Watermarked: ${urlPath}`)
      succeeded++

    } catch (err) {
      console.error(`  ✗ Error: ${err.message}`)
      failed++
    }

    if (succeeded + failed < photos.length) {
      await sleep(DELAY_MS)
    }
  }

  console.log('')
  console.log('================================')
  console.log(`Done: ${succeeded + failed} processed`)
  console.log(`✓ Watermarked: ${succeeded}`)
  console.log(`✗ Failed: ${failed}`)
}

main().catch(console.error)
```

---

## STEP 4 — Run on RPi5

```bash
ssh rasp@rpi5-eth
cd /mnt/chefsbook/repo
git pull

export SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiAiSFMyNTYiLCAidHlwIjogIkpXVCJ9.eyJyb2xlIjogInNlcnZpY2Vfcm9sZSIsICJpc3MiOiAic3VwYWJhc2UiLCAiaWF0IjogMTc1MTAwMDAwMCwgImV4cCI6IDE5MDg3NjY0MDB9.d0A4kE4okczvSWbLw9WxzVr9sr2AMdzh09Lnu7T1eXQ

# Step 1: Create the watermark badge
node scripts/create-watermark-badge.mjs

# Step 2: Verify badge was created
ls -la apps/web/public/images/watermark-chefsbook.png

# Step 3: Apply to all AI images
node scripts/apply-watermarks.mjs
```

---

## STEP 5 — Verify in the app

After the script completes:
1. Open chefsbk.app and navigate to the Chocolate Chip Cookies recipe
2. Confirm: "ChefsBook [hat]" badge visible bottom-right of image
3. Confirm: "Chefs" is red (#ce2b37), "book" is near-black (#1a1a1a)
4. Confirm: badge has white pill background
5. Confirm: badge is NOT on user-uploaded images (only AI-generated)

Also update generate-recipe-images.mjs to use the new watermark
badge going forward instead of the old CBHat.png approach.

---

## COMPLETION CHECKLIST

- [ ] sharp confirmed installed on RPi5
- [ ] CBHat.png location found
- [ ] scripts/create-watermark-badge.mjs created
- [ ] Watermark badge PNG generated at apps/web/public/images/watermark-chefsbook.png
- [ ] Badge design: "Chefs" red + "book" black + hat icon + white pill
- [ ] scripts/apply-watermarks.mjs created
- [ ] All AI images watermarked (both visible + invisible LSB)
- [ ] Watermark visible bottom-right on Chocolate Chip Cookies recipe
- [ ] Watermark NOT on user-uploaded images
- [ ] generate-recipe-images.mjs updated to use new badge going forward
- [ ] Both scripts committed to repo
- [ ] Deployed to RPi5
- [ ] Run /wrapup
- [ ] At the end: confirm how many images were watermarked and
      describe exactly what the watermark looks like.
