-- Migration 044: track image generation start time for stuck-state detection
-- Session 165

ALTER TABLE recipes
  ADD COLUMN IF NOT EXISTS image_generation_started_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_recipes_image_gen_stuck
  ON recipes (image_generation_started_at)
  WHERE image_generation_status IN ('pending', 'generating');
