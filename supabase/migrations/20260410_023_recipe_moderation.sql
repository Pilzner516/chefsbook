-- Migration 023: Recipe AI content moderation

-- Moderation status enum
DO $$ BEGIN
  CREATE TYPE recipe_moderation_status AS ENUM
    ('clean', 'flagged_mild', 'flagged_serious', 'approved', 'rejected');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Moderation columns on recipes
ALTER TABLE recipes
  ADD COLUMN IF NOT EXISTS moderation_status TEXT DEFAULT 'clean',
  ADD COLUMN IF NOT EXISTS moderation_flag_reason TEXT,
  ADD COLUMN IF NOT EXISTS moderation_flagged_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS moderation_reviewed_by UUID REFERENCES user_profiles(id),
  ADD COLUMN IF NOT EXISTS moderation_reviewed_at TIMESTAMPTZ;

-- Account freeze columns on user_profiles
ALTER TABLE user_profiles
  ADD COLUMN IF NOT EXISTS recipes_frozen BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS recipes_frozen_reason TEXT,
  ADD COLUMN IF NOT EXISTS recipes_frozen_at TIMESTAMPTZ;

-- Index for admin dashboard queries
CREATE INDEX IF NOT EXISTS idx_recipes_moderation ON recipes(moderation_status)
  WHERE moderation_status != 'clean';
