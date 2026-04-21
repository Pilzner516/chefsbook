# ChefsBook — Session 149: Generate AI Images for Crawl Recipes
# Source: Session 147 built the pipeline, now run it for existing recipes
# Target: packages/ai + scripts + database

---

## CONTEXT

Read CLAUDE.md and DONE.md before starting.

Session 147 built the full AI image generation pipeline but images
were never generated because REPLICATE_API_TOKEN wasn't set.
The token is now in apps/web/.env.local on RPi5.

This session:
1. Fixes the 1 failed step rewrite (Small-Batch Cheesy Focaccia)
2. Generates AI images for all recipes missing photos
3. Verifies images appear correctly in the app

---

## STEP 1 — Fix failed step rewrite

One recipe failed with a JSON parse error:
"Small-Batch Cheesy Focaccia: Expected ',' or ']' after array element"

Find this recipe in the DB and manually trigger a rewrite:

```bash
ssh rasp@rpi5-eth
cd /mnt/chefsbook/repo
export SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiAiSFMyNTYiLCAidHlwIjogIkpXVCJ9.eyJyb2xlIjogInNlcnZpY2Vfcm9sZSIsICJpc3MiOiAic3VwYWJhc2UiLCAiaWF0IjogMTc1MTAwMDAwMCwgImV4cCI6IDE5MDg3NjY0MDB9.d0A4kE4okczvSWbLw9WxzVr9sr2AMdzh09Lnu7T1eXQ
export ANTHROPIC_API_KEY=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
export REPLICATE_API_TOKEN=r8_ZE9sar6UuIxFjL7aEBrTrUJkaoe8Mt80sd6Og
```

The issue is Haiku returned JSON with a special character or apostrophe
that broke the parser. Fix the script to handle this:
- Wrap JSON.parse in try/catch with a cleanup step that strips
  control characters and fixes common JSON issues before parsing
- Re-run just for that recipe

---

## STEP 2 — Create image generation script

Create scripts/generate-recipe-images.mjs:

```javascript
#!/usr/bin/env node
/**
 * Generate AI images for recipes that don't have photos.
 * Uses Replicate Flux Dev + visible CBHat watermark + invisible steganographic watermark.
 * Processes recipes tagged "ChefsBook" first, then any recipe without an image.
 *
 * Usage: node scripts/generate-recipe-images.mjs
 * Environment: SUPABASE_SERVICE_ROLE_KEY, REPLICATE_API_TOKEN
 */

import { createClient } from '@supabase/supabase-js'
import { writeFileSync, readFileSync, existsSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))

const SUPABASE_URL = process.env.SUPABASE_URL
  || process.env.NEXT_PUBLIC_SUPABASE_URL
  || 'http://100.110.47.62:8000'
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const REPLICATE_TOKEN = process.env.REPLICATE_API_TOKEN
const STORAGE_URL = `${SUPABASE_URL}/storage/v1/object/public/recipe-user-photos`

if (!SERVICE_KEY) { console.error('SUPABASE_SERVICE_ROLE_KEY required'); process.exit(1) }
if (!REPLICATE_TOKEN) { console.error('REPLICATE_API_TOKEN required'); process.exit(1) }

const supabase = createClient(SUPABASE_URL, SERVICE_KEY)

// Rate limit: 1 per 12 seconds (Replicate free tier ~5/min)
const DELAY_MS = 12000

async function sleep(ms) {
  return new Promise(r => setTimeout(r, ms))
}

async function generateImage(recipe) {
  const keyIngredients = (recipe.ingredients ?? [])
    .slice(0, 4)
    .map(i => i.name || i)
    .filter(Boolean)
    .join(', ')

  const cuisine = recipe.cuisine_type || recipe.tags?.find(t =>
    ['Italian', 'French', 'Spanish', 'Japanese', 'Indian', 'Mexican',
     'Thai', 'Chinese', 'Greek', 'Mediterranean'].includes(t)
  ) || ''

  const prompt = `Professional food photography of ${recipe.title}${cuisine ? ', ' + cuisine + ' cuisine' : ''}, ${keyIngredients ? 'featuring ' + keyIngredients + ', ' : ''}editorial style, natural window light, shallow depth of field, styled on a beautiful plate or bowl, warm tones, appetizing presentation, high resolution, no text, no watermarks, no people, photorealistic`

  console.log(`  Generating: "${recipe.title}"`)
  console.log(`  Prompt: ${prompt.substring(0, 80)}...`)

  const response = await fetch(
    'https://api.replicate.com/v1/models/black-forest-labs/flux-dev/predictions',
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${REPLICATE_TOKEN}`,
        'Content-Type': 'application/json',
        'Prefer': 'wait'
      },
      body: JSON.stringify({
        input: {
          prompt,
          aspect_ratio: '4:3',
          num_outputs: 1,
          output_format: 'jpeg',
          output_quality: 85,
          safety_tolerance: 5
        }
      })
    }
  )

  if (!response.ok) {
    const err = await response.text()
    throw new Error(`Replicate ${response.status}: ${err.substring(0, 200)}`)
  }

  const data = await response.json()
  if (!data.output?.[0]) {
    throw new Error('No output from Replicate')
  }

  return data.output[0]  // image URL
}

