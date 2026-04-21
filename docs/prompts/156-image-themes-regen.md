# ChefsBook — Session 156: AI Image Themes + Better Prompts + Regeneration Pills
# Source: AI images don't match source dishes + user personalization
# Target: packages/ai + apps/web + apps/mobile + scripts

---

## CONTEXT

Read CLAUDE.md, DONE.md, feature-registry.md, import-pipeline.md,
ai-cost.md, and ALL mandatory agents per SESSION START sequence.

Three improvements to the AI image generation system:

1. **Better prompts** — use Claude Vision to describe the source image
   at import time, then use that description for Flux generation
2. **User themes** — 10 pre-defined visual styles users can pick from,
   applied to all future image generations
3. **Regeneration pills** — users can request a new image version
   using controlled pill prompts (no free-text)

---

## PART 1 — Better prompts via source image description

### 1a — Add describeSourceImage() to packages/ai

```typescript
// Uses Claude Haiku Vision — ~$0.005 per call
// Called at import time when source_image_url is available
export async function describeSourceImage(
  imageUrl: string,
  recipeName: string
): Promise<string | null> {
  try {
    // Fetch the image
    const response = await fetch(imageUrl)
    if (!response.ok) return null
    const buffer = await response.arrayBuffer()
    const base64 = Buffer.from(buffer).toString('base64')
    const mimeType = response.headers.get('content-type') || 'image/jpeg'

    const result = await callClaude({
      model: HAIKU,
      messages: [{
        role: 'user',
        content: [
          {
            type: 'image',
            source: { type: 'base64', media_type: mimeType, data: base64 }
          },
          {
            type: 'text',
            text: `This is a photo of "${recipeName}". Describe the visual presentation in 2-3 sentences focusing on: the dish's appearance, plating style, colors, textures, serving vessel, and background/surface. Be specific and visual. Do not mention the recipe name. Start with the dish itself.`
          }
        ]
      }],
      maxTokens: 150
    })

    return result.trim()
  } catch {
    return null  // Silent fail — fall back to ingredient-based prompt
  }
}
```

Add to ai-cost.md: describeSourceImage — HAIKU Vision — ~$0.005/call
Called only when source image URL is available at import time.

### 1b — Store visual description on recipes

```sql
-- Migration 040
ALTER TABLE recipes
  ADD COLUMN IF NOT EXISTS source_image_url TEXT,
  ADD COLUMN IF NOT EXISTS source_image_description TEXT;
```

### 1c — Wire into import pipeline

In importFromUrl(), after extracting the recipe:

```typescript
// Extract source image URL from the page (og:image or first recipe image)
const sourceImageUrl = rawRecipe.image || rawRecipe.og_image || null

// Get visual description if image exists
let sourceImageDescription = null
if (sourceImageUrl) {
  sourceImageDescription = await describeSourceImage(
    sourceImageUrl,
    rawRecipe.title
  )
}

// Save to recipe
await saveRecipe({
  ...finalRecipe,
  source_image_url: sourceImageUrl,
  source_image_description: sourceImageDescription
})
```

### 1d — Use description in image generation prompt

Update buildImagePrompt() in packages/ai:

```typescript
export async function buildImagePrompt(
  recipe: Recipe,
  theme: ImageTheme = 'bright_fresh',
  modifier?: string  // from regeneration pill
): Promise<string> {

  // Base: use source image description if available
  const visualBase = recipe.source_image_description
    ?? `${recipe.title}${keyIngredients ? ', featuring ' + keyIngredients : ''}`

  // Theme modifier
  const themePrompt = IMAGE_THEMES[theme].prompt

  // Regeneration modifier (if user requested a new version)
  const modifierPrompt = modifier ? `, ${modifier}` : ''

  return [
    'Professional food photography,',
    visualBase,
    themePrompt,
    modifierPrompt,
    'high resolution, no text, no watermarks, no people, photorealistic'
  ].filter(Boolean).join(' ')
}
```

---

## PART 2 — Image Themes System

### 2a — Define 10 themes in packages/ai

```typescript
export type ImageTheme =
  | 'bright_fresh'
  | 'farmhouse'
  | 'fine_dining'
  | 'editorial'
  | 'garden_fresh'
  | 'candlelit'
  | 'japanese_minimal'
  | 'mediterranean'
  | 'cozy_autumn'
  | 'modern_glam'

