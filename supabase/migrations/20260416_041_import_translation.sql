-- Migration 041: Import-time translation support
-- Session 152 — translate non-English recipes at import time

ALTER TABLE recipes
  ADD COLUMN IF NOT EXISTS source_language TEXT,
  ADD COLUMN IF NOT EXISTS translated_from TEXT;
