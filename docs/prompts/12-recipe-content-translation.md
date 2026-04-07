# ChefsBook — Session: Recipe Content Translation
# Source: Post QA review — language selector follow-up
# Target: apps/mobile + apps/web + @chefsbook/ai + packages/db

---

## CONTEXT

The i18n system built in session 08 correctly translates UI labels and chrome (buttons, section
headers, nav items). However the actual recipe content — ingredient names, step instructions,
notes — is stored in the database in its original language and does not change when the user
switches language.

This session adds dynamic recipe content translation via the Claude API. This is a separate
system from i18n — it translates database content, not UI strings.

Read CLAUDE.md before starting. This touches @chefsbook/ai, packages/db, and both apps.

---

## ARCHITECTURE DECISION

**Do not re-translate every time the user opens a recipe.** That would be slow and expensive.
Instead, cache translations in the database per recipe per language.

### DB schema

Create `packages/db/migrations/016_recipe_translations.sql`:

```sql
CREATE TABLE IF NOT EXISTS recipe_translations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recipe_id UUID NOT NULL REFERENCES recipes(id) ON DELETE CASCADE,
  language TEXT NOT NULL,                    -- 'fr', 'es', 'it', 'de'
  translated_title TEXT,
  translated_description TEXT,
  translated_ingredients JSONB,              -- same structure as recipes.ingredients
  translated_steps JSONB,                    -- same structure as recipes.steps
  translated_notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(recipe_id, language)
);

ALTER TABLE recipe_translations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own recipe translations"
  ON recipe_translations FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM recipes
      WHERE recipes.id = recipe_translations.recipe_id
      AND recipes.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert own recipe translations"
  ON recipe_translations FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM recipes
      WHERE recipes.id = recipe_translations.recipe_id
      AND recipes.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update own recipe translations"
  ON recipe_translations FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM recipes
      WHERE recipes.id = recipe_translations.recipe_id
      AND recipes.user_id = auth.uid()
    )
  );
```

Apply migration to RPi5:
```
ssh rasp@rpi5-eth
cd /mnt/chefsbook/supabase
docker compose exec db psql -U postgres -d postgres -f /path/to/016_recipe_translations.sql
```

---

## TRANSLATION FUNCTION — @chefsbook/ai

Add `translateRecipe()` to `@chefsbook/ai`:

```ts
export async function translateRecipe(
  recipe: {
    title: string;
    description?: string;
    ingredients: Ingredient[];
    steps: Step[];
    notes?: string;
  },
  targetLanguage: string  // 'fr' | 'es' | 'it' | 'de'
): Promise<TranslatedRecipe>
```

Claude prompt:
```
You are a professional culinary translator. Translate the following recipe into ${languageName}.

Rules:
- Translate ingredient names, quantities stay as numbers
- Translate all step instructions naturally — preserve cooking technique terminology
- Translate description and notes if present
- Keep proper nouns (brand names, specific cheese names like "Parmigiano-Reggiano") in original
- Return ONLY valid JSON in exactly this structure, no other text:
{
  "title": "...",
  "description": "...",
  "ingredients": [{ "quantity": "...", "unit": "...", "name": "...", "notes": "..." }],
  "steps": [{ "instruction": "..." }],
  "notes": "..."
}

Recipe to translate:
${JSON.stringify(recipe)}
```

Language name map:
```ts
const LANGUAGE_NAMES: Record<string, string> = {
  fr: 'French',
  es: 'Spanish',
  it: 'Italian',
  de: 'German',
};
```

Use `claude-sonnet-4` (not opus — cost vs quality is fine for translation).
`max_tokens: 4000` to handle long recipes.

---

## DATA LAYER — packages/db

Add these functions to `@chefsbook/db`:

```ts
// Check if translation exists for this recipe + language
getRecipeTranslation(recipeId: string, language: string): Promise<RecipeTranslation | null>

// Save a translation returned from Claude
saveRecipeTranslation(recipeId: string, language: string, translation: TranslatedRecipe): Promise<void>
```

---

## MOBILE INTEGRATION — apps/mobile

### Recipe detail screen

When a recipe detail screen loads and the user's selected language is not `'en'`:

1. Check `recipe_translations` for an existing translation via `getRecipeTranslation()`.
2. **If translation exists:** render the translated content immediately. No API call needed.
3. **If no translation exists:**
   - Render the original content first (no blocking).
   - Show a subtle "Translating…" indicator (e.g. a small spinner or pill in the header).
   - Call `translateRecipe()` in the background.
   - On completion, save via `saveRecipeTranslation()` and re-render with translated content.
   - The indicator disappears when done.
4. **If language is `'en'`:** always render original content directly — never translate to English
   (it's the source language).

### What gets translated

- Recipe title
- Description
- All ingredient names (quantities and units stay as-is)
- All step instructions
- Notes

### What does NOT get translated

- Tags (keep original)
- Cuisine label (keep original)
- Course label (keep original)
- User-entered cooking notes (separate from recipe notes — these are the user's own annotations)

### Language switching mid-session

When the user changes language while a recipe detail is open:
- If a translation already exists in DB → switch immediately.
- If not → show "Translating…" and fetch in background.
- Switching back to English → show original content immediately.

---

## WEB INTEGRATION — apps/web

Apply the same logic to the recipe detail page in `apps/web`:

1. On recipe detail page load, check user's language preference from `user_profiles`.
2. If not English, check `recipe_translations` — use cached if available, fetch if not.
3. Show a subtle "Translating…" state while waiting.
4. Same fields translated, same fields excluded.

---

## COST CONSIDERATION

Translation is triggered once per recipe per language and then cached forever (until the recipe
is edited, which should invalidate the cache). A typical recipe is ~500–800 tokens input +
~600–1000 tokens output. At Claude Sonnet pricing this is negligible per translation.

Add a note in CLAUDE.md: "Recipe translations are cached in recipe_translations table —
re-translation is only needed if the recipe content changes."

**Cache invalidation:** When a recipe is edited (ingredients or steps changed), delete its
translations:
```ts
// In the recipe update function in @chefsbook/db:
await supabase
  .from('recipe_translations')
  .delete()
  .eq('recipe_id', recipeId)
```
This forces a fresh translation on next view in a non-English language.

---

## COMPLETION CHECKLIST

- [ ] Migration 016 created and applied to RPi5
- [ ] `translateRecipe()` added to `@chefsbook/ai` with correct Claude prompt
- [ ] `getRecipeTranslation()` and `saveRecipeTranslation()` added to `@chefsbook/db`
- [ ] Mobile recipe detail: checks cache → renders original → translates in background → re-renders
- [ ] Mobile: "Translating…" indicator shown during background fetch
- [ ] Mobile: language switch on open detail triggers translation if not cached
- [ ] Mobile: English always shows original content (no translation call)
- [ ] Web recipe detail: same cache-check and background translation logic
- [ ] Cache invalidated when recipe ingredients or steps are edited
- [ ] Note added to CLAUDE.md about translation caching
- [ ] No regressions in recipe detail rendering for English users
- [ ] Run `/wrapup` to update DONE.md and CLAUDE.md
