-- Migration 046: Add success + duration_ms to ai_usage_log
-- Session 179

ALTER TABLE ai_usage_log
  ADD COLUMN IF NOT EXISTS success BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS duration_ms INTEGER;

CREATE INDEX IF NOT EXISTS ai_usage_log_success_idx
  ON ai_usage_log (success, created_at DESC);
