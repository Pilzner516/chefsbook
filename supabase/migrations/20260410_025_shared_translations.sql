-- Migration 025: Shared recipe translations
-- Translations are shared across all users — one per recipe per language.
-- Schema already has no user_id column and correct UNIQUE(recipe_id, language).
-- Just need to open RLS so any user can read translations.

-- Drop owner-scoped RLS policies
DROP POLICY IF EXISTS "Users can read own recipe translations" ON recipe_translations;
DROP POLICY IF EXISTS "Users can insert own recipe translations" ON recipe_translations;
DROP POLICY IF EXISTS "Users can update own recipe translations" ON recipe_translations;
DROP POLICY IF EXISTS "Users can delete own recipe translations" ON recipe_translations;

-- Public read — translations are shared data
CREATE POLICY "Anyone can read recipe translations"
  ON recipe_translations FOR SELECT
  USING (true);

-- Authenticated users can write translations
CREATE POLICY "Authenticated users can insert translations"
  ON recipe_translations FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can update translations"
  ON recipe_translations FOR UPDATE
  USING (auth.uid() IS NOT NULL);

-- Delete: any authenticated user can delete (for cache invalidation on edit)
CREATE POLICY "Authenticated users can delete translations"
  ON recipe_translations FOR DELETE
  USING (auth.uid() IS NOT NULL);
