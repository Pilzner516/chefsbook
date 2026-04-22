-- Prompt K: Recipe flags system for user-reported and AI-detected issues
-- Creates recipe_flags table for flag tracking and admin review queue

CREATE TABLE IF NOT EXISTS recipe_flags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recipe_id UUID NOT NULL REFERENCES recipes(id) ON DELETE CASCADE,
  flagged_by UUID REFERENCES auth.users(id),
  reasons TEXT[] NOT NULL,
  details TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'reviewed', 'dismissed')),
  reviewed_by UUID REFERENCES auth.users(id),
  reviewed_at TIMESTAMPTZ,
  admin_notes TEXT
);

CREATE INDEX IF NOT EXISTS idx_recipe_flags_recipe_id ON recipe_flags(recipe_id);
CREATE INDEX IF NOT EXISTS idx_recipe_flags_status ON recipe_flags(status);
CREATE INDEX IF NOT EXISTS idx_recipe_flags_created_at ON recipe_flags(created_at DESC);

ALTER TABLE recipe_flags ENABLE ROW LEVEL SECURITY;

-- Users can create flags and read their own
DROP POLICY IF EXISTS "Users can flag recipes" ON recipe_flags;
CREATE POLICY "Users can flag recipes" ON recipe_flags
  FOR INSERT TO authenticated WITH CHECK (flagged_by = auth.uid());

DROP POLICY IF EXISTS "Users can view own flags" ON recipe_flags;
CREATE POLICY "Users can view own flags" ON recipe_flags
  FOR SELECT TO authenticated USING (flagged_by = auth.uid());

-- Service role (admin API routes) can read/update all flags
