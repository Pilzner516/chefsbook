-- Migration 063: Add book_layout JSONB column to printed_cookbooks
-- This column stores the complete structured book layout for the new visual editor.
-- The existing columns (recipe_ids, selected_image_urls, foreword, cover_image_url)
-- remain for backward compatibility with the old wizard.

ALTER TABLE printed_cookbooks
  ADD COLUMN IF NOT EXISTS book_layout JSONB;

COMMENT ON COLUMN printed_cookbooks.book_layout IS
  'Full structured book layout for the visual canvas editor. See TypeScript BookLayout type in apps/web/lib/book-layout.ts';

-- Add index for querying cookbooks with book_layout
CREATE INDEX IF NOT EXISTS idx_printed_cookbooks_has_layout
  ON printed_cookbooks ((book_layout IS NOT NULL));
