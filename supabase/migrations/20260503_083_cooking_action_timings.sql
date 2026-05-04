-- supabase/migrations/20260503_083_cooking_action_timings.sql
-- Knowledge graph for cooking technique timings
-- Seeded from Wikipedia technique articles, refined by real cook session data

CREATE TABLE cooking_action_timings (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Canonical lookup key: technique:ingredient_category
  -- e.g. "sear:fish", "braise:beef", "proof:dough", "simmer:sauce"
  -- technique only (no ingredient) for generic techniques: "blanch", "reduce"
  canonical_key        text UNIQUE NOT NULL,

  technique            text NOT NULL,           -- e.g. "sear", "braise", "simmer"
  ingredient_category  text,                    -- e.g. "fish", "beef", "dough", "sauce" — null = applies to all

  duration_min         integer,                 -- minutes
  duration_max         integer,                 -- minutes — null = highly variable
  is_passive           boolean NOT NULL DEFAULT false,
  uses_oven            boolean NOT NULL DEFAULT false,
  oven_temp_celsius    integer,                 -- null = stovetop or no heat
  phase                text NOT NULL DEFAULT 'cook'
                         CHECK (phase IN ('prep','cook','rest','plate')),

  -- Trust hierarchy
  confidence           text NOT NULL DEFAULT 'medium'
                         CHECK (confidence IN ('low','medium','high')),
  source               text NOT NULL DEFAULT 'inferred'
                         CHECK (source IN ('wikipedia','epicurious','inferred','observed')),

  -- Learning loop counters
  inferred_count       integer NOT NULL DEFAULT 0,  -- times used from AI inference
  observed_count       integer NOT NULL DEFAULT 0,  -- times validated by real cook data
  observed_avg_minutes numeric(6,1),                -- running average from step_actuals

  notes                text,                    -- human-readable context from source

  created_at           timestamptz NOT NULL DEFAULT now(),
  updated_at           timestamptz NOT NULL DEFAULT now()
);

-- Fast lookup by canonical key (primary use case)
CREATE INDEX cooking_action_timings_key_idx ON cooking_action_timings (canonical_key);

-- Find all timings for a technique regardless of ingredient
CREATE INDEX cooking_action_timings_technique_idx ON cooking_action_timings (technique);

-- Source analysis
CREATE INDEX cooking_action_timings_source_idx ON cooking_action_timings (source);

-- RLS: public read (shared knowledge), service role write only
ALTER TABLE cooking_action_timings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "cooking_action_timings_public_read" ON cooking_action_timings
  FOR SELECT USING (true);

-- Only service role can write (backfill scripts, observed data updates)
-- No user-facing insert/update policies — this is a system table

COMMENT ON TABLE cooking_action_timings IS
  'Shared knowledge graph of cooking technique timings. '
  'Seeded from authoritative sources (Wikipedia, Epicurious). '
  'Refined over time by real cook session data via step_actuals. '
  'Used by the Chef scheduler as a lookup before calling Haiku inference.';

COMMENT ON COLUMN cooking_action_timings.canonical_key IS
  'Format: technique:ingredient_category or technique alone. '
  'Examples: sear:fish, braise:beef, proof:dough, blanch, reduce:sauce';

COMMENT ON COLUMN cooking_action_timings.observed_count IS
  'Number of real cook sessions that validated this timing. '
  'observed_count > 5 = reliable ground truth. '
  'observed_count = 0 = source data only, treat as estimate.';

COMMENT ON COLUMN cooking_action_timings.observed_avg_minutes IS
  'Running average of actual cook times from step_actuals. '
  'Scheduler should prefer this over duration_max when observed_count >= 3.';
