-- Instagram Export Import: dedupe column for tracking which posts have been imported
-- Migration 067: 2026-04-30

-- Add column for storing the original Instagram post URI (used for deduplication)
ALTER TABLE recipes
  ADD COLUMN IF NOT EXISTS source_instagram_uri TEXT;

-- Index for fast lookup during batch import dedup check
CREATE INDEX IF NOT EXISTS idx_recipes_source_instagram_uri
  ON recipes (source_instagram_uri)
  WHERE source_instagram_uri IS NOT NULL;

-- Note: source_type is a plain TEXT column with no CHECK constraint
-- so 'instagram_export' can be used as a value without schema changes
