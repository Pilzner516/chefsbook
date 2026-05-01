-- Add is_inspired_by_menu flag to recipes
-- Distinguishes restaurant-scan reconstructions from imported or user-entered recipes

ALTER TABLE recipes
  ADD COLUMN IF NOT EXISTS is_inspired_by_menu BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN recipes.is_inspired_by_menu IS 'True for recipes generated from restaurant menu scans';