export interface ThemeDefinition {
  id: ImageTheme
  name: string
  emoji: string
  description: string  // shown to user
  prompt: string       // appended to Flux prompt
  previewImage: string // path to pre-generated pasta example
}

export const IMAGE_THEMES: Record<ImageTheme, ThemeDefinition> = {
  bright_fresh: {
    id: 'bright_fresh',
    name: 'Bright & Fresh',
    emoji: '🌞',
    description: 'Natural daylight, white marble, vibrant colors',
    prompt: 'natural window light, white marble surface, bright airy atmosphere, vibrant fresh colors, clean minimal styling, soft shadows',
    previewImage: '/images/themes/bright-fresh.jpg'
  },
  farmhouse: {
    id: 'farmhouse',
    name: 'Farmhouse',
    emoji: '🪵',
    description: 'Rustic wood table, warm golden hour light',
    prompt: 'rustic wooden table, linen napkins, warm golden hour light, farmhouse aesthetic, cast iron or ceramic, cozy homestyle',
    previewImage: '/images/themes/farmhouse.jpg'
  },
  fine_dining: {
    id: 'fine_dining',
    name: 'Fine Dining',
    emoji: '🍽️',
    description: 'Elegant plating, dramatic restaurant lighting',
    prompt: 'dark slate surface, elegant restaurant plating, dramatic side lighting, fine dining presentation, precise garnish, high contrast',
    previewImage: '/images/themes/fine-dining.jpg'
  },
  editorial: {
    id: 'editorial',
    name: 'Editorial',
    emoji: '📰',
    description: 'Overhead flat lay, magazine aesthetic',
    prompt: 'overhead flat lay, styled food photography, magazine editorial aesthetic, neutral linen background, carefully arranged props',
    previewImage: '/images/themes/editorial.jpg'
  },
  garden_fresh: {
    id: 'garden_fresh',
    name: 'Garden Fresh',
    emoji: '🌿',
    description: 'Outdoor natural setting, herbs and produce',
    prompt: 'outdoor garden setting, dappled natural light, fresh herbs scattered, terracotta surfaces, botanical atmosphere',
    previewImage: '/images/themes/garden-fresh.jpg'
  },
  candlelit: {
    id: 'candlelit',
    name: 'Candlelit',
    emoji: '🕯️',
    description: 'Moody evening atmosphere, warm candlelight',
    prompt: 'candlelight atmosphere, warm amber tones, moody evening lighting, dark rich background, intimate dinner setting',
    previewImage: '/images/themes/candlelit.jpg'
  },
  japanese_minimal: {
    id: 'japanese_minimal',
    name: 'Japanese Minimal',
    emoji: '🎋',
    description: 'Clean white ceramic, zen simplicity',
    prompt: 'clean white ceramic, zen minimalist composition, Japanese aesthetic, negative space, precise plating, neutral background',
    previewImage: '/images/themes/japanese-minimal.jpg'
  },
  mediterranean: {
    id: 'mediterranean',
    name: 'Mediterranean',
    emoji: '☀️',
    description: 'Bright sunshine, blue tiles, olive wood',
    prompt: 'bright Mediterranean sunshine, blue and white tiles, olive wood surface, vibrant produce colors, sun-drenched atmosphere',
    previewImage: '/images/themes/mediterranean.jpg'
  },
  cozy_autumn: {
    id: 'cozy_autumn',
    name: 'Cozy Autumn',
    emoji: '🍂',
    description: 'Warm amber tones, textured fabrics, hearty',
    prompt: 'warm amber autumn tones, textured wool or linen, cozy hygge atmosphere, rich earthy colors, comfort food styling',
    previewImage: '/images/themes/cozy-autumn.jpg'
  },
  modern_glam: {
    id: 'modern_glam',
    name: 'Modern Glam',
    emoji: '✨',
    description: 'Sleek black surfaces, high contrast, contemporary',
    prompt: 'sleek black marble surface, metallic accents, high contrast dramatic lighting, contemporary modern aesthetic, sophisticated',
    previewImage: '/images/themes/modern-glam.jpg'
  }
}
```

### 2b — Add theme to user_profiles

```sql
-- Migration 040
ALTER TABLE user_profiles
  ADD COLUMN IF NOT EXISTS image_theme TEXT DEFAULT 'bright_fresh'
    CHECK (image_theme IN (
      'bright_fresh', 'farmhouse', 'fine_dining', 'editorial',
      'garden_fresh', 'candlelit', 'japanese_minimal',
      'mediterranean', 'cozy_autumn', 'modern_glam'
    ));
