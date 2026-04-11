-- 026: Onboarding help bubbles
ALTER TABLE user_profiles
  ADD COLUMN IF NOT EXISTS onboarding_enabled BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS onboarding_completed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS onboarding_seen_pages TEXT[] DEFAULT '{}';
