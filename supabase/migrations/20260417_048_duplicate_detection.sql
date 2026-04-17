-- Migration 048: Duplicate detection + canonical recipe system

-- Duplicate detection fields on recipes
ALTER TABLE recipes
  ADD COLUMN IF NOT EXISTS duplicate_of UUID REFERENCES recipes(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS is_canonical BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS duplicate_checked_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS source_url_normalized TEXT;

-- Index for fast URL-based duplicate lookup
CREATE INDEX IF NOT EXISTS recipes_source_url_normalized_idx
  ON recipes (source_url_normalized)
  WHERE source_url_normalized IS NOT NULL;

-- Index for finding all duplicates of a canonical recipe
CREATE INDEX IF NOT EXISTS recipes_duplicate_of_idx
  ON recipes (duplicate_of)
  WHERE duplicate_of IS NOT NULL;

-- pg_trgm extension for fuzzy title matching (if not already enabled)
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Index for fuzzy title similarity search
CREATE INDEX IF NOT EXISTS recipes_title_trgm_idx
  ON recipes USING gin (title gin_trgm_ops);