```

### 2c — Pre-generate 10 theme example images

Create scripts/generate-theme-examples.mjs:

The prompt for each theme uses the SAME pasta dish as a base
(pappardelle with tomato sauce and basil) with each theme's
style modifier. This lets users compare themes on identical food.

Base dish: "pappardelle pasta with rich tomato sauce, fresh basil leaves, parmesan"

Generate 10 images (one per theme):
- Use Replicate Flux Dev ($0.025 × 10 = $0.25 total)
- Save to apps/web/public/images/themes/[theme-id].jpg
- These are static assets — generated once, never regenerated

```javascript
const BASE_DISH = 'pappardelle pasta with rich tomato sauce and fresh basil'

for (const theme of Object.values(IMAGE_THEMES)) {
  const prompt = `Professional food photography of ${BASE_DISH}, ${theme.prompt}, high resolution, no text, no watermarks, no people, photorealistic`
  // Generate via Replicate
  // Save to public/images/themes/${theme.id}.jpg
}
```

Run on RPi5:
```bash
export REPLICATE_API_TOKEN=r8_ZE9sar6UuIxFjL7aEBrTrUJkaoe8Mt80sd6Og
node scripts/generate-theme-examples.mjs
```

### 2d — "My Theme" button on My Recipes page

On apps/web/app/dashboard/recipes/page.tsx, add a "My Theme" pill
button in the top filter bar alongside existing filters:

```tsx
<button
  onClick={() => setThemeModalOpen(true)}
  className="theme-pill-button"
>
  {currentTheme.emoji} My Theme
  <span className="theme-name">{currentTheme.name}</span>
</button>
```

### 2e — Theme picker modal

Opens when "My Theme" is clicked:

```
┌────────────────────────────────────────────────────┐
│  Choose Your Image Theme                           │
│  Applied to all future AI-generated recipe images  │
│                                                    │
│  [🌞 Bright & Fresh]  [🪵 Farmhouse]              │
│  [pasta photo]        [pasta photo]               │
│                                                    │
│  [🍽️ Fine Dining]    [📰 Editorial]              │
│  [pasta photo]        [pasta photo]               │
│                                                    │
│  ... (all 10 themes in a 2-column grid)           │
│                                                    │
│  Currently: 🌞 Bright & Fresh                      │
│                                                    │
│  [Cancel]  [Save Theme]                            │
└────────────────────────────────────────────────────┘
```

Each theme card shows:
- Emoji + theme name
- Pre-generated pasta example image
- Theme description
- Selected state: red border + checkmark

Save triggers PATCH /api/user/theme with the selected theme.
Updates user_profiles.image_theme.

### 2f — Wire theme + model selection into image generation

```typescript
// Get user's theme + plan + quality override
const { data: profile } = await supabaseAdmin
  .from('user_profiles')
  .select('image_theme, plan_tier, image_quality_override')
  .eq('id', userId)
  .single()

const theme = (profile?.image_theme ?? 'bright_fresh') as ImageTheme

// Determine model based on plan or admin override
function getImageModel(planTier: string, override?: string): string {
  // Admin override takes priority
  if (override === 'dev') return 'black-forest-labs/flux-dev'
  if (override === 'schnell') return 'black-forest-labs/flux-schnell'

  // Pro plan always gets Dev
  if (planTier === 'pro') return 'black-forest-labs/flux-dev'

  // All other plans get Schnell
  return 'black-forest-labs/flux-schnell'
}

const model = getImageModel(profile?.plan_tier, profile?.image_quality_override)

// Cost reference:
// flux-schnell: ~$0.003/image (Free, Chef, Family)
// flux-dev: ~$0.025/image (Pro, or admin override)

