# ChefsBook — Session 150: Delete Crawl Recipes + Fix Import Translation
# Source: Crawl recipes imported in wrong language, corrupting data and image generation
# Target: packages/ai + packages/db + apps/web + database

---

## CONTEXT

Read CLAUDE.md, DONE.md, feature-registry.md, import-pipeline.md,
and import-quality.md before touching anything.

Two problems to fix:

1. The 32 crawl recipes tagged "ChefsBook" were imported in their
   source language (French, Italian, Spanish etc.) instead of the
   user's language (English). This corrupted ingredients, steps,
   and descriptions, and caused AI image generation to produce
   wrong images (spinach flan with fruit, peach tart instead of
   apple tart, etc.)

2. The import pipeline never translates full recipe content at
   import time — it only lazily translates titles for display.
   Full recipe content (title, description, ingredients, steps)
   must be translated into the user's language at import time
   before saving.

---

## PART 1 — Delete corrupted crawl recipes

### 1a — Delete all recipes tagged "ChefsBook"

These are the 32 test crawl recipes. They are corrupted and
should be deleted entirely.

```sql
-- First check what we're deleting
SELECT id, title, tags FROM recipes WHERE 'ChefsBook' = ANY(tags);

-- Delete associated data first
DELETE FROM recipe_user_photos
WHERE recipe_id IN (
  SELECT id FROM recipes WHERE 'ChefsBook' = ANY(tags)
);

DELETE FROM recipe_translations
WHERE recipe_id IN (
  SELECT id FROM recipes WHERE 'ChefsBook' = ANY(tags)
);

DELETE FROM recipe_flags
WHERE recipe_id IN (
  SELECT id FROM recipes WHERE 'ChefsBook' = ANY(tags)
);

DELETE FROM import_attempts
WHERE recipe_id IN (
  SELECT id FROM recipes WHERE 'ChefsBook' = ANY(tags)
);

-- Delete the recipes themselves
DELETE FROM recipes WHERE 'ChefsBook' = ANY(tags);

-- Verify
SELECT COUNT(*) FROM recipes WHERE 'ChefsBook' = ANY(tags);
-- Should return 0
```

Also delete the AI-generated images from Supabase storage:
All files in the recipe-user-photos/ai-generated/ bucket were
generated from these corrupted recipes and should be removed.

```sql
-- List the files to delete (for reference)
SELECT name FROM storage.objects
WHERE bucket_id = 'recipe-user-photos'
AND name LIKE 'ai-generated/%';
```

Use the Supabase admin API or storage dashboard to delete all
files in the ai-generated/ folder.

---

## PART 2 — Fix import pipeline: translate at import time

### 2a — Detect source language

Add detectLanguage() to packages/ai:

```typescript
// Uses HAIKU — ~$0.0001 per call
export async function detectLanguage(text: string): Promise<string> {
  // Use a simple heuristic first (cheap, no API call)
  // Check for common non-English characters
  const frenchChars = /[àâçéèêëîïôùûüÿæœ]/i
  const germanChars = /[äöüßÄÖÜ]/
  const italianChars = /[àèìîòù]/i
  const spanishChars = /[áéíóúñü¿¡]/i

  if (germanChars.test(text)) return 'de'
  if (frenchChars.test(text)) return 'fr'
  if (italianChars.test(text)) return 'it'
  if (spanishChars.test(text)) return 'es'

  // If unclear, use Claude Haiku to detect
  const response = await callClaude({
    model: HAIKU,
    prompt: `What language is this text written in? Reply with ONLY the 2-letter ISO code (en, fr, de, it, es, pt, nl, etc.): "${text.substring(0, 200)}"`,
    maxTokens: 10
  })
  return response.trim().toLowerCase().substring(0, 2)
}
```

### 2b — Translate full recipe at import time

Add translateRecipeToLanguage() to packages/ai:

