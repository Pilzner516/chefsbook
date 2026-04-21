# ChefsBook — Session 147: Copyright Protection Suite
# Source: Legal protection for imported recipes
# Target: packages/ai + packages/db + apps/web + apps/mobile + apps/extension

---

## CONTEXT

Read CLAUDE.md, DONE.md, feature-registry.md, import-pipeline.md,
ai-cost.md, and ALL mandatory agents per SESSION START sequence.

This session implements 4 related copyright protection features:
1. Step rewriting on import (Haiku — paraphrase, don't alter meaning)
2. AI image generation (Flux via Replicate, background, watermarked)
3. User image upload copyright confirmation
4. Copyright flagging system with dedicated admin review

---

## PART 1 — Step Rewriting on Import

### 1a — rewriteRecipeSteps() in packages/ai

```typescript
// Uses HAIKU — ~$0.0003 per recipe (very cheap)
export async function rewriteRecipeSteps(
  steps: RecipeStep[],
  recipeName: string,
  cuisine?: string
): Promise<RecipeStep[]>
```

Prompt to Claude Haiku:
```
You are rewriting cooking instructions to avoid verbatim copying.
Recipe: "{recipeName}" ({cuisine})

Rewrite each step below in your own words while:
- Keeping ALL quantities, temperatures, times, and techniques EXACTLY the same
- Keeping the same number of steps — do not merge or split steps
- Keeping the same order of operations
- Using clear, friendly cooking language
- Never adding new information or changing the method
- Never removing any instruction

Return ONLY a JSON array of strings, one per step, in the same order.
Steps to rewrite:
{steps.map((s,i) => `${i+1}. ${s.text}`).join('\n')}
```

Model: HAIKU
Max tokens: 2000
Called ONLY on URL/extension imports — not on user-created or
scanned recipes (those are the user's own words).

### 1b — Wire into import pipeline

After every successful URL import, before saving to DB:
```typescript
// Rewrite steps (fire-and-forget approach — save original first,
// then update with rewritten steps)
const recipe = await saveRecipe(rawImport)

// Rewrite in background
rewriteRecipeSteps(rawImport.steps, rawImport.title, rawImport.cuisine)
  .then(rewrittenSteps => {
    supabaseAdmin.from('recipes').update({
      steps: rewrittenSteps,
      steps_rewritten: true,
      steps_rewritten_at: new Date().toISOString()
    }).eq('id', recipe.id)
  })
  .catch(() => {
    // Silent fail — original steps kept if rewrite fails
  })
```

Add columns to recipes table (migration 038):
```sql
ALTER TABLE recipes
  ADD COLUMN IF NOT EXISTS steps_rewritten BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS steps_rewritten_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS has_ai_image BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS ai_image_prompt TEXT,
  ADD COLUMN IF NOT EXISTS image_generation_status TEXT
    CHECK (image_generation_status IN (
      'pending', 'generating', 'complete', 'failed', NULL
    ));
```

### 1c — Backfill existing imported recipes

For all existing recipes where source_url IS NOT NULL and
steps_rewritten = false, queue a background rewrite.

Create scripts/rewrite-imported-steps.mjs that processes them
in batches of 10, rate limited to 1 per second.

---

## PART 2 — AI Image Generation

### 2a — generateRecipeImage() in packages/ai

```typescript
// Uses Replicate Flux Dev — ~$0.025 per image
export async function generateRecipeImage(recipe: {
  title: string
  cuisine?: string
  ingredients: string[]
  tags?: string[]
}): Promise<string | null>  // returns image URL or null on failure
```

Build a targeted food photography prompt:
```typescript
const keyIngredients = recipe.ingredients
  .slice(0, 4)
  .map(i => i.name)
  .join(', ')

const prompt = `Professional food photography of ${recipe.title},
${recipe.cuisine ? recipe.cuisine + ' cuisine, ' : ''}
featuring ${keyIngredients}.
Editorial style, natural window light, shallow depth of field,
styled on a beautiful plate or bowl, warm tones,
appetizing presentation, high resolution, no text, no watermarks,
no people, photorealistic.`

// Call Replicate Flux Dev
const response = await fetch(
  'https://api.replicate.com/v1/models/black-forest-labs/flux-dev/predictions',
  {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.REPLICATE_API_TOKEN}`,
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
```

Add REPLICATE_API_TOKEN to .env.local documentation in CLAUDE.md.

### 2b — Watermark with ChefsBook hat

After generating the image, add the ChefsBook hat watermark
in the bottom-right corner.

Use sharp (Node.js image processing library) server-side:

```typescript
import sharp from 'sharp'

async function addWatermark(
  imageBuffer: Buffer,
  watermarkPath: string  // path to CBHat.png
): Promise<Buffer> {
  const watermark = await sharp(watermarkPath)
    .resize(60, 60)  // small watermark
    .png()
    .toBuffer()

  return sharp(imageBuffer)
    .composite([{
      input: watermark,
      gravity: 'southeast',  // bottom-right
      blend: 'over'
    }])
    .jpeg({ quality: 85 })
    .toBuffer()
}
```

The watermark is the CBHat.png (red square + white hat) resized to
60x60px, placed bottom-right with slight padding.

Install sharp: `npm install sharp` in packages/ai or apps/web.

### 2c — Background generation flow

Wire into import pipeline as a non-blocking background task:

```typescript
// After recipe is saved, trigger background image generation
async function triggerImageGeneration(recipeId: string, recipe: Recipe) {
  // Set status to pending immediately
  await supabaseAdmin.from('recipes').update({
    image_generation_status: 'pending'
  }).eq('id', recipeId)

  // Generate in background (don't await)
  generateAndSaveRecipeImage(recipeId, recipe)
    .catch(err => {
      supabaseAdmin.from('recipes').update({
        image_generation_status: 'failed'
      }).eq('id', recipeId)
    })
}

async function generateAndSaveRecipeImage(recipeId: string, recipe: Recipe) {
  await supabaseAdmin.from('recipes').update({
    image_generation_status: 'generating'
  }).eq('id', recipeId)

  const imageUrl = await generateRecipeImage(recipe)
  if (!imageUrl) throw new Error('Generation failed')

  // Download image
  const imageBuffer = await downloadImage(imageUrl)

  // Add watermark
  const watermarkedBuffer = await addWatermark(imageBuffer, CHEFS_HAT_PATH)

  // Upload to Supabase storage
  const fileName = `ai-generated/${recipeId}.jpg`
  await supabaseAdmin.storage
    .from('recipe-user-photos')
    .upload(fileName, watermarkedBuffer, {
      contentType: 'image/jpeg',
      upsert: true
    })

  // Save as primary photo
  const { data: photo } = await supabaseAdmin
    .from('recipe_user_photos')
    .insert({
      recipe_id: recipeId,
      url: `${STORAGE_URL}/${fileName}`,
      is_primary: true,
      is_ai_generated: true
    })
    .select()
    .single()

  await supabaseAdmin.from('recipes').update({
    image_generation_status: 'complete',
    has_ai_image: true,
    ai_image_prompt: recipe.title  // store prompt for reference
  }).eq('id', recipeId)
}
```

Add `is_ai_generated` column to recipe_user_photos:
```sql
ALTER TABLE recipe_user_photos
  ADD COLUMN IF NOT EXISTS is_ai_generated BOOLEAN DEFAULT false;
```

### 2d — Placeholder while generating

In the recipe detail UI (web + mobile), when
`image_generation_status = 'pending' | 'generating'`:
- Show the chef's hat placeholder in its normal position
- Add a subtle pulsing animation and small text below:
  "Generating recipe image..."
- When status changes to 'complete' (via Supabase Realtime):
  Swap the placeholder with the real image smoothly (fade transition)

### 2e — "Generate image" button for recipes without images

Every recipe without a user photo AND without an AI image should
show a "Generate image" button in the recipe detail (owner only):

```
[🎨 Generate recipe image]
```

Clicking triggers generateAndSaveRecipeImage() for that recipe.
Shows loading state while generating.
Available to all plans (Chef+ or all? — recommend all plans, it's
a quality-of-life feature that benefits the whole platform).

This covers the 32 crawl recipes and any user recipe without an image.

### 2f — Visible watermark (chef's hat)

The ChefsBook chef's hat watermark (CBHat.png) is placed bottom-right
on every AI-generated image. It is:
- 60x60px, semi-transparent white
- Clearly identifies the image as a ChefsBook rendering
- Only applied to images where is_ai_generated = true
- Never applied to user-uploaded photos

### 2g — Invisible steganographic watermark

In ADDITION to the visible hat, embed an invisible forensic watermark
into every AI-generated image. This watermark:
- Is completely invisible to the human eye
- Survives JPEG compression, resizing, and screenshot capture
- Can be extracted by forensic tools to prove ownership
- Contains: ChefsBook domain + recipe ID + generation timestamp

Use the `invisible-watermark` Python library or equivalent Node.js
package (e.g. `steganography.js`):

```typescript
// After adding visible watermark, embed invisible one
async function embedInvisibleWatermark(
  imageBuffer: Buffer,
  recipeId: string
): Promise<Buffer> {
  const payload = `chefsbk.app|${recipeId}|${Date.now()}`

  // Use LSB (Least Significant Bit) steganography
  // Encodes payload into pixel data invisibly
  // Install: npm install node-steganography or use Python subprocess
  return embedWatermark(imageBuffer, payload)
}
```

Add to CLAUDE.md: "All AI-generated recipe images contain an invisible
steganographic watermark proving ChefsBook ownership. If images are
found on other sites, the watermark can be extracted to prove origin."

If the invisible watermark library proves difficult to install on RPi5,
implement as a Python subprocess calling the `invisible-watermark`
pip package which is well-established and reliable.

### 2h — Watermark detection on user uploads

Before saving any user-uploaded image, run Claude Vision to detect
external watermarks or logos that indicate the image was taken from
another site:

```typescript
// Uses Claude Vision — ~$0.005 per check (Haiku with vision)
async function checkImageForWatermarks(imageBase64: string): Promise<{
  hasWatermark: boolean
  confidence: number
  detectedMarks: string[]
  riskLevel: 'low' | 'medium' | 'high'
}> {
  const response = await callClaude({
    model: HAIKU,
    messages: [{
      role: 'user',
      content: [
        {
          type: 'image',
          source: { type: 'base64', media_type: 'image/jpeg', data: imageBase64 }
        },
        {
          type: 'text',
          text: `Analyze this image for watermarks, logos, or branding that
indicates it came from a commercial recipe site or photo service.
Look for: text overlays, site names, photographer credits, Getty/Shutterstock
logos, or any other ownership marks.
Return ONLY valid JSON:
{"has_watermark": bool, "confidence": 0-100,
 "detected_marks": ["list"], "risk_level": "low"|"medium"|"high"}`
        }
      ]
    }]
  })
  return JSON.parse(response)
}
```

If risk_level is 'high':
- Block the upload
- Show message: "This image appears to be from another site and may
  be copyrighted. Please upload your own photo or tap 'Generate image'
  to create a unique AI image for this recipe."
- Offer the "Generate AI image" button as the immediate alternative

If risk_level is 'medium':
- Allow upload but show warning
- Log to recipe_user_photos for admin awareness

If risk_level is 'low':
- Allow upload normally

Add to ai-cost.md: checkImageForWatermarks — HAIKU Vision — ~$0.005/check

---

## PART 3 — User Image Upload Copyright Confirmation

### 3a — Confirmation modal on upload

When a user uploads an image (EditImageGallery on web + mobile),
before the upload completes show a confirmation modal:

```
📸 Image Upload Confirmation

By uploading this image you confirm:
☑ I took this photo myself, OR
☑ I have permission to use this image, OR
☑ This image is free to use (Creative Commons / public domain)

I confirm this image is NOT:
✗ Taken from the recipe website
✗ Someone else's copyrighted photo
✗ A screenshot of another app

[Cancel]  [Confirm & Upload]
```

ChefsDialog style. User must actively click "Confirm & Upload" —
not just dismiss.

Log the confirmation: add `upload_confirmed_copyright: true` and
`upload_confirmed_at` timestamp to recipe_user_photos.

```sql
ALTER TABLE recipe_user_photos
  ADD COLUMN IF NOT EXISTS upload_confirmed_copyright BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS upload_confirmed_at TIMESTAMPTZ;
```

### 3b — Apply to both web and mobile

Web: in the EditImageGallery upload handler, show ChefsDialog before
calling the upload API.

Mobile: in the EditImageGallery component, same pattern using the
mobile ChefsDialog.

---

## PART 4 — Copyright Flagging System

### 4a — Database (migration 038)

```sql
-- Add copyright flag type to comment_flags equivalent for recipes
CREATE TABLE recipe_flags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recipe_id UUID NOT NULL REFERENCES recipes(id) ON DELETE CASCADE,
  flagged_by UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  flag_type TEXT NOT NULL CHECK (flag_type IN (
    'copyright', 'inappropriate', 'spam', 'misinformation', 'other'
  )),
  reason TEXT,
  status TEXT DEFAULT 'pending'
    CHECK (status IN ('pending', 'approved', 'removed', 'dismissed')),
  reviewed_by UUID REFERENCES user_profiles(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMPTZ,
  admin_note TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(recipe_id, flagged_by, flag_type)
);

CREATE INDEX ON recipe_flags(recipe_id, status);
CREATE INDEX ON recipe_flags(flagged_by);
CREATE INDEX ON recipe_flags(flag_type, status);

ALTER TABLE recipe_flags ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users can flag" ON recipe_flags FOR INSERT
  WITH CHECK (flagged_by = auth.uid());
CREATE POLICY "users see own flags" ON recipe_flags FOR SELECT
  USING (flagged_by = auth.uid());

-- Track flag count per user in user_profiles
ALTER TABLE user_profiles
  ADD COLUMN IF NOT EXISTS recipes_flagged_count INT DEFAULT 0;
```

### 4b — Flag pills in recipe detail

In the recipe detail report/flag UI, add "Potentially copyrighted"
as a flag option alongside existing options.

Flag pills (shown when user taps the flag/report button):
- ⚠️ Inappropriate content
- 🚫 Spam or misleading
- **©️ Potentially copyrighted** ← new
- 📋 Other

### 4c — On copyright flag submitted

When a user submits a copyright flag:

1. Immediately set recipe visibility to 'private'
2. Set a new column `copyright_review_pending = true`
3. The recipe owner cannot change visibility while this is true
4. Show banner on recipe detail (owner only):
   ```
   ⚖️ Under copyright review
   This recipe has been flagged for potential copyright issues
   and is temporarily private. ChefsBook will review it shortly.
   You'll receive a message with our decision.
   ```
5. Show thank-you to the flagger:
   ```
   Thank you for helping keep ChefsBook fair and legal! ✓
   We've received your report and will review it promptly.
   ```
6. Increment `recipes_flagged_count` on the flagger's profile
7. Create a notification for admins (type: 'copyright_flag')

```sql
ALTER TABLE recipes
  ADD COLUMN IF NOT EXISTS copyright_review_pending BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS copyright_locked_at TIMESTAMPTZ;
```

### 4d — Visibility lock

When `copyright_review_pending = true`:
- The visibility toggle is disabled with a lock icon
- Tooltip: "Recipe is locked pending copyright review"
- Only admin can unlock by approving or removing the flag

### 4e — Admin copyright review tab

On /admin, add a new "Copyright" section in the sidebar nav,
OR add a "Copyright" filter tab on the existing /admin/flags page.

Recommended: dedicated /admin/copyright page.

Table columns:
- Recipe title (clickable → recipe detail in new tab)
- Submitter (@username + flag count badge)
- Flagged by (@username + total flags submitted — shown as
  "Flagged by @pilzner (🚩 3)" where 3 is their total flag count)
- Flag date
- Source URL (clickable link)
- Status pill: Pending / Approved / Removed
- Actions

Actions per row:
- **"Approve"** — recipe is legitimate, unlock:
  - Set copyright_review_pending = false
  - Set flag status = 'approved' (keep flagged for history)
  - Restore recipe visibility to what it was before
  - Send DM to recipe owner: "Your recipe '[title]' has been reviewed
    and approved. It's now visible again."
  - Send DM to flagger: "We reviewed '[title]' and determined it
    doesn't violate copyright. Thank you for your report."

- **"Remove"** — recipe infringes copyright:
  - Set recipe visibility = 'private' (permanent — owner cannot change)
  - Set recipe status = 'copyright_removed'
  - Add `removed_for_copyright = true` column
  - Send DM to recipe owner: "Your recipe '[title]' has been removed
    from public view due to copyright concerns. You may keep it as a
    private reference or delete it. If you believe this is an error,
    please contact us."
  - Send DM to flagger: "We reviewed '[title]' and removed it due to
    copyright concerns. Thank you for keeping ChefsBook legal!"
  - Recipe owner has 30 days to appeal or delete before auto-archive

- **"Dismiss"** — flag is unfounded, no action:
  - Set flag status = 'dismissed'
  - Restore recipe visibility
  - Send DM to flagger: "We reviewed your report and determined
    '[title]' doesn't raise copyright concerns. Thank you for
    helping keep ChefsBook fair."

### 4f — Admin sees flagger reputation

In the copyright table, the "Flagged by" column shows:
- @username
- (🚩 N) where N = total recipes this user has ever flagged

This helps admins identify:
- High-value reporters (flag a lot, usually right) → prioritize review
- Potential bad actors (flagging competitors maliciously) → lower priority

---

## MIGRATION 038 SUMMARY

```sql
-- Recipes table additions
ALTER TABLE recipes
  ADD COLUMN IF NOT EXISTS steps_rewritten BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS steps_rewritten_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS has_ai_image BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS ai_image_prompt TEXT,
  ADD COLUMN IF NOT EXISTS image_generation_status TEXT
    CHECK (image_generation_status IN ('pending','generating','complete','failed',NULL)),
  ADD COLUMN IF NOT EXISTS copyright_review_pending BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS copyright_locked_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS copyright_removed BOOLEAN DEFAULT false;

-- recipe_user_photos additions
ALTER TABLE recipe_user_photos
  ADD COLUMN IF NOT EXISTS is_ai_generated BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS upload_confirmed_copyright BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS upload_confirmed_at TIMESTAMPTZ;

-- user_profiles additions
ALTER TABLE user_profiles
  ADD COLUMN IF NOT EXISTS recipes_flagged_count INT DEFAULT 0;

-- New tables
CREATE TABLE recipe_flags (...); -- as defined in 4a
```

---

## DEPLOYMENT

```bash
ssh rasp@rpi5-eth

psql -U postgres -d postgres \
  -f /mnt/chefsbook/repo/supabase/migrations/038_copyright_protection.sql
docker restart supabase-rest

cd /mnt/chefsbook/repo
git pull
cd apps/web
npm install sharp  # if not already installed
rm -rf node_modules/react node_modules/react-dom .next
NODE_OPTIONS=--max-old-space-size=1536 npm run build 2>&1 | tail -20
pm2 restart chefsbook-web
```

After deployment, run the step rewrite backfill:
```bash
node scripts/rewrite-imported-steps.mjs
```

---

## COMPLETION CHECKLIST

### Part 1 — Step rewriting
- [ ] rewriteRecipeSteps() in packages/ai using HAIKU
- [ ] Wired into URL import pipeline (background, non-blocking)
- [ ] steps_rewritten column added to recipes
- [ ] Backfill script created and run for existing imported recipes
- [ ] ai-cost.md updated with rewriteRecipeSteps entry

### Part 2 — AI image generation
- [ ] generateRecipeImage() in packages/ai using Replicate Flux Dev
- [ ] sharp installed for watermarking
- [ ] CBHat.png watermark applied bottom-right (60x60px)
- [ ] Background generation flow wired into import pipeline
- [ ] Placeholder chef's hat shown with "Generating..." text
- [ ] Supabase Realtime swaps placeholder when complete
- [ ] "Generate image" button on recipes without photos (all plans)
- [ ] is_ai_generated column on recipe_user_photos
- [ ] Watermark ONLY on AI-generated images (never user uploads)
- [ ] Invisible steganographic watermark embedded in every AI image
- [ ] Invisible watermark contains: chefsbk.app + recipe ID + timestamp
- [ ] checkImageForWatermarks() using Claude Vision (Haiku) on every upload
- [ ] High-risk uploads blocked with message + "Generate AI image" alternative
- [ ] Medium-risk uploads allowed but logged
- [ ] ai-cost.md updated with checkImageForWatermarks entry
- [ ] Admin approval (Option B): auto-restores previous visibility state
- [ ] copyright_previous_visibility stored when flag applied

### Part 3 — Upload copyright confirmation
- [ ] ChefsDialog confirmation shown before every image upload
- [ ] upload_confirmed_copyright logged on recipe_user_photos
- [ ] Applied on both web and mobile EditImageGallery

### Part 4 — Copyright flagging
- [ ] recipe_flags table created
- [ ] "Potentially copyrighted" pill in recipe flag UI (web + mobile)
- [ ] Copyright flag → immediate private + locked
- [ ] Banner shown to recipe owner during review
- [ ] Thank-you shown to flagger
- [ ] recipes_flagged_count incremented on flagger profile
- [ ] /admin/copyright page with Approve/Remove/Dismiss actions
- [ ] Flagger reputation shown (🚩 N total flags)
- [ ] Admin decisions send DMs to both owner and flagger
- [ ] 30-day appeal window documented in removal DM
- [ ] Visibility lock enforced while copyright_review_pending = true

### General
- [ ] Migration 038 applied to RPi5 + PostgREST restarted
- [ ] feature-registry.md updated
- [ ] tsc --noEmit passes both apps
- [ ] Deployed to RPi5
- [ ] Backfill scripts run (step rewrite + image generation for crawl recipes)
- [ ] Run /wrapup
- [ ] At the end recap: how many steps rewritten, how many images
      generated, what was left incomplete and why.
