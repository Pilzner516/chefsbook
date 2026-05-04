ALTER TABLE recipe_steps
  ADD COLUMN duration_min        integer,
  ADD COLUMN duration_max        integer,
  ADD COLUMN is_passive          boolean NOT NULL DEFAULT false,
  ADD COLUMN uses_oven           boolean NOT NULL DEFAULT false,
  ADD COLUMN oven_temp_celsius   integer,
  ADD COLUMN phase               text NOT NULL DEFAULT 'cook'
                                   CHECK (phase IN ('prep','cook','rest','plate')),
  ADD COLUMN timing_confidence   text NOT NULL DEFAULT 'low'
                                   CHECK (timing_confidence IN ('low','medium','high')),
  ADD COLUMN timings_inferred_at timestamptz;

COMMENT ON COLUMN recipe_steps.duration_min IS 'AI-inferred minimum duration in minutes';
COMMENT ON COLUMN recipe_steps.duration_max IS 'AI-inferred maximum — scheduler uses this for conservative planning';
COMMENT ON COLUMN recipe_steps.is_passive IS 'True if chef can do other tasks during this step';
COMMENT ON COLUMN recipe_steps.phase IS 'prep=before heat, cook=active heat, rest=no upper bound, plate=serve deadline';
