-- Migration 034: Import site tracker
CREATE TABLE import_site_tracker (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  domain TEXT NOT NULL UNIQUE,
  last_import_at TIMESTAMPTZ,
  total_attempts INT DEFAULT 0,
  successful_attempts INT DEFAULT 0,
  known_issue TEXT,
  status TEXT DEFAULT 'unknown' CHECK (status IN ('working', 'partial', 'broken', 'unknown')),
  last_checked_by UUID REFERENCES user_profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE import_site_tracker ENABLE ROW LEVEL SECURITY;

-- Seed known issue
INSERT INTO import_site_tracker (domain, known_issue, status)
VALUES ('seriouseats.com', 'Ingredients frequently missing — site uses non-standard JSON-LD schema', 'partial');
