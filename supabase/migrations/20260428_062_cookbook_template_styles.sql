-- Migration: Add new cookbook template styles
-- Adds heritage, nordic, and spice templates to the cover_style check constraint

-- Drop and recreate the check constraint with new values
ALTER TABLE printed_cookbooks
  DROP CONSTRAINT IF EXISTS printed_cookbooks_cover_style_check;

ALTER TABLE printed_cookbooks
  ADD CONSTRAINT printed_cookbooks_cover_style_check
  CHECK (cover_style IN ('classic', 'modern', 'minimal', 'heritage', 'nordic', 'spice'));
