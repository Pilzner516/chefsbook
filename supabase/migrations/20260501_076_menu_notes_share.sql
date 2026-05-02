-- Migration 076: Split menu notes into public/private + add source_menu_id for share tracking
-- Session: MENU-07

-- PART 4: Split notes column into public_notes and private_notes
ALTER TABLE menus RENAME COLUMN notes TO private_notes;
ALTER TABLE menus ADD COLUMN IF NOT EXISTS public_notes TEXT;

-- PART 5: Add source_menu_id for tracking shared menu provenance
ALTER TABLE menus
  ADD COLUMN IF NOT EXISTS source_menu_id UUID REFERENCES menus(id) ON DELETE SET NULL;

-- Index for efficient "already saved" lookups
CREATE INDEX IF NOT EXISTS idx_menus_source_menu_id ON menus(source_menu_id) WHERE source_menu_id IS NOT NULL;