const prompt = await buildImagePrompt(recipe, theme)
```

---

## PART 3 — Regeneration Pills

### 3a — Pill options

Define 6 regeneration options, each with a controlled prompt modifier:

```typescript
export const REGEN_PILLS = [
  {
    id: 'wrong_dish',
    label: '🍽️ Dish looks wrong',
    modifier: 'focus more precisely on the actual dish appearance and ingredients'
  },
  {
    id: 'update_scene',
    label: '🏡 Change the scene',
    modifier: 'different background setting and surface material'
  },
  {
    id: 'brighter',
    label: '☀️ Make it brighter',
    modifier: 'brighter lighting, more vibrant colors, airy atmosphere'
  },
  {
    id: 'moodier',
    label: '🌙 Make it moodier',
    modifier: 'darker moodier lighting, rich deep tones, dramatic shadows'
  },
  {
    id: 'closer',
    label: '🔍 Zoom in closer',
    modifier: 'extreme close-up macro shot, shallow depth of field, details'
  },
  {
    id: 'overhead',
    label: '📸 Overhead view',
    modifier: 'overhead flat lay aerial view, looking straight down'
  },
]
```

### 3b — Regeneration limits

```sql
ALTER TABLE recipe_user_photos
  ADD COLUMN IF NOT EXISTS regen_count INT DEFAULT 0;

-- No per-user regen tracking needed — limit is per recipe, not per user
```

Limits:
- ALL plans: 1 regeneration per recipe, ever
- User must explicitly request it (never automatic)
- Once used, no further regenerations on that recipe
- The regeneration button disappears after it's been used

### 3c — Regeneration UI on recipe detail

When a recipe has an AI-generated image (is_ai_generated = true),
show below the image:

```
Not quite right?

[🍽️ Dish looks wrong] [🏡 Change scene] [☀️ Brighter]
[🌙 Moodier]          [🔍 Closer]       [📸 Overhead]

2 regenerations remaining  (or "Unlimited" for Pro)
```

Clicking a pill:
1. Shows spinner: "Generating new image..."
2. Calls POST /api/recipe/[id]/regenerate-image with { pillId }
3. Server builds new prompt with the pill modifier
4. Generates new image via Replicate
5. Applies watermarks
6. Saves as new primary photo
7. Old image removed from storage
8. Decrements regeneration count

### 3d — Moderation on regeneration

Since pills map to controlled modifiers, content is inherently safe.
However, still run isActuallyARecipe() on the result to confirm the
generated image is food-appropriate before showing it.

If generation produces something unexpected (very rare with controlled
prompts), silently retry once with the same pill. If it fails twice,
show: "We couldn't generate a better image this time. Try a different option."

---

## PART 3b — Admin image quality override

### Database

```sql
-- Migration 040
ALTER TABLE user_profiles
  ADD COLUMN IF NOT EXISTS image_quality_override TEXT DEFAULT NULL
    CHECK (image_quality_override IN ('schnell', 'dev', NULL));
-- NULL = use plan default
-- 'schnell' = force Schnell regardless of plan
-- 'dev' = force Dev regardless of plan (admin gift/reward)
```

### Admin user detail page

On /admin/users/[id] (or the user row in /admin/users), add an
"Image Quality" field in the admin controls section:

```
Image Generation Quality
○ Plan default (Auto)     ← default, uses plan tier
○ Standard (Flux Schnell) ← force Schnell
● Premium (Flux Dev)      ← force Dev — admin gift
```

Radio button group. Saving calls PATCH /api/admin with:
```json
{
  "action": "update_user",
  "userId": "...",
  "image_quality_override": "dev" | "schnell" | null
}
```

Show a small badge on the user row in the users table when
override is active: "🎨 Dev" in green so admin can see at a glance
which users have been upgraded.

### Pricing page note

On the /dashboard/plans pricing page, under Pro plan features, add:
"✓ Premium AI food photography (Flux Dev)"

Under Chef/Family plan:
"✓ AI food photography"
(No quality qualifier — users don't need to know the model name)

---

## PART 4 — Mobile: Theme picker + Regeneration pills

### 4a — My Recipes header button (mobile)

Add a theme button to the mobile Recipes tab header:

```tsx
<TouchableOpacity onPress={() => setThemeModalOpen(true)}>
  <Text>{currentTheme.emoji} Theme</Text>
