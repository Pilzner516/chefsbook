-- Migration 069: Menus table (My Menus feature)
-- User-curated occasion menus (Thanksgiving, dinner party, date night, etc.)

CREATE TABLE menus (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  occasion TEXT,
  notes TEXT,
  is_public BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_menus_user_id ON menus(user_id);

ALTER TABLE menus ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users own their menus"
  ON menus FOR ALL USING (user_id = auth.uid());

CREATE POLICY "Public menus are readable by all"
  ON menus FOR SELECT USING (is_public = true);