```typescript
// Uses SONNET for quality translation — ~$0.003 per recipe
// Only called when source language !== user language
export async function translateRecipeToLanguage(
  recipe: RawRecipe,
  targetLanguage: string,  // e.g. 'en', 'fr', 'de'
  sourceLanguage: string
): Promise<RawRecipe> {
  if (sourceLanguage === targetLanguage) return recipe
  if (targetLanguage === 'en' && sourceLanguage === 'en') return recipe

  const languageNames: Record<string, string> = {
    en: 'English', fr: 'French', de: 'German',
    it: 'Italian', es: 'Spanish', pt: 'Portuguese',
    nl: 'Dutch', pl: 'Polish'
  }

  const targetName = languageNames[targetLanguage] ?? targetLanguage

  const prompt = `Translate this recipe from ${languageNames[sourceLanguage] ?? sourceLanguage} to ${targetName}.

Rules:
- Translate title, description, and all step text naturally
- For ingredients: translate the ingredient NAME only
- Keep all quantities and units in their standard ${targetName} form
  (e.g. "200g" stays "200g", "2 cups" stays "2 cups")
- Keep cooking temperatures, times, and measurements exact
- Preserve the recipe's character and voice
- Return ONLY valid JSON in exactly this structure:

{
  "title": "translated title",
  "description": "translated description",
  "ingredients": [
    { "amount": <number or null>, "unit": "unit", "name": "translated name", "notes": "translated notes" }
  ],
  "steps": ["translated step 1", "translated step 2"]
}

Recipe to translate:
Title: ${recipe.title}
Description: ${recipe.description}
Ingredients: ${JSON.stringify(recipe.ingredients)}
Steps: ${JSON.stringify(recipe.steps?.map(s => s.text || s))}`

  const response = await callClaude({
    model: SONNET,
    prompt,
    maxTokens: 4000
  })

  try {
    const cleaned = response.replace(/```json\n?|\n?```/g, '').trim()
    const translated = JSON.parse(cleaned)

    return {
      ...recipe,
      title: translated.title ?? recipe.title,
      description: translated.description ?? recipe.description,
      ingredients: translated.ingredients ?? recipe.ingredients,
      steps: translated.steps?.map((text: string, i: number) => ({
        ...(recipe.steps?.[i] ?? {}),
        text
      })) ?? recipe.steps,
      // Keep original language metadata
      source_language: sourceLanguage,
      translated_from: sourceLanguage,
    }
  } catch (err) {
    console.error('Translation parse failed:', err)
    return recipe  // Return original if translation fails
  }
}
```

### 2c — Wire into import pipeline

In packages/ai/src/importFromUrl.ts, after extracting the recipe
and before saving:

```typescript
// After successful extraction
const rawRecipe = extractedRecipe

// 1. Detect source language from title + first step
const sourceText = `${rawRecipe.title} ${rawRecipe.steps?.[0]?.text ?? ''}`
const sourceLanguage = await detectLanguage(sourceText)

// 2. Get user's preferred language (passed in from the API route)
const userLanguage = options.userLanguage ?? 'en'

// 3. Translate if needed
let finalRecipe = rawRecipe
if (sourceLanguage !== userLanguage) {
  console.log(`Translating from ${sourceLanguage} to ${userLanguage}...`)
  finalRecipe = await translateRecipeToLanguage(
    rawRecipe,
    userLanguage,
    sourceLanguage
  )
}

// 4. Store source language metadata on the recipe
finalRecipe.source_language = sourceLanguage
```

### 2d — Pass userLanguage through the import API

In apps/web/app/api/import/url/route.ts:

```typescript
// Get user's preferred language from their profile
const { data: userProfile } = await supabaseAdmin
  .from('user_profiles')
  .select('preferred_language')
  .eq('id', userId)
  .single()

const userLanguage = userProfile?.preferred_language ?? 'en'

// Pass to import function
const recipe = await importFromUrl(url, {
  userId,
  userLanguage,  // ADD THIS
  ...otherOptions
})
```

### 2e — Add source_language column to recipes

