-- Migration 013: Import pipeline fields + meal plan sync tracking
-- Area 1E: import_status, missing_sections, aichef_assisted, source_author
-- Area 2C: meal plan sync tracking columns

-- Recipe import pipeline fields
ALTER TABLE recipes
  ADD COLUMN IF NOT EXISTS import_status text DEFAULT 'complete',
  ADD COLUMN IF NOT EXISTS missing_sections text[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS aichef_assisted boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS source_author text;

-- Meal plan sync tracking
ALTER TABLE meal_plans
  ADD COLUMN IF NOT EXISTS synced_to_list_id uuid REFERENCES shopping_lists(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS synced_at timestamptz,
  ADD COLUMN IF NOT EXISTS synced_ingredients_hash text;
