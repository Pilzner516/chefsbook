# ChefsBook — Session 160: Fix Watermark Visibility + Image Creativity Slider
# Source: Watermark not visible on any AI images + generated images too similar to source
# Target: packages/ai + scripts + apps/web (admin settings)

---

## CONTEXT

Read CLAUDE.md and DONE.md before starting.

Two issues to fix:

1. The "ChefsBook" watermark badge is not visible on ANY AI-generated
   recipe images despite apply-watermarks.mjs reporting 75/75 success.
   The watermark application is silently failing or the badge is
   rendering incorrectly.

2. AI-generated images are too visually similar to the source images
   because describeSourceImage() describes the original so accurately
   that Flux essentially recreates it. This defeats copyright protection.
   An admin creativity slider will control how different generated images
   are from their source.

---

## PART 1 — Diagnose and fix watermark

### 1a — Download and inspect an actual image

```bash
ssh rasp@rpi5-eth
cd /mnt/chefsbook/repo

# Download one AI image from storage
node -e "
import { createClient } from '@supabase/supabase-js'
const sb = createClient('http://100.110.47.62:8000', process.env.SUPABASE_SERVICE_ROLE_KEY)
const { data } = await sb.from('recipe_user_photos')
  .select('url, recipe_id')
  .eq('is_ai_generated', true)
  .limit(1)
  .single()
console.log('URL:', data.url)

// Download the image
const res = await fetch(data.url)
const buf = Buffer.from(await res.arrayBuffer())
require('fs').writeFileSync('/tmp/test-image.jpg', buf)
console.log('Saved to /tmp/test-image.jpg, size:', buf.length)
" --input-type=module
```

Copy to local machine and inspect visually:
```bash
# From local machine
scp rasp@rpi5-eth:/tmp/test-image.jpg ./test-image.jpg
```

### 1b — Check the watermark badge PNG

```bash
# Check if badge exists and has correct dimensions
node -e "
import sharp from 'sharp'
const meta = await sharp('apps/web/public/images/watermark-chefsbook.png').metadata()
console.log('Badge dimensions:', meta.width, 'x', meta.height)
console.log('Format:', meta.format)
console.log('Channels:', meta.channels)
" --input-type=module
```

If badge is missing or wrong size: re-run scripts/create-watermark-badge.mjs

### 1c — Test sharp compositing directly

```bash
node -e "
import sharp from 'sharp'
import fs from 'fs'

// Download a test image
const res = await fetch('http://100.110.47.62:8000/storage/v1/object/public/recipe-user-photos/ai-generated/RECIPE_ID.jpg')
const buf = Buffer.from(await res.arrayBuffer())

// Create a bright red test square to verify compositing works
const redSquare = await sharp({
  create: { width: 120, height: 40, channels: 4,
    background: { r: 255, g: 0, b: 0, alpha: 1 } }
}).png().toBuffer()

// Get image dimensions
const meta = await sharp(buf).metadata()
console.log('Image size:', meta.width, 'x', meta.height)

// Composite red square bottom-right
const result = await sharp(buf)
  .composite([{
    input: redSquare,
    left: meta.width - 132,
    top: meta.height - 52,
    blend: 'over'
  }])
  .jpeg({ quality: 90 })
  .toBuffer()

fs.writeFileSync('/tmp/test-watermark.jpg', result)
console.log('Saved test, size:', result.length)
" --input-type=module
```

If the red square appears → sharp compositing works, badge is the problem
If the red square doesn't appear → sharp compositing itself is broken

### 1d — Fix the watermark badge

If the badge PNG has issues (wrong colors, transparent background,
wrong size), rebuild it with explicit settings:

