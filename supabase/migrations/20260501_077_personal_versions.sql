-- Migration 077: Personal versions + recipe modifiers
-- Allows users to save up to 2 personal versions of saved public recipes

-- Add personal version columns to recipes table
ALTER TABLE recipes
  ADD COLUMN IF NOT EXISTS is_personal_version BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS personal_version_of UUID REFERENCES recipes(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS personal_version_slot INTEGER CHECK (personal_version_slot IN (1, 2));

-- Index for fetching personal versions of a recipe by owner
CREATE INDEX IF NOT EXISTS idx_recipes_personal_version_of
  ON recipes(personal_version_of, user_id)
  WHERE is_personal_version = TRUE;

-- Ensure max 2 personal versions per user per original recipe
CREATE UNIQUE INDEX IF NOT EXISTS idx_recipes_personal_version_slot
  ON recipes(personal_version_of, user_id, personal_version_slot)
  WHERE is_personal_version = TRUE;

-- recipe_modifiers: tracks who has created a personal version of a recipe
-- Used to render the modifier pill row on the original recipe
CREATE TABLE IF NOT EXISTS recipe_modifiers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recipe_id UUID NOT NULL REFERENCES recipes(id) ON DELETE CASCADE,
  modifier_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  modifier_username TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(recipe_id, modifier_user_id)
);

CREATE INDEX IF NOT EXISTS idx_recipe_modifiers_recipe_id
  ON recipe_modifiers(recipe_id, created_at);

ALTER TABLE recipe_modifiers ENABLE ROW LEVEL SECURITY;

-- Anyone can read modifier pills (they display on public recipe pages)
CREATE POLICY "Public read recipe_modifiers"
  ON recipe_modifiers FOR SELECT USING (TRUE);

-- Only the modifier themselves can insert/delete their own row
CREATE POLICY "Modifier owns their row"
  ON recipe_modifiers FOR ALL USING (modifier_user_id = auth.uid());
