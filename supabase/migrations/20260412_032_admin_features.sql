-- Migration 032: Reserved usernames, account status tags, user flags

-- Reserved usernames
CREATE TABLE IF NOT EXISTS reserved_usernames (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  username TEXT NOT NULL UNIQUE,
  reason TEXT,
  is_approved BOOLEAN DEFAULT false,
  approved_for_user_id UUID REFERENCES user_profiles(id) ON DELETE SET NULL,
  approved_note TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE reserved_usernames ENABLE ROW LEVEL SECURITY;

-- Seed initial reserved list
INSERT INTO reserved_usernames (username, reason) VALUES
('admin', 'admin role'),
('administrator', 'admin role'),
('chefsbook', 'brand'),
('chefs_book', 'brand'),
('chefsbook_official', 'brand'),
('official', 'brand'),
('support', 'admin role'),
('moderator', 'admin role'),
('mod', 'admin role'),
('proctor', 'admin role'),
('staff', 'admin role'),
('system', 'admin role'),
('root', 'admin role'),
('superadmin', 'admin role'),
('super_admin', 'admin role'),
('help', 'admin role'),
('pilzner', 'founder account'),
('seblux', 'founder account'),
('chefsbook_support', 'brand'),
('chefsbook_team', 'brand'),
('chef', 'brand'),
('owner', 'admin role')
ON CONFLICT (username) DO NOTHING;

-- Account status tags (admin-only)
CREATE TABLE IF NOT EXISTS user_account_tags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  tag TEXT NOT NULL,
  added_by UUID REFERENCES user_profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, tag)
);
ALTER TABLE user_account_tags ENABLE ROW LEVEL SECURITY;

-- User flags (admin-only)
CREATE TABLE IF NOT EXISTS user_flags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  flag_type TEXT NOT NULL CHECK (flag_type IN (
    'username_impersonation', 'reported_by_user',
    'reported_by_proctor', 'ai_flagged', 'admin_flagged', 'other'
  )),
  note TEXT,
  flagged_by UUID REFERENCES user_profiles(id) ON DELETE SET NULL,
  is_resolved BOOLEAN DEFAULT false,
  resolved_by UUID REFERENCES user_profiles(id) ON DELETE SET NULL,
  resolved_at TIMESTAMPTZ,
  resolution_note TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE user_flags ENABLE ROW LEVEL SECURITY;
