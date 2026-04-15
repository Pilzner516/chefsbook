-- Session 144: Unknown Site Discovery Flow
-- When a user imports from a site not in import_site_tracker, record it as a
-- "discovery" so we can thank the user and queue the site for review + auto-test.

-- 1. Discovery columns on import_site_tracker
ALTER TABLE import_site_tracker
  ADD COLUMN IF NOT EXISTS is_user_discovered BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS discovery_count INT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS first_discovered_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS first_discovered_by UUID REFERENCES user_profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS review_status TEXT DEFAULT 'pending';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.check_constraints
    WHERE constraint_name = 'import_site_tracker_review_status_check'
  ) THEN
    ALTER TABLE import_site_tracker
      ADD CONSTRAINT import_site_tracker_review_status_check
      CHECK (review_status IN ('pending', 'reviewed', 'added_to_list', 'ignored'));
  END IF;
END$$;

-- Existing rows are known officially-curated sites
UPDATE import_site_tracker
SET is_user_discovered = false
WHERE is_user_discovered IS NULL;

CREATE INDEX IF NOT EXISTS import_site_tracker_discovery_idx
  ON import_site_tracker(is_user_discovered, review_status, discovery_count DESC);

-- 2. is_new_discovery flag on import_attempts
ALTER TABLE import_attempts
  ADD COLUMN IF NOT EXISTS is_new_discovery BOOLEAN DEFAULT false;

-- 3. Per-user discovery counter
ALTER TABLE user_profiles
  ADD COLUMN IF NOT EXISTS sites_discovered_count INT DEFAULT 0;
