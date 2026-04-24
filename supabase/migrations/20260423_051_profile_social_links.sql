-- Migration: Add social links and location to user_profiles
-- Part of Prompt W: Chef Public Profiles + Badge System

ALTER TABLE user_profiles
ADD COLUMN IF NOT EXISTS instagram_url TEXT DEFAULT NULL,
ADD COLUMN IF NOT EXISTS website_url TEXT DEFAULT NULL,
ADD COLUMN IF NOT EXISTS location TEXT DEFAULT NULL;

COMMENT ON COLUMN user_profiles.instagram_url IS 'Instagram handle or full URL';
COMMENT ON COLUMN user_profiles.website_url IS 'Personal website URL';
COMMENT ON COLUMN user_profiles.location IS 'Location text (e.g. Paris, France)';