async function downloadImage(url) {
  const response = await fetch(url)
  if (!response.ok) throw new Error(`Download failed: ${response.status}`)
  const buffer = await response.arrayBuffer()
  return Buffer.from(buffer)
}

async function addWatermarks(imageBuffer, recipeId) {
  // Try to use sharp for visible watermark
  try {
    const sharp = (await import('sharp')).default

    // Check if CBHat.png exists
    const hatPaths = [
      join(__dirname, '../apps/web/public/images/CBHat.png'),
      join(__dirname, '../apps/mobile/assets/images/CBHat.png'),
      join(__dirname, '../apps/web/public/CBHat.png'),
    ]

    let hatPath = hatPaths.find(p => existsSync(p))

    if (hatPath) {
      const watermark = await sharp(hatPath)
        .resize(60, 60)
        .png()
        .toBuffer()

      // Get image dimensions for LSB watermark
      const metadata = await sharp(imageBuffer).metadata()

      // Add visible watermark
      imageBuffer = await sharp(imageBuffer)
        .composite([{
          input: watermark,
          gravity: 'southeast',
          blend: 'over'
        }])
        .jpeg({ quality: 85 })
        .toBuffer()

      console.log('  ✓ Visible watermark added')
    } else {
      console.log('  ⚠ CBHat.png not found — skipping visible watermark')
      imageBuffer = await sharp(imageBuffer).jpeg({ quality: 85 }).toBuffer()
    }

    // Add invisible LSB steganographic watermark
    // Encode "chefsbk.app|recipeId|timestamp" into blue channel LSBs
    const payload = `chefsbk.app|${recipeId}|${Date.now()}`
    imageBuffer = embedLsbWatermark(imageBuffer, payload)
    console.log('  ✓ Invisible watermark embedded')

  } catch (err) {
    console.log(`  ⚠ Watermark skipped (sharp not available): ${err.message}`)
  }

  return imageBuffer
}

function embedLsbWatermark(buffer, payload) {
  // Simple LSB steganography in the raw JPEG bytes
  // Encodes payload as ASCII bits in the least significant bits
  // Note: This is a simplified implementation — production should use
  // a proper steganography library
  try {
    const bits = payload.split('').flatMap(c => {
      const code = c.charCodeAt(0)
      return Array.from({length: 8}, (_, i) => (code >> (7 - i)) & 1)
    })

    const result = Buffer.from(buffer)
    // Start encoding after JPEG header (first 20 bytes)
    for (let i = 0; i < bits.length && i + 20 < result.length; i++) {
      result[i + 20] = (result[i + 20] & 0xFE) | bits[i]
    }
    return result
  } catch {
    return buffer  // Return original if encoding fails
  }
}

async function uploadToSupabase(imageBuffer, recipeId) {
  const fileName = `ai-generated/${recipeId}.jpg`

  const { error } = await supabase.storage
    .from('recipe-user-photos')
    .upload(fileName, imageBuffer, {
      contentType: 'image/jpeg',
      upsert: true
    })

  if (error) throw new Error(`Upload failed: ${error.message}`)

  return `${STORAGE_URL}/ai-generated/${recipeId}.jpg`
}

async function savePhotoRecord(recipeId, imageUrl) {
  // Remove any existing primary photo first
  await supabase
    .from('recipe_user_photos')
    .update({ is_primary: false })
    .eq('recipe_id', recipeId)

  // Insert new AI-generated photo
  const { error } = await supabase
    .from('recipe_user_photos')
    .insert({
      recipe_id: recipeId,
      url: imageUrl,
      is_primary: true,
      is_ai_generated: true
    })

  if (error) throw new Error(`DB insert failed: ${error.message}`)

  // Update recipe status
  await supabase
    .from('recipes')
    .update({
      has_ai_image: true,
      image_generation_status: 'complete'
    })
    .eq('id', recipeId)
}

