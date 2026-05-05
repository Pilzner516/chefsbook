-- Migration 087: step_actuals table for Chef Kitchen Conductor learning loop
-- Records actual timing when a user completes each step during cooking
-- This is the ground-truth data that improves the knowledge graph over time

CREATE TABLE step_actuals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cooking_session_id UUID REFERENCES cooking_sessions(id) ON DELETE CASCADE,
  recipe_id UUID NOT NULL REFERENCES recipes(id) ON DELETE CASCADE,
  recipe_step_id UUID NOT NULL REFERENCES recipe_steps(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  -- What the scheduler predicted
  planned_duration_min INTEGER,
  planned_duration_max INTEGER,
  -- What actually happened
  actual_duration_seconds INTEGER NOT NULL,
  -- step metadata at time of cooking (denormalised for analysis)
  step_index INTEGER NOT NULL,
  technique TEXT,
  ingredient_category TEXT,
  is_passive BOOLEAN,
  -- timing quality signal
  was_paused BOOLEAN NOT NULL DEFAULT FALSE,
  -- true if user paused the timer during this step
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_step_actuals_recipe ON step_actuals(recipe_id);
CREATE INDEX idx_step_actuals_user ON step_actuals(user_id);
CREATE INDEX idx_step_actuals_technique ON step_actuals(technique, ingredient_category)
  WHERE technique IS NOT NULL;
CREATE INDEX idx_step_actuals_session ON step_actuals(cooking_session_id);

ALTER TABLE step_actuals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users own their actuals" ON step_actuals
  USING (user_id = auth.uid());

CREATE POLICY "Admin read all" ON step_actuals
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM admin_users WHERE admin_users.user_id = auth.uid())
  );