</TouchableOpacity>
```

### 4b — Theme picker modal (mobile)

Same 10 themes shown in a scrollable grid using ChefsDialog pattern.
Theme example images loaded from the same /images/themes/ path.

### 4c — Regeneration pills (mobile)

On mobile recipe detail, below the image:
Same 6 pills in a horizontal scrollable row.
Same limits apply.

---

## MIGRATION 040

```sql
ALTER TABLE recipes
  ADD COLUMN IF NOT EXISTS source_image_url TEXT,
  ADD COLUMN IF NOT EXISTS source_image_description TEXT;

ALTER TABLE user_profiles
  ADD COLUMN IF NOT EXISTS image_theme TEXT DEFAULT 'bright_fresh',
  ADD COLUMN IF NOT EXISTS ai_image_regens_used INT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS ai_image_regens_reset_at TIMESTAMPTZ;

ALTER TABLE recipe_user_photos
  ADD COLUMN IF NOT EXISTS regen_count INT DEFAULT 0;
```

---

## DEPLOYMENT

```bash
ssh rasp@rpi5-eth

# Apply migration
docker exec -it supabase-db psql -U postgres -d postgres \
  -f /mnt/chefsbook/repo/supabase/migrations/040_image_themes.sql
docker restart supabase-rest

# Generate theme example images ($0.25 one-time cost)
export REPLICATE_API_TOKEN=r8_ZE9sar6UuIxFjL7aEBrTrUJkaoe8Mt80sd6Og
node scripts/generate-theme-examples.mjs

cd /mnt/chefsbook/repo
git pull
cd apps/web
rm -rf node_modules/react node_modules/react-dom .next
NODE_OPTIONS=--max-old-space-size=1536 npm run build 2>&1 | tail -20
pm2 restart chefsbook-web
```

---

## COMPLETION CHECKLIST

### Part 1 — Better prompts
- [ ] describeSourceImage() in packages/ai (Haiku Vision)
- [ ] source_image_url + source_image_description columns on recipes
- [ ] Source image description extracted at import time
- [ ] buildImagePrompt() uses description when available
- [ ] ai-cost.md updated

### Part 2 — Themes
- [ ] 10 themes defined in packages/ai with prompts
- [ ] image_theme column on user_profiles (default: bright_fresh)
- [ ] scripts/generate-theme-examples.mjs created and run
- [ ] 10 pasta example images in apps/web/public/images/themes/
- [ ] "My Theme" pill button on My Recipes page (web)
- [ ] Theme picker modal with image previews (web)
- [ ] Theme picker modal (mobile)
- [ ] PATCH /api/user/theme endpoint
- [ ] Theme applied to all future image generations
- [ ] Flux Schnell used for Free/Chef/Family plans
- [ ] Flux Dev used for Pro plan always
- [ ] image_quality_override column on user_profiles
- [ ] Admin user page: Image Quality radio buttons (Auto/Schnell/Dev)
- [ ] Admin users table: "🎨 Dev" badge when override active
- [ ] Pricing page updated: Pro shows "Premium AI food photography"
- [ ] getImageModel() respects override over plan tier

### Part 3 — Regeneration pills
- [ ] 6 REGEN_PILLS defined with controlled modifiers
- [ ] Regeneration limit: 1 per recipe, all plans
- [ ] regen_count on recipe_user_photos (0=available, 1=used)
- [ ] Pills hidden permanently after regen is used
- [ ] Regeneration UI shown below AI images (web + mobile)
- [ ] POST /api/recipe/[id]/regenerate-image endpoint
- [ ] Old image replaced, watermarks applied to new image
- [ ] Plan limit enforced with friendly message

### General
- [ ] Migration 040 applied + PostgREST restarted
- [ ] feature-registry.md updated
- [ ] tsc --noEmit passes both apps
- [ ] Deployed to RPi5
- [ ] Run /wrapup
- [ ] At the end recap: theme examples generated, regeneration
      tested on one recipe, what was left incomplete and why.
