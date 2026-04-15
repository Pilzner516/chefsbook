-- Session 141: Import Intelligence System
-- Extends import_site_tracker, adds import_attempts log, recipe completeness columns,
-- and scheduled_jobs table.

-- 1. Extend import_site_tracker
ALTER TABLE import_site_tracker
  ADD COLUMN IF NOT EXISTS rating INT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS is_blocked BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS block_reason TEXT,
  ADD COLUMN IF NOT EXISTS last_auto_tested_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS auto_test_enabled BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS failure_taxonomy JSONB DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS sample_failing_urls TEXT[] DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN IF NOT EXISTS notes TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.check_constraints
    WHERE constraint_name = 'import_site_tracker_rating_check'
  ) THEN
    ALTER TABLE import_site_tracker
      ADD CONSTRAINT import_site_tracker_rating_check
      CHECK (rating IS NULL OR (rating BETWEEN 1 AND 5));
  END IF;
END$$;

-- 2. import_attempts log table
CREATE TABLE IF NOT EXISTS import_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES user_profiles(id) ON DELETE SET NULL,
  url TEXT NOT NULL,
  domain TEXT NOT NULL,
  attempted_at TIMESTAMPTZ DEFAULT now(),
  success BOOLEAN NOT NULL,
  recipe_id UUID REFERENCES recipes(id) ON DELETE SET NULL,
  failure_reason TEXT,
  missing_title BOOLEAN DEFAULT false,
  missing_description BOOLEAN DEFAULT false,
  missing_ingredients BOOLEAN DEFAULT false,
  missing_amounts BOOLEAN DEFAULT false,
  missing_steps BOOLEAN DEFAULT false,
  ingredient_count INT DEFAULT 0,
  step_count INT DEFAULT 0,
  ai_completeness_verdict TEXT
    CHECK (ai_completeness_verdict IS NULL OR
           ai_completeness_verdict IN ('complete','incomplete','not_a_recipe','flagged'))
);

CREATE INDEX IF NOT EXISTS import_attempts_domain_idx ON import_attempts(domain, attempted_at DESC);
CREATE INDEX IF NOT EXISTS import_attempts_user_idx ON import_attempts(user_id, attempted_at DESC);
CREATE INDEX IF NOT EXISTS import_attempts_success_idx ON import_attempts(success);

ALTER TABLE import_attempts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "users read own" ON import_attempts;
CREATE POLICY "users read own" ON import_attempts FOR SELECT
  USING (user_id = auth.uid());

-- 3. recipes completeness columns
ALTER TABLE recipes
  ADD COLUMN IF NOT EXISTS is_complete BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS completeness_checked_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS missing_fields TEXT[] DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN IF NOT EXISTS ai_recipe_verdict TEXT,
  ADD COLUMN IF NOT EXISTS ai_verdict_reason TEXT,
  ADD COLUMN IF NOT EXISTS ai_verdict_at TIMESTAMPTZ;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.check_constraints
    WHERE constraint_name = 'recipes_ai_recipe_verdict_check'
  ) THEN
    ALTER TABLE recipes
      ADD CONSTRAINT recipes_ai_recipe_verdict_check
      CHECK (ai_recipe_verdict IS NULL OR
             ai_recipe_verdict IN ('approved','flagged','not_a_recipe','pending'));
  END IF;
END$$;

-- Provisionally mark existing non-private recipes with content as complete
UPDATE recipes SET is_complete = true
WHERE title IS NOT NULL
  AND description IS NOT NULL AND description != ''
  AND visibility != 'private'
  AND is_complete = false;

-- 4. scheduled_jobs table
CREATE TABLE IF NOT EXISTS scheduled_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_name TEXT NOT NULL UNIQUE,
  is_enabled BOOLEAN DEFAULT true,
  schedule TEXT NOT NULL,
  last_run_at TIMESTAMPTZ,
  last_run_status TEXT,
  last_run_result JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);

INSERT INTO scheduled_jobs (job_name, schedule, is_enabled)
VALUES ('site_compatibility_test', '0 3 * * 1', true)
ON CONFLICT (job_name) DO NOTHING;
