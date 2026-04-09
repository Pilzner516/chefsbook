-- 018: Plan tiers + promo codes + family members

-- Update plan_tier to include 'chef' (add as allowed value if using text column)
-- Note: plan_tier is a TEXT column, not an enum — values enforced at app level

-- Add plan fields
ALTER TABLE user_profiles
  ADD COLUMN IF NOT EXISTS plan_expires_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS plan_billing_cycle TEXT DEFAULT 'monthly',
  ADD COLUMN IF NOT EXISTS promo_code_used TEXT;

-- Promo codes table
CREATE TABLE IF NOT EXISTS promo_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT UNIQUE NOT NULL,
  plan TEXT NOT NULL DEFAULT 'pro',
  discount_percent INTEGER DEFAULT 100,
  max_uses INTEGER,
  use_count INTEGER DEFAULT 0,
  expires_at TIMESTAMPTZ,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Family members table
CREATE TABLE IF NOT EXISTS family_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  primary_user_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  member_user_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  joined_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(primary_user_id, member_user_id)
);

-- Seed promo code: pro100 gives free Pro access
INSERT INTO promo_codes (code, plan, discount_percent, is_active)
VALUES ('pro100', 'pro', 100, true)
ON CONFLICT (code) DO NOTHING;

-- RLS
ALTER TABLE promo_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE family_members ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Anyone can read active promo codes') THEN
    CREATE POLICY "Anyone can read active promo codes"
      ON promo_codes FOR SELECT USING (is_active = true);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Family members can read their family') THEN
    CREATE POLICY "Family members can read their family"
      ON family_members FOR SELECT
      USING (primary_user_id = auth.uid() OR member_user_id = auth.uid());
  END IF;
END $$;
