-- Migration 034: Add is_title_only flag to recipe_translations
ALTER TABLE recipe_translations ADD COLUMN IF NOT EXISTS is_title_only BOOLEAN DEFAULT false;
