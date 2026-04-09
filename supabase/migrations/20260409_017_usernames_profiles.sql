-- 017: Usernames, profile fields, and recipe attribution
-- Session 28: Foundation for social features

-- Add username and profile fields to user_profiles
ALTER TABLE user_profiles
  ADD COLUMN IF NOT EXISTS username TEXT UNIQUE,
  ADD COLUMN IF NOT EXISTS bio TEXT,
  ADD COLUMN IF NOT EXISTS is_searchable BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS avatar_url TEXT,
  ADD COLUMN IF NOT EXISTS follower_count INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS following_count INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS recipe_count INTEGER DEFAULT 0;

-- Username index for fast search
CREATE UNIQUE INDEX IF NOT EXISTS idx_user_profiles_username
  ON user_profiles (lower(username));

-- Username validation: lowercase letters, numbers, underscores, 3-20 chars
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'username_format'
  ) THEN
    ALTER TABLE user_profiles
      ADD CONSTRAINT username_format
      CHECK (username IS NULL OR username ~ '^[a-z0-9_]{3,20}$');
  END IF;
END $$;

-- Recipe attribution columns
ALTER TABLE recipes
  ADD COLUMN IF NOT EXISTS original_submitter_id UUID REFERENCES user_profiles(id),
  ADD COLUMN IF NOT EXISTS original_submitter_username TEXT,
  ADD COLUMN IF NOT EXISTS shared_by_id UUID REFERENCES user_profiles(id),
  ADD COLUMN IF NOT EXISTS shared_by_username TEXT;
