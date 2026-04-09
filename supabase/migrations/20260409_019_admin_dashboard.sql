-- 019: Admin dashboard — roles, suspension, plan_limits

-- Admin users table
CREATE TABLE IF NOT EXISTS admin_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'proctor',
  added_by UUID REFERENCES user_profiles(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id)
);

ALTER TABLE admin_users ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Only admins can read admin_users') THEN
    CREATE POLICY "Only admins can read admin_users"
      ON admin_users FOR SELECT
      USING (EXISTS (SELECT 1 FROM admin_users au WHERE au.user_id = auth.uid()));
  END IF;
END $$;

-- Suspended flag
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS is_suspended BOOLEAN DEFAULT false;

-- Plan limits table (DB-driven, admin-editable)
CREATE TABLE IF NOT EXISTS plan_limits (
  plan TEXT PRIMARY KEY,
  own_recipes INTEGER,
  shopping_lists INTEGER,
  cookbooks INTEGER,
  images_per_recipe INTEGER,
  family_members INTEGER DEFAULT 0,
  can_import BOOLEAN DEFAULT false,
  can_ai BOOLEAN DEFAULT false,
  can_share BOOLEAN DEFAULT false,
  can_follow BOOLEAN DEFAULT false,
  can_comment BOOLEAN DEFAULT false,
  can_pdf BOOLEAN DEFAULT false,
  can_meal_plan BOOLEAN DEFAULT false,
  priority_ai BOOLEAN DEFAULT false,
  monthly_price_cents INTEGER DEFAULT 0,
  annual_price_cents INTEGER DEFAULT 0,
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Seed plan limits
INSERT INTO plan_limits (plan, own_recipes, shopping_lists, cookbooks, images_per_recipe, family_members, can_import, can_ai, can_share, can_follow, can_comment, can_pdf, can_meal_plan, priority_ai, monthly_price_cents, annual_price_cents)
VALUES
  ('free',   0,    1,    0,   0, 0, false, false, false, false, false, false, false, false, 0,    0),
  ('chef',   75,   5,   10,   1, 0, true,  true,  true,  true,  true,  false, true,  false, 499,  399),
  ('family', 200,  5,   25,   1, 3, true,  true,  true,  true,  true,  false, true,  false, 999,  799),
  ('pro',    NULL, NULL, NULL, 5, 0, true,  true,  true,  true,  true,  true,  true,  true,  1499, 1199)
ON CONFLICT (plan) DO NOTHING;

-- Help requests table
CREATE TABLE IF NOT EXISTS help_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  subject TEXT NOT NULL,
  body TEXT NOT NULL,
  status TEXT DEFAULT 'open',
  admin_reply TEXT,
  replied_by UUID REFERENCES user_profiles(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE help_requests ENABLE ROW LEVEL SECURITY;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can read own help requests') THEN
    CREATE POLICY "Users can read own help requests"
      ON help_requests FOR SELECT USING (user_id = auth.uid() OR EXISTS (SELECT 1 FROM admin_users WHERE user_id = auth.uid()));
  END IF;
END $$;
