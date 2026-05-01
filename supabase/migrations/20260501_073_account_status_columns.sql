-- 073: Add account status columns to user_profiles for suspend/expel system

-- Add columns for account status system (values: 'active', 'suspended', 'expelled')
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS account_status TEXT DEFAULT 'active';
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS pre_suspension_plan plan_tier;
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS status_changed_at TIMESTAMPTZ;
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS status_changed_by UUID REFERENCES user_profiles(id);
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS status_reason TEXT;

-- Activity tracking columns
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS last_seen_at TIMESTAMPTZ;
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS login_count INTEGER DEFAULT 0;

-- Migrate existing is_suspended to account_status
UPDATE user_profiles SET account_status = 'suspended' WHERE is_suspended = true AND account_status = 'active';

-- Index for quick lookups of suspended/expelled users
CREATE INDEX IF NOT EXISTS idx_user_profiles_account_status ON user_profiles(account_status) WHERE account_status != 'active';
