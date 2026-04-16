-- Recalculate import_site_tracker ratings from actual success rates
-- Session 143 crawl rated sites based on HTTP status codes, not real import success.
-- This migration fixes ratings using the tracker's own total_attempts/successful_attempts.
-- For domains with 0 attempts, rating is set to NULL (shown as "Untested" in admin UI).

UPDATE import_site_tracker
SET rating = CASE
  WHEN total_attempts = 0 THEN NULL
  WHEN (successful_attempts::float / total_attempts) >= 0.8 THEN 5
  WHEN (successful_attempts::float / total_attempts) >= 0.6 THEN 4
  WHEN (successful_attempts::float / total_attempts) >= 0.4 THEN 3
  WHEN (successful_attempts::float / total_attempts) >= 0.2 THEN 2
  ELSE 1
END,
updated_at = NOW();
