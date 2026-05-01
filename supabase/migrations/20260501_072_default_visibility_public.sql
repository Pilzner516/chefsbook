-- Migration: Change default_visibility to 'public' (was 'private')
-- Users who want privacy must explicitly opt-in via settings

-- Change the column default from 'private' to 'public'
ALTER TABLE user_profiles
  ALTER COLUMN default_visibility SET DEFAULT 'public'::visibility_level;

-- Update existing users to 'public' (they haven't explicitly chosen private)
UPDATE user_profiles
  SET default_visibility = 'public'::visibility_level
  WHERE default_visibility = 'private'::visibility_level;
