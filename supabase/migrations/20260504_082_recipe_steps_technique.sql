-- Migration 082: Add technique and ingredient_category to recipe_steps
-- Enables knowledge graph promotion pipeline

ALTER TABLE recipe_steps
  ADD COLUMN IF NOT EXISTS technique TEXT,
  -- e.g. 'simmer', 'roast', 'sauté', 'blanch', 'marinate'
  -- NULL = not yet classified
  ADD COLUMN IF NOT EXISTS ingredient_category TEXT,
  -- e.g. 'beef', 'vegetables', 'chicken', 'fish', 'onions', 'pasta'
  -- NULL = not yet classified or technique has no ingredient
  ADD COLUMN IF NOT EXISTS classified_at TIMESTAMPTZ;
  -- timestamp of when technique/ingredient_category were last set

CREATE INDEX IF NOT EXISTS idx_recipe_steps_technique
  ON recipe_steps(technique, ingredient_category)
  WHERE technique IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_recipe_steps_promote
  ON recipe_steps(timings_inferred_at, classified_at)
  WHERE timings_inferred_at IS NOT NULL;
