-- Migration 086: User Points and Badges System
-- Gamification layer for community contributions

-- User points balance and history
CREATE TABLE user_points (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  points INTEGER NOT NULL DEFAULT 0,
  -- positive = earned, negative = spent
  action TEXT NOT NULL,
  -- 'recipe_import', 'gap_contribution', 'gap_contribution_double',
  -- 'cooked_it', 'recipe_shared', 'badge_bonus'
  reference_id UUID,
  -- recipe_id, gap_contribution_id, etc.
  description TEXT NOT NULL,
  -- human-readable: "Contributed rotisserie chicken recipe (2× gap bonus)"
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_user_points_user ON user_points(user_id, created_at DESC);

-- Materialised balance view — avoid summing every time
CREATE TABLE user_points_balance (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  total_points INTEGER NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Badge definitions (seeded)
CREATE TABLE badge_definitions (
  id TEXT PRIMARY KEY,
  -- e.g. 'first_contribution', 'gap_filler_5', 'gap_filler_25'
  name TEXT NOT NULL,
  description TEXT NOT NULL,
  icon TEXT NOT NULL,
  -- emoji or icon name
  category TEXT NOT NULL
    CHECK (category IN ('contribution', 'cooking', 'social', 'milestone')),
  threshold INTEGER,
  -- for count-based badges: how many actions required
  is_active BOOLEAN NOT NULL DEFAULT TRUE
);

-- User earned badges
CREATE TABLE user_badges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  badge_id TEXT NOT NULL REFERENCES badge_definitions(id),
  earned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, badge_id)
);

CREATE INDEX idx_user_badges_user ON user_badges(user_id);

-- Seed badge definitions
INSERT INTO badge_definitions (id, name, description, icon, category, threshold) VALUES
  ('first_contribution', 'First Contribution',
   'You helped teach our Sous Chef something new!',
   '🌱', 'contribution', 1),
  ('gap_filler_5', 'Knowledge Keeper',
   'You filled 5 knowledge gaps for the community.',
   '📚', 'contribution', 5),
  ('gap_filler_25', 'Culinary Scholar',
   'You filled 25 knowledge gaps. The Sous Chef is smarter because of you.',
   '🎓', 'contribution', 25),
  ('gap_filler_100', 'Master Contributor',
   '100 gap contributions. You are building ChefsBook''s intelligence.',
   '🏆', 'contribution', 100),
  ('first_import', 'Recipe Pioneer',
   'You imported your first recipe into ChefsBook.',
   '✨', 'milestone', 1),
  ('import_10', 'Recipe Collector',
   'You have imported 10 recipes.',
   '📖', 'milestone', 10),
  ('import_50', 'Recipe Curator',
   'You have imported 50 recipes.',
   '👨‍🍳', 'milestone', 50);

-- RLS
ALTER TABLE user_points ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users see own points" ON user_points
  FOR SELECT USING (user_id = auth.uid());

ALTER TABLE user_points_balance ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users see own balance" ON user_points_balance
  FOR SELECT USING (user_id = auth.uid());

ALTER TABLE badge_definitions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read" ON badge_definitions FOR SELECT USING (true);

ALTER TABLE user_badges ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read" ON user_badges FOR SELECT USING (true);
CREATE POLICY "System insert" ON user_badges FOR INSERT
  WITH CHECK (user_id = auth.uid());
