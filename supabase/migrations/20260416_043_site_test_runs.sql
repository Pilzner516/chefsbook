-- Migration 043: Site test run history
-- Session 161 — comprehensive import testing with logging

CREATE TABLE IF NOT EXISTS site_test_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  domain TEXT NOT NULL,
  test_url TEXT,
  rating INT,
  needs_extension BOOLEAN DEFAULT false,
  fetch_method TEXT,
  ingredient_count INT DEFAULT 0,
  step_count INT DEFAULT 0,
  has_quantities BOOLEAN DEFAULT false,
  error_reason TEXT,
  tested_at TIMESTAMPTZ DEFAULT now(),
  triggered_by UUID REFERENCES user_profiles(id)
);

CREATE INDEX IF NOT EXISTS idx_site_test_runs_domain ON site_test_runs(domain, tested_at DESC);
CREATE INDEX IF NOT EXISTS idx_site_test_runs_tested ON site_test_runs(tested_at DESC);
