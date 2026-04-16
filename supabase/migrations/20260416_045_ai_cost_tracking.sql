-- Migration 045: AI cost tracking + throttle system
-- Session 174 — usage logging, daily aggregation, user throttle

-- ── AI usage log — one row per AI call ──
CREATE TABLE IF NOT EXISTS ai_usage_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES user_profiles(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  model TEXT NOT NULL,
  tokens_in INT DEFAULT 0,
  tokens_out INT DEFAULT 0,
  cost_usd NUMERIC(10,6) NOT NULL,
  recipe_id UUID REFERENCES recipes(id) ON DELETE SET NULL,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ai_usage_log_user ON ai_usage_log(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_usage_log_action ON ai_usage_log(action, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_usage_log_created ON ai_usage_log(created_at DESC);

-- ── Pre-aggregated daily totals ──
CREATE TABLE IF NOT EXISTS ai_usage_daily (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date DATE NOT NULL,
  user_id UUID REFERENCES user_profiles(id) ON DELETE CASCADE,
  action TEXT NOT NULL,
  model TEXT NOT NULL,
  call_count INT DEFAULT 0,
  total_cost_usd NUMERIC(10,4) DEFAULT 0,
  UNIQUE(date, user_id, action, model)
);

CREATE INDEX IF NOT EXISTS idx_ai_usage_daily_date ON ai_usage_daily(date DESC);
CREATE INDEX IF NOT EXISTS idx_ai_usage_daily_user ON ai_usage_daily(user_id, date DESC);

-- ── User throttle state ──
CREATE TABLE IF NOT EXISTS user_throttle (
  user_id UUID PRIMARY KEY REFERENCES user_profiles(id) ON DELETE CASCADE,
  is_throttled BOOLEAN DEFAULT false,
  throttle_level TEXT DEFAULT NULL
    CHECK (throttle_level IS NULL OR throttle_level IN ('yellow', 'red')),
  throttled_at TIMESTAMPTZ,
  throttled_reason TEXT,
  auto_restore_at TIMESTAMPTZ,
  admin_override BOOLEAN DEFAULT false,
  override_by UUID REFERENCES user_profiles(id),
  override_note TEXT,
  monthly_cost_usd NUMERIC(10,4) DEFAULT 0,
  monthly_cost_updated_at TIMESTAMPTZ
);

-- ── Throttle thresholds in system_settings ──
INSERT INTO system_settings (key, value) VALUES
  ('throttle_yellow_pct', '150'),
  ('throttle_red_pct', '300'),
  ('throttle_grace_days', '30'),
  ('throttle_window_days', '7'),
  ('throttle_expected_cost_free', '0.05'),
  ('throttle_expected_cost_chef', '0.20'),
  ('throttle_expected_cost_family', '0.71'),
  ('throttle_expected_cost_pro', '0.44'),
  ('throttle_enabled', 'true')
ON CONFLICT (key) DO NOTHING;

-- ── Daily aggregation function ──
CREATE OR REPLACE FUNCTION aggregate_ai_usage_daily(target_date DATE)
RETURNS void AS $$
  INSERT INTO ai_usage_daily
    (date, user_id, action, model, call_count, total_cost_usd)
  SELECT
    target_date,
    user_id,
    action,
    model,
    COUNT(*) as call_count,
    SUM(cost_usd) as total_cost_usd
  FROM ai_usage_log
  WHERE DATE(created_at) = target_date
  GROUP BY user_id, action, model
  ON CONFLICT (date, user_id, action, model)
  DO UPDATE SET
    call_count = EXCLUDED.call_count,
    total_cost_usd = EXCLUDED.total_cost_usd;
$$ LANGUAGE sql;