async function main() {
  console.log('ChefsBook AI Image Generator')
  console.log('============================')

  // Find recipes without images
  // Priority 1: tagged "ChefsBook" (crawl recipes)
  // Priority 2: any recipe without a primary photo
  const { data: recipes, error } = await supabase
    .from('recipes')
    .select(`
      id, title, tags, ingredients, cuisine_type,
      image_generation_status,
      recipe_user_photos!left(id, is_primary, is_ai_generated)
    `)
    .is('image_generation_status', null)
    .order('created_at', { ascending: false })

  if (error) {
    console.error('Failed to fetch recipes:', error.message)
    process.exit(1)
  }

  // Filter to recipes with no primary photo
  const needsImage = recipes.filter(r => {
    const hasPrimary = r.recipe_user_photos?.some(p => p.is_primary)
    return !hasPrimary
  })

  // Sort: ChefsBook tagged first
  needsImage.sort((a, b) => {
    const aIsChefs = a.tags?.includes('ChefsBook') ? 0 : 1
    const bIsChefs = b.tags?.includes('ChefsBook') ? 0 : 1
    return aIsChefs - bIsChefs
  })

  console.log(`Found ${needsImage.length} recipes needing images`)
  console.log(`ChefsBook crawl recipes: ${needsImage.filter(r => r.tags?.includes('ChefsBook')).length}`)
  console.log(`Estimated cost: $${(needsImage.length * 0.025).toFixed(2)}`)
  console.log('')

  let succeeded = 0
  let failed = 0

  for (const recipe of needsImage) {
    console.log(`\n[${succeeded + failed + 1}/${needsImage.length}] ${recipe.title}`)

    try {
      // Generate image
      const imageUrl = await generateImage(recipe)

      // Download
      const imageBuffer = await downloadImage(imageUrl)

      // Add watermarks
      const watermarkedBuffer = await addWatermarks(imageBuffer, recipe.id)

      // Upload to Supabase
      const storedUrl = await uploadToSupabase(watermarkedBuffer, recipe.id)

      // Save record
      await savePhotoRecord(recipe.id, storedUrl)

      console.log(`  ✓ Done: ${storedUrl}`)
      succeeded++

    } catch (err) {
      console.error(`  ✗ Failed: ${err.message}`)

      // Mark as failed in DB
      await supabase.from('recipes').update({
        image_generation_status: 'failed'
      }).eq('id', recipe.id)

      failed++
    }

    // Rate limit
    if (succeeded + failed < needsImage.length) {
      console.log(`  Waiting ${DELAY_MS/1000}s...`)
      await sleep(DELAY_MS)
    }
  }

  console.log('\n============================')
  console.log(`Done: ${succeeded + failed} processed`)
  console.log(`✓ Generated: ${succeeded}`)
  console.log(`✗ Failed: ${failed}`)
  console.log(`Estimated cost: ~$${(succeeded * 0.025).toFixed(2)}`)
}

main().catch(console.error)
```

### Save the script:
Save to scripts/generate-recipe-images.mjs in the monorepo.
Commit and push so it's available on RPi5.

---

## STEP 3 — Run the script on RPi5

```bash
ssh rasp@rpi5-eth
cd /mnt/chefsbook/repo
git pull
export SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiAiSFMyNTYiLCAidHlwIjogIkpXVCJ9.eyJyb2xlIjogInNlcnZpY2Vfcm9sZSIsICJpc3MiOiAic3VwYWJhc2UiLCAiaWF0IjogMTc1MTAwMDAwMCwgImV4cCI6IDE5MDg3NjY0MDB9.d0A4kE4okczvSWbLw9WxzVr9sr2AMdzh09Lnu7T1eXQ
export REPLICATE_API_TOKEN=r8_ZE9sar6UuIxFjL7aEBrTrUJkaoe8Mt80sd6Og
node scripts/generate-recipe-images.mjs
```

This will run for ~10 minutes for 32 recipes (12 seconds per image).
Leave the terminal open while it runs.

---

## STEP 4 — Verify images appear in the app

After the script completes, check the live site:
- Log in as pilzner (a@aol.com)
- Go to My Recipes
- Verify the crawl recipes now have food photos
- Confirm the chef's hat watermark is visible in the bottom-right
- Check that the image appears on the recipe detail page

---

## COMPLETION CHECKLIST

- [ ] scripts/generate-recipe-images.mjs created and committed
- [ ] Small-Batch Cheesy Focaccia step rewrite fixed
- [ ] Script run on RPi5 — all crawl recipes processed
- [ ] Succeeded count > 0
- [ ] Images visible in the app for crawl recipes
- [ ] Chef's hat watermark visible bottom-right on AI images
- [ ] has_ai_image = true and image_generation_status = 'complete' in DB
- [ ] Run /wrapup
- [ ] Recap: how many images generated, total cost, any failures
