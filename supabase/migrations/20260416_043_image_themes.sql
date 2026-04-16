-- Migration 043: AI image themes, source image descriptions, regeneration tracking
-- Session 161: image themes + better prompts + regeneration pills

-- Store source image info for better AI generation prompts
ALTER TABLE recipes
  ADD COLUMN IF NOT EXISTS source_image_url TEXT,
  ADD COLUMN IF NOT EXISTS source_image_description TEXT;

-- User theme preference + admin quality override
ALTER TABLE user_profiles
  ADD COLUMN IF NOT EXISTS image_theme TEXT DEFAULT 'bright_fresh',
  ADD COLUMN IF NOT EXISTS image_quality_override TEXT DEFAULT NULL;

-- Regeneration tracking per photo
ALTER TABLE recipe_user_photos
  ADD COLUMN IF NOT EXISTS regen_count INT DEFAULT 0;
