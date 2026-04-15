# ChefsBook — Session 125: Wire Recipe Translation End-to-End
# Source: Language switching only translates menu, not recipe content
# Target: apps/web + apps/mobile + packages/ai + packages/db

---

## CONTEXT

Read CLAUDE.md, DONE.md, feature-registry.md, ai-cost.md, and ALL
mandatory agents per SESSION START sequence before touching anything.

Translation uses Claude Sonnet (~$0.011/recipe/language for full recipe,
~$0.002/recipe for title only). All translations are cached in
recipe_translations table — charged once per recipe per language, free
for all subsequent views.

There are TWO translation tiers to implement:

TIER 1 — Title-only translation (on import)
- Happens immediately when a recipe is imported/created
- Translates ONLY the title into all 4 non-English languages
- Stored in recipe_translations with a flag indicating title-only
- Powers the recipe list/grid so titles show in user's language
- Cost: ~$0.002 per recipe (4 languages × tiny prompt)

TIER 2 — Full recipe translation (on recipe detail open)
- Happens lazily when a user opens a recipe detail page
- Translates title + description + ingredients + steps + notes
- Only triggers if no full translation exists for that language yet
- Shows "Hang tight..." message while translating
- Cached forever after for all users
- Cost: ~$0.011 per recipe per language

---

## STEP 1 — Update recipe_translations schema

Check the current recipe_translations table:
```sql
\d recipe_translations;
```

Add a column to distinguish title-only vs full translations:
```sql
ALTER TABLE recipe_translations
  ADD COLUMN IF NOT EXISTS is_title_only BOOLEAN DEFAULT false;
```

A full translation (is_title_only = false) supersedes a title-only
translation for the same recipe + language.

---

## STEP 2 — Create translateRecipeTitle() in packages/ai

Add a new function alongside translateRecipe():

```typescript
// Translates only the title into all 4 non-English languages
// Returns: { fr: '...', es: '...', it: '...', de: '...' }
export async function translateRecipeTitle(
  title: string
): Promise<Record<string, string>>
```

Use HAIKU model (not Sonnet — titles are short, Haiku is sufficient):
- Single API call with all 4 languages requested at once
- Return as JSON object
- Cost: ~$0.0002 per recipe total (very cheap)

Prompt pattern:
"Translate this recipe title into French, Spanish, Italian, and German.
Return ONLY a JSON object with keys fr, es, it, de and translated titles
as values. Title: '{title}'"

---

## STEP 3 — Call translateRecipeTitle() on every recipe import

In packages/db or the import API route, after every successful recipe
creation (addRecipe), call translateRecipeTitle() and save results:

For each language (fr, es, it, de):
- Upsert into recipe_translations:
  - recipe_id, language, translated_title, is_title_only = true
  - Only insert if no existing translation for this recipe + language

This runs in the background — do not await it in the user-facing flow.
Use a fire-and-forget pattern so it doesn't slow down import.

Apply to ALL import paths:
- URL import
- Photo scan
- Speak a recipe
- Manual recipe creation
- Instagram import
- File import

---

## STEP 4 — Recipe list shows translated titles

In the recipe list/grid on web and mobile:

When user's language ≠ 'en':
- For each recipe card, check recipe_translations for that language
- If a translation exists (title-only or full): show translated_title
- If no translation exists: show original title (fallback)
- Do NOT call AI for missing titles in the list view — just show original
  as fallback, the import process handles pre-translation going forward

This requires batch-fetching translated titles for all visible recipes.
Add a helper: getBatchTranslatedTitles(recipeIds, language) that returns
a map of recipeId → translated_title.

---

## STEP 5 — Recipe detail: full translation on open

In the recipe detail page (web + mobile):

When user's language ≠ 'en':

1. Check recipe_translations for a FULL translation (is_title_only = false)
   for this recipe + language
2. If full translation exists: display translated content immediately
3. If only title-only translation exists OR no translation at all:
   - Display original content immediately (do not block render)
   - Show a friendly banner/message at the top of the ingredients section:

   Web: amber/cream pill or banner:
   "🍳 Hang tight — we're translating this recipe for you..."
   with a subtle spinner

   Mobile: same banner below the recipe header

4. In the background: call /api/recipes/translate (server-side route
   that calls translateRecipe() via Claude Sonnet)
5. When translation completes:
   - Save to recipe_translations (is_title_only = false)
   - Update the displayed content without page reload (replace original
     with translated content in state)
   - Remove the "Hang tight" banner
   - Show a subtle "✓ Translated to [Language]" confirmation for 3 seconds

6. If translation fails: hide the banner, show original content,
   do not show an error (fail silently for the user)

---

## STEP 6 — Backfill titles for existing 69 recipes

Run title translation for all existing recipes that don't have
translations yet:

```typescript
// In a one-time script or migration
// Get all recipes without any translation
const untranslated = await supabaseAdmin
  .from('recipes')
  .select('id, title')
  .not('id', 'in', 
    supabaseAdmin.from('recipe_translations').select('recipe_id')
  )

// For each: translateRecipeTitle() and save
// Rate limit: 1 per second to avoid API limits
```

Run this as a standalone script:
`node scripts/backfill-translations.js`

The script should log progress and be resumable if interrupted.

---

## STEP 7 — English always shows original

Add a guard at the top of all translation logic:
```typescript
if (language === 'en' || !language) return // always show original
```

Never call the translation API for English.
Never store English translations (waste of money and storage).

---

## DEPLOYMENT

```bash
ssh rasp@rpi5-eth
cd /mnt/chefsbook/repo
git pull
cd apps/web
rm -rf node_modules/react node_modules/react-dom .next
NODE_OPTIONS=--max-old-space-size=1024 npm run build 2>&1 | tail -20
pm2 restart chefsbook-web
```

Only restart PM2 if build exits with code 0.

Run the backfill script after deployment:
```bash
cd /mnt/chefsbook/repo
node scripts/backfill-translations.js
```

---

## COMPLETION CHECKLIST

- [ ] recipe_translations: is_title_only column added
- [ ] translateRecipeTitle() function using HAIKU model (all 4 languages in one call)
- [ ] Title translation fires on every recipe import (fire-and-forget)
- [ ] All 6 import paths trigger title translation
- [ ] Recipe list shows translated titles when language ≠ en
- [ ] getBatchTranslatedTitles() helper fetches titles efficiently
- [ ] Recipe detail: checks for full translation on open
- [ ] "Hang tight, we're translating this recipe..." banner shows during translation
- [ ] Banner has spinner, disappears when translation completes
- [ ] Translated content replaces original without page reload
- [ ] "✓ Translated" confirmation shows briefly after completion
- [ ] Silent fail if translation errors — original content shown
- [ ] English always shows original, never calls translation API
- [ ] Backfill script created and run for existing 69 recipes
- [ ] Backfill confirmed: recipe_translations has title-only rows for existing recipes
- [ ] ai-cost.md updated with translateRecipeTitle() entry (HAIKU, ~$0.0002)
- [ ] feature-registry.md updated
- [ ] tsc --noEmit passes both apps
- [ ] Deployed to RPi5
- [ ] Run /wrapup
- [ ] At the end of the session, recap exactly what was completed from
      this prompt, what was left incomplete, and why.
