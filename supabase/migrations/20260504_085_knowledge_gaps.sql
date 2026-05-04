-- Migration 085: Knowledge Gaps and Gap Contributions
-- Tracks knowledge gaps in the cooking action timings graph and community contributions

-- Detected gaps in the knowledge graph
CREATE TABLE knowledge_gaps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  technique TEXT NOT NULL,
  ingredient_category TEXT,
  canonical_key TEXT NOT NULL UNIQUE,
  -- technique:ingredient_category or technique:_none
  observation_count INTEGER NOT NULL DEFAULT 0,
  -- how many recipe_steps observations exist for this key
  priority TEXT NOT NULL DEFAULT 'medium'
    CHECK (priority IN ('low', 'medium', 'high', 'critical')),
  status TEXT NOT NULL DEFAULT 'detected'
    CHECK (status IN (
      'detected',      -- found by gap detection job, not yet reviewed
      'approved',      -- admin approved for community request
      'active',        -- currently shown as community request card
      'agent_hunting', -- agent is actively searching for URLs
      'filled',        -- enough observations now exist
      'dismissed'      -- admin dismissed, not worth pursuing
    )),
  -- community request fields (set when status = active)
  request_title TEXT,
  -- e.g. "a great rotisserie chicken recipe"
  request_body TEXT,
  -- e.g. "Our Sous Chef doesn't know much about this technique yet."
  fill_threshold INTEGER NOT NULL DEFAULT 5,
  -- how many observations needed to mark as filled
  -- admin URL suggestions from agent discovery
  suggested_urls JSONB DEFAULT '[]',
  -- [{"url": "...", "title": "...", "source": "...", "suggested_at": "..."}]
  -- tracking
  detected_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  approved_at TIMESTAMPTZ,
  approved_by UUID REFERENCES auth.users(id),
  filled_at TIMESTAMPTZ,
  dismissed_at TIMESTAMPTZ,
  dismissed_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_knowledge_gaps_status ON knowledge_gaps(status);
CREATE INDEX idx_knowledge_gaps_priority ON knowledge_gaps(priority, status);
CREATE INDEX idx_knowledge_gaps_canonical ON knowledge_gaps(canonical_key);

-- Track which recipe imports were made in response to a gap request
CREATE TABLE gap_contributions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  gap_id UUID NOT NULL REFERENCES knowledge_gaps(id) ON DELETE CASCADE,
  recipe_id UUID NOT NULL REFERENCES recipes(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  points_awarded INTEGER NOT NULL DEFAULT 0,
  is_double_points BOOLEAN NOT NULL DEFAULT TRUE,
  -- gap-filling imports always earn double
  contributed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(gap_id, recipe_id)
);

CREATE INDEX idx_gap_contributions_user ON gap_contributions(user_id);
CREATE INDEX idx_gap_contributions_gap ON gap_contributions(gap_id);

-- RLS
ALTER TABLE knowledge_gaps ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read for active gaps" ON knowledge_gaps
  FOR SELECT USING (status IN ('active', 'agent_hunting'));
CREATE POLICY "Admin full access" ON knowledge_gaps
  USING (EXISTS (
    SELECT 1 FROM admin_users
    WHERE admin_users.user_id = auth.uid()
  ));

ALTER TABLE gap_contributions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users see own contributions" ON gap_contributions
  FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "Users insert own contributions" ON gap_contributions
  FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "Admin full access" ON gap_contributions
  USING (EXISTS (
    SELECT 1 FROM admin_users
    WHERE admin_users.user_id = auth.uid()
  ));
