-- Migration 040: Fix flagging system + AI moderation toggle
-- Session 148 — users report only, admins/proctors act only

-- ── Expand recipe_flags flag_type to include new types ──
ALTER TABLE recipe_flags DROP CONSTRAINT IF EXISTS recipe_flags_flag_type_check;
ALTER TABLE recipe_flags ADD CONSTRAINT recipe_flags_flag_type_check
  CHECK (flag_type IN (
    'copyright', 'inappropriate', 'spam', 'misinformation',
    'impersonation', 'adult_content', 'other'
  ));

-- ── System settings table for AI moderation toggle ──
CREATE TABLE IF NOT EXISTS system_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_by UUID REFERENCES user_profiles(id),
  updated_at TIMESTAMPTZ DEFAULT now()
);

INSERT INTO system_settings (key, value) VALUES
  ('ai_auto_moderation_enabled', 'true'),
  ('ai_auto_moderation_threshold', 'serious')
  ON CONFLICT (key) DO NOTHING;
