-- Add language and unit preferences to user_profiles
ALTER TABLE user_profiles
  ADD COLUMN IF NOT EXISTS preferred_language text DEFAULT 'en',
  ADD COLUMN IF NOT EXISTS preferred_units text DEFAULT 'imperial';