```javascript
// In create-watermark-badge.mjs — ensure opaque white background
const svg = `<svg width="160" height="36" xmlns="http://www.w3.org/2000/svg">
  <!-- Solid white background — NOT transparent -->
  <rect x="0" y="0" width="160" height="36" rx="18" fill="white"/>
  <!-- Drop shadow simulation via border -->
  <rect x="1" y="1" width="158" height="34" rx="17"
    fill="white" stroke="rgba(0,0,0,0.15)" stroke-width="1"/>
  <!-- "Chefs" in red -->
  <text x="14" y="23" font-family="Arial,sans-serif" font-size="14"
    font-weight="bold" fill="#ce2b37">Chefs</text>
  <!-- "book" in black -->
  <text x="58" y="23" font-family="Arial,sans-serif" font-size="14"
    font-weight="bold" fill="#1a1a1a">book</text>
  <!-- Simple hat icon -->
  <g transform="translate(118, 8)">
    <rect x="2" y="16" width="22" height="5" rx="1" fill="#ce2b37"/>
    <ellipse cx="13" cy="13" rx="11" ry="9" fill="white"
      stroke="#ce2b37" stroke-width="2"/>
    <ellipse cx="7" cy="16" rx="5" ry="5" fill="white"
      stroke="#ce2b37" stroke-width="1.5"/>
    <ellipse cx="19" cy="16" rx="5" ry="5" fill="white"
      stroke="#ce2b37" stroke-width="1.5"/>
    <rect x="4" y="9" width="18" height="9" fill="white"/>
  </g>
</svg>`
```

Regenerate the badge and verify it renders correctly before
applying to images.

### 1e — Re-run apply-watermarks.mjs with verbose logging

Add detailed logging to confirm each step:
```javascript
console.log(`  Downloading from: ${urlPath}`)
console.log(`  Image size: ${imageBuffer.length} bytes`)
console.log(`  Image dimensions: ${metadata.width}x${metadata.height}`)
console.log(`  Watermark position: left=${left}, top=${top}`)
console.log(`  Watermarked size: ${watermarkedBuffer.length} bytes`)
console.log(`  Uploading to: ${urlPath}`)
```

Re-run on RPi5:
```bash
export SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiAiSFMyNTYiLCAidHlwIjogIkpXVCJ9.eyJyb2xlIjogInNlcnZpY2Vfcm9sZSIsICJpc3MiOiAic3VwYWJhc2UiLCAiaWF0IjogMTc1MTAwMDAwMCwgImV4cCI6IDE5MDg3NjY0MDB9.d0A4kE4okczvSWbLw9WxzVr9sr2AMdzh09Lnu7T1eXQ
node scripts/apply-watermarks.mjs
```

After running, download and visually verify the badge appears.

### 1f — Fix generate-recipe-images.mjs watermark

The watermark must also be applied correctly in the generation
script for all FUTURE images. Ensure the badge path is correct
and sharp compositing is verified before saving.

---

## PART 2 — Image Creativity Slider

### 2a — Add creativity_level to system_settings

```sql
-- Add to system_settings table (already exists from session 148)
INSERT INTO system_settings (key, value)
VALUES ('image_creativity_level', '3')
ON CONFLICT (key) DO NOTHING;
-- Scale: 1 (faithful) to 5 (creative)
```

### 2b — Define creativity levels

```typescript
export type CreativityLevel = 1 | 2 | 3 | 4 | 5

export const CREATIVITY_PROMPTS: Record<CreativityLevel, {
  label: string
  description: string
  useSourceDescription: boolean
  promptModifier: string
}> = {
  1: {
    label: 'Very Faithful',
    description: 'Very similar to the original source image',
    useSourceDescription: true,
    promptModifier: 'match the original presentation style closely'
  },
  2: {
    label: 'Faithful',
    description: 'Similar dish, similar presentation',
    useSourceDescription: true,
    promptModifier: 'similar plating style but with fresh styling'
  },
  3: {
    label: 'Balanced',
    description: 'Same dish, different presentation (recommended)',
    useSourceDescription: false,  // use title + ingredients only
    promptModifier: 'creative food styling, different from typical presentations'
  },
  4: {
    label: 'Creative',
    description: 'Inspired by the dish, unique styling',
    useSourceDescription: false,
    promptModifier: 'highly creative and artistic food photography, unique angle and styling'
  },
  5: {
    label: 'Very Creative',
    description: 'Completely original interpretation',
    useSourceDescription: false,
    promptModifier: 'completely original artistic interpretation, avant-garde food photography'
  }
}
```

### 2c — Wire into buildImagePrompt()