```sql
ALTER TABLE recipes
  ADD COLUMN IF NOT EXISTS source_language TEXT,
  ADD COLUMN IF NOT EXISTS translated_from TEXT;
```

Add to migration 039.

### 2f — Update Chrome extension to pass user language

In the extension, when calling the import API, include the user's
language preference:

```javascript
// Get stored language preference
const { userLanguage } = await chrome.storage.local.get('userLanguage')

const response = await fetch(`${API_BASE}/api/import/url`, {
  method: 'POST',
  headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
  body: JSON.stringify({
    url,
    userLanguage: userLanguage ?? 'en'
  })
})
```

Store the language when user changes it in the extension popup.

### 2g — Update image generation prompt to always use English

In the generateRecipeImage() function and the generate-recipe-images.mjs
script, ensure the prompt is ALWAYS constructed from English content.

Add a safety check:
```typescript
// Always generate image prompts in English
// If recipe is in another language, translate the key fields first
async function buildImagePrompt(recipe: Recipe): Promise<string> {
  let title = recipe.title
  let ingredients = recipe.ingredients ?? []

  // If recipe appears to be non-English, translate key fields
  const sourceLanguage = await detectLanguage(title)
  if (sourceLanguage !== 'en') {
    const translated = await translateRecipeToLanguage(
      { title, ingredients, steps: [], description: '' },
      'en',
      sourceLanguage
    )
    title = translated.title
    ingredients = translated.ingredients
  }

  const keyIngredients = ingredients
    .slice(0, 4)
    .map(i => i.name || i)
    .filter(Boolean)
    .join(', ')

  return `Professional food photography of ${title}, featuring ${keyIngredients}, editorial style, natural window light, shallow depth of field, appetizing presentation, high resolution, no text, no watermarks, no people, photorealistic`
}
```

---

## PART 3 — Update ai-cost.md

Add new entries:
- detectLanguage(): HAIKU, ~$0.0001/call (often free via heuristic)
- translateRecipeToLanguage(): SONNET, ~$0.003/recipe
- Both called only when source language ≠ user language

---

## DEPLOYMENT

```bash
ssh rasp@rpi5-eth

# Apply migration 039
docker exec -it supabase-db psql -U postgres -d postgres \
  -c "ALTER TABLE recipes ADD COLUMN IF NOT EXISTS source_language TEXT, ADD COLUMN IF NOT EXISTS translated_from TEXT;"
docker restart supabase-rest

cd /mnt/chefsbook/repo
git pull
cd apps/web
rm -rf node_modules/react node_modules/react-dom .next
NODE_OPTIONS=--max-old-space-size=1536 npm run build 2>&1 | tail -20
pm2 restart chefsbook-web
```

---

## COMPLETION CHECKLIST

### Part 1 — Delete crawl recipes
- [ ] All 32 ChefsBook-tagged recipes deleted from DB
- [ ] Associated photos, translations, flags, import_attempts deleted
- [ ] AI-generated images deleted from storage bucket
- [ ] Verify: SELECT COUNT(*) FROM recipes WHERE 'ChefsBook' = ANY(tags) = 0

### Part 2 — Translation at import time
- [ ] detectLanguage() in packages/ai (heuristic first, Haiku fallback)
- [ ] translateRecipeToLanguage() in packages/ai using SONNET
- [ ] Wire into importFromUrl() — detect language, translate if needed
- [ ] userLanguage passed from API route (read from user_profiles)
- [ ] source_language and translated_from columns added to recipes
- [ ] Extension passes userLanguage in import request
- [ ] buildImagePrompt() always uses English content
- [ ] ai-cost.md updated with new functions

### General
- [ ] Migration 039 applied + PostgREST restarted
- [ ] feature-registry.md updated
- [ ] import-quality.md updated
- [ ] tsc --noEmit passes both apps
- [ ] Deployed to RPi5
- [ ] Run /wrapup
- [ ] At the end recap: recipes deleted, translation pipeline wired,
      test one import from a non-English site to confirm it comes
      through in English correctly.
