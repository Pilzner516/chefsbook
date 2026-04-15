# ChefsBook — Session 55: Shared Recipe Translations
# Source: Cost optimisation — translate once per recipe per language, shared across all users
# Target: packages/db + apps/mobile + apps/web

---

## CONTEXT

The `recipe_translations` table currently stores translations scoped per user,
meaning the same recipe gets translated multiple times — once per user who views
it in a non-English language. This session makes translations shared across all
users: one translation per recipe per language, forever.

Read .claude/agents/testing.md and .claude/agents/deployment.md before starting.
Run `\d recipe_translations` on RPi5 first to confirm the current schema.

---

## STEP 1 — Check current schema

```bash
ssh rasp@rpi5-eth
cd /mnt/chefsbook/supabase
docker compose exec db psql -U postgres -d postgres -c "\d recipe_translations"
```

Check if there is a `user_id` column or if the UNIQUE constraint includes user_id.

---

## STEP 2 — Migration

Migration `025_shared_translations.sql`:

```sql
-- Remove user_id from recipe_translations if it exists
ALTER TABLE recipe_translations DROP COLUMN IF EXISTS user_id;

-- Drop old unique constraint if it included user_id
ALTER TABLE recipe_translations
  DROP CONSTRAINT IF EXISTS recipe_translations_recipe_id_language_user_id_key;

-- Add correct unique constraint: one translation per recipe per language
ALTER TABLE recipe_translations
  DROP CONSTRAINT IF EXISTS recipe_translations_recipe_id_language_key;

ALTER TABLE recipe_translations
  ADD CONSTRAINT recipe_translations_recipe_id_language_key
  UNIQUE (recipe_id, language);

-- Update RLS: anyone can read translations (they're shared public data)
DROP POLICY IF EXISTS "Users can read own recipe translations" ON recipe_translations;
DROP POLICY IF EXISTS "Users can insert own recipe translations" ON recipe_translations;
DROP POLICY IF EXISTS "Users can update own recipe translations" ON recipe_translations;

CREATE POLICY "Anyone can read recipe translations"
  ON recipe_translations FOR SELECT
  USING (true);

CREATE POLICY "Authenticated users can insert translations"
  ON recipe_translations FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can update translations"
  ON recipe_translations FOR UPDATE
  USING (auth.uid() IS NOT NULL);
```

Apply to RPi5:
```bash
docker compose exec db psql -U postgres -d postgres \
  -f /path/to/025_shared_translations.sql
```

Or run each statement directly via psql.

---

## STEP 3 — Update getRecipeTranslation() and saveRecipeTranslation()

In `packages/db`, update the translation functions to remove any user_id scoping:

```ts
// Get shared translation for any user
export async function getRecipeTranslation(
  recipeId: string,
  language: string
): Promise<RecipeTranslation | null> {
  const { data } = await supabase
    .from('recipe_translations')
    .select('*')
    .eq('recipe_id', recipeId)
    .eq('language', language)
    .single();
  return data;
}

// Save shared translation (no user_id)
export async function saveRecipeTranslation(
  recipeId: string,
  language: string,
  translation: TranslatedRecipe
): Promise<void> {
  await supabase
    .from('recipe_translations')
    .upsert({
      recipe_id: recipeId,
      language,
      translated_title: translation.title,
      translated_description: translation.description,
      translated_ingredients: translation.ingredients,
      translated_steps: translation.steps,
      translated_notes: translation.notes,
      updated_at: new Date().toISOString()
    }, {
      onConflict: 'recipe_id,language'
    });
}
```

---

## STEP 4 — Cache invalidation on recipe edit

When a recipe's ingredients or steps are edited, delete ALL language translations
for that recipe (they'll be regenerated on next view in any language):

```ts
// In packages/db, update the recipe edit function:
export async function invalidateRecipeTranslations(recipeId: string) {
  await supabase
    .from('recipe_translations')
    .delete()
    .eq('recipe_id', recipeId);
}
```

Call this whenever `ingredients` or `steps` are updated on a recipe —
both on mobile (recipeStore editRecipe action) and web (recipe edit save).

---

## STEP 5 — Clean up existing data

Delete any existing translations that have user_id references or duplicates:
```sql
-- After migration, clean up any duplicate translations
-- (keep most recent per recipe+language):
DELETE FROM recipe_translations a
USING recipe_translations b
WHERE a.recipe_id = b.recipe_id
  AND a.language = b.language
  AND a.updated_at < b.updated_at;
```

---

## TESTING

Verify the migration worked:
```bash
docker compose exec db psql -U postgres -d postgres -c \
  "SELECT recipe_id, language, updated_at FROM recipe_translations LIMIT 10;"
```

Verify translations are shared — open a recipe in French as one user, then
confirm the translation row exists and would be served to any other user
viewing the same recipe in French.

---

## DEPLOYMENT

```bash
ssh rasp@rpi5-eth
cd /mnt/chefsbook/repo
git pull
cd apps/web
npm run build 2>&1 | tail -20
pm2 restart chefsbook-web
```

---

## COMPLETION CHECKLIST

- [ ] Current schema confirmed via `\d recipe_translations`
- [ ] Migration 025 applied — user_id removed, UNIQUE on (recipe_id, language)
- [ ] RLS updated — anyone can read, authenticated can write
- [ ] `getRecipeTranslation()` has no user_id scope
- [ ] `saveRecipeTranslation()` uses upsert on (recipe_id, language)
- [ ] `invalidateRecipeTranslations()` called on recipe ingredient/step edits
- [ ] Duplicate translations cleaned up
- [ ] Existing translations still load correctly
- [ ] New translation generated once and served to all subsequent viewers
- [ ] Deployed to RPi5 and verified live
- [ ] Run /wrapup to update DONE.md and CLAUDE.md