```typescript
export async function buildImagePrompt(
  recipe: Recipe,
  theme: ImageTheme = 'bright_fresh',
  modifier?: string,
  creativityLevel: CreativityLevel = 3
): Promise<string> {

  const creativity = CREATIVITY_PROMPTS[creativityLevel]

  // Only use source description at levels 1-2
  const visualBase = (creativity.useSourceDescription && recipe.source_image_description)
    ? recipe.source_image_description
    : `${recipe.title}${keyIngredients ? ', featuring ' + keyIngredients : ''}`

  const themePrompt = IMAGE_THEMES[theme].prompt
  const modifierPrompt = modifier ? `, ${modifier}` : ''

  return [
    'Professional food photography,',
    visualBase,
    creativity.promptModifier,
    themePrompt,
    modifierPrompt,
    'high resolution, no text, no watermarks, no people, photorealistic'
  ].filter(Boolean).join(', ')
}
```

### 2d — Read creativity level from system_settings before generating

```typescript
async function getCreativityLevel(): Promise<CreativityLevel> {
  const { data } = await supabaseAdmin
    .from('system_settings')
    .select('value')
    .eq('key', 'image_creativity_level')
    .single()
  return (parseInt(data?.value ?? '3') as CreativityLevel) || 3
}
```

### 2e — Admin settings UI

On /admin settings page, add an Image Generation section:

```
Image Generation Settings
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Image Creativity Level
Controls how different AI-generated images are from source photos.
Higher values ensure more copyright distance.

Faithful ◄────────────────────────► Creative
    1         2         3         4         5
    ○         ○         ●         ○         ○

[1] Very Faithful  — Very similar to source
[2] Faithful       — Similar presentation
[3] Balanced       — Same dish, different style (recommended ✓)
[4] Creative       — Unique styling
[5] Very Creative  — Completely original

Current: Balanced (3) — Recommended for copyright safety

⚠️ Levels 1-2 may produce images too similar to source photos.
   Level 3+ is recommended for copyright protection.

[Save]
```

Radio buttons. Saving calls PATCH /api/admin with:
```json
{ "action": "update_setting", "key": "image_creativity_level", "value": "3" }
```

Show a warning in amber if admin selects level 1 or 2:
"⚠️ Levels 1-2 may produce images visually similar to source photos,
which could raise copyright concerns."

---

## PART 3 — Re-generate the soufflé image correctly

The "Watercress and Cheese Soufflé" image is too similar to the
original. After fixing the creativity level to 3, regenerate it:

```bash
# Find the recipe and trigger regeneration at level 3
# Use the regeneration API with pill: 'wrong_dish' or 'update_scene'
```

Verify the new image:
- Looks like a soufflé (correct dish)
- Noticeably different from the La Cucina Italiana source photo
- Has the "ChefsBook" watermark badge bottom-right

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

### Part 1 — Watermark fix
- [ ] Root cause of invisible watermark identified
- [ ] Badge PNG verified: correct dimensions, opaque white background,
      red "Chefs" + black "book" + hat icon clearly visible
- [ ] sharp compositing confirmed working (red square test)
- [ ] apply-watermarks.mjs re-run with verbose logging
- [ ] Image downloaded and visually verified — badge visible bottom-right
- [ ] generate-recipe-images.mjs also fixed for future images
- [ ] All 75+ AI images now have visible watermark

### Part 2 — Creativity slider
- [ ] image_creativity_level added to system_settings (default: 3)
- [ ] CREATIVITY_PROMPTS defined (levels 1-5)
- [ ] buildImagePrompt() respects creativity level
- [ ] At level 3+: source image description NOT used in prompt
- [ ] getCreativityLevel() reads from system_settings
- [ ] Admin settings page: radio button slider with descriptions
- [ ] Warning shown for levels 1-2
- [ ] Setting saved to system_settings via admin API

### Part 3 — Soufflé re-generation
- [ ] Soufflé image regenerated at creativity level 3
- [ ] New image: correct dish, different from source, has watermark
- [ ] Watermark verified visible on new image

### General
- [ ] feature-registry.md updated
- [ ] ai-cost.md updated if new functions added
- [ ] tsc --noEmit passes both apps
- [ ] Deployed to RPi5
- [ ] Run /wrapup
- [ ] At the end: show what the watermark looks like (describe position,
      size, colors), confirm creativity level is now 3, confirm soufflé
      image is acceptably different from source.
