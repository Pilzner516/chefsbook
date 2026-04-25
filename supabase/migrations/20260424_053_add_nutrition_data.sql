-- Migration: 053 - Add nutrition JSONB column and AI model config table
-- NOTE: recipes table already has calories/protein_g/carbs_g/fat_g columns (unused)
-- These legacy columns are left in place. The new nutrition JSONB supersedes them.

-- Nutrition JSONB column
ALTER TABLE recipes ADD COLUMN IF NOT EXISTS nutrition JSONB;
ALTER TABLE recipes ADD COLUMN IF NOT EXISTS nutrition_generated_at TIMESTAMPTZ;
ALTER TABLE recipes ADD COLUMN IF NOT EXISTS nutrition_source TEXT
  CHECK (nutrition_source IS NULL OR nutrition_source IN ('ai', 'manual', 'imported'));

-- GIN index for JSONB filter queries (Nutrition-3 will use this for search filters)
CREATE INDEX IF NOT EXISTS idx_recipes_nutrition
  ON recipes USING GIN (nutrition jsonb_path_ops);

-- Functional index for calorie range queries (common filter)
CREATE INDEX IF NOT EXISTS idx_recipes_nutrition_calories
  ON recipes (((nutrition->'per_serving'->>'calories')::numeric))
  WHERE nutrition IS NOT NULL;

-- AI Model Config table
-- Allows admin to change which Claude model is used for each task without code deploy.
-- Future: admin UI will read/write this table. For now, populated by seed only.
CREATE TABLE IF NOT EXISTS ai_model_config (
  task        TEXT PRIMARY KEY,
  model       TEXT NOT NULL,
  description TEXT,
  updated_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_by  UUID REFERENCES auth.users(id)
);

-- Seed with current hardcoded models (matches packages/ai/src/client.ts constants)
-- HAIKU = 'claude-haiku-4-5-20251001'
-- SONNET = 'claude-sonnet-4-20250514'
INSERT INTO ai_model_config (task, model, description) VALUES
  ('nutrition',         'claude-haiku-4-5-20251001',  'Recipe nutrition estimation'),
  ('moderation',        'claude-haiku-4-5-20251001',  'Content moderation'),
  ('classification',    'claude-haiku-4-5-20251001',  'Recipe/technique classification'),
  ('translation',       'claude-sonnet-4-20250514',   'Recipe translation'),
  ('import_extraction', 'claude-sonnet-4-20250514',   'Recipe extraction from URLs/scans'),
  ('meal_plan',         'claude-sonnet-4-20250514',   'Meal plan generation'),
  ('dish_recipe',       'claude-sonnet-4-20250514',   'Generate recipe from dish name'),
  ('cookbook_toc',      'claude-sonnet-4-20250514',   'Cookbook table of contents extraction'),
  ('speak_recipe',      'claude-sonnet-4-20250514',   'Voice recipe structuring'),
  ('image_generation',  'replicate/flux-schnell',    'Recipe image generation (Replicate)')
ON CONFLICT (task) DO NOTHING;

-- RLS
ALTER TABLE ai_model_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage ai_model_config" ON ai_model_config
  FOR ALL USING (
    EXISTS (SELECT 1 FROM admin_users WHERE user_id = auth.uid())
  );

CREATE POLICY "Anyone can read ai_model_config" ON ai_model_config
  FOR SELECT USING (true);

COMMENT ON TABLE ai_model_config IS 'Admin-configurable AI model settings per task. Allows switching models without code deploy.';

COMMENT ON COLUMN recipes.nutrition IS 'AI-estimated or manually entered nutrition data. Structure: { per_serving: {...}, per_100g: {...}|null, total_weight_g: number|null, confidence: 0-1, notes: string|null }';
