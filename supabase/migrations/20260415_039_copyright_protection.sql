-- Migration 039: Copyright protection suite
-- Session 147 — step rewriting, AI image generation, copyright flagging

-- ── Recipes table additions ──
ALTER TABLE recipes
  ADD COLUMN IF NOT EXISTS steps_rewritten BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS steps_rewritten_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS has_ai_image BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS ai_image_prompt TEXT,
  ADD COLUMN IF NOT EXISTS image_generation_status TEXT
    CHECK (image_generation_status IS NULL OR image_generation_status IN (
      'pending', 'generating', 'complete', 'failed'
    )),
  ADD COLUMN IF NOT EXISTS copyright_review_pending BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS copyright_locked_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS copyright_removed BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS copyright_previous_visibility visibility_level;

-- ── recipe_user_photos additions ──
ALTER TABLE recipe_user_photos
  ADD COLUMN IF NOT EXISTS is_ai_generated BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS upload_confirmed_copyright BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS upload_confirmed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS watermark_risk_level TEXT
    CHECK (watermark_risk_level IS NULL OR watermark_risk_level IN ('low', 'medium', 'high'));

-- ── user_profiles additions ──
ALTER TABLE user_profiles
  ADD COLUMN IF NOT EXISTS recipes_flagged_count INT DEFAULT 0;

-- ── Recipe flags table ──
CREATE TABLE IF NOT EXISTS recipe_flags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recipe_id UUID NOT NULL REFERENCES recipes(id) ON DELETE CASCADE,
  flagged_by UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  flag_type TEXT NOT NULL CHECK (flag_type IN (
    'copyright', 'inappropriate', 'spam', 'misinformation', 'other'
  )),
  reason TEXT,
  status TEXT DEFAULT 'pending'
    CHECK (status IN ('pending', 'approved', 'removed', 'dismissed')),
  reviewed_by UUID REFERENCES user_profiles(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMPTZ,
  admin_note TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(recipe_id, flagged_by, flag_type)
);

CREATE INDEX IF NOT EXISTS idx_recipe_flags_recipe_status ON recipe_flags(recipe_id, status);
CREATE INDEX IF NOT EXISTS idx_recipe_flags_flagged_by ON recipe_flags(flagged_by);
CREATE INDEX IF NOT EXISTS idx_recipe_flags_type_status ON recipe_flags(flag_type, status);

ALTER TABLE recipe_flags ENABLE ROW LEVEL SECURITY;

-- Users can insert their own flags
DO $$ BEGIN
  CREATE POLICY "users can flag" ON recipe_flags FOR INSERT
    WITH CHECK (flagged_by = auth.uid());
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Users can see their own flags
DO $$ BEGIN
  CREATE POLICY "users see own flags" ON recipe_flags FOR SELECT
    USING (flagged_by = auth.uid());
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
