# Prompt: ChefsBook Knowledge Graph — Step Timings Promotion Pipeline

## LAUNCH PROMPT (paste this into Claude Code to start the session)

```
/autopilot "Read and execute docs/prompts/knowledge-graph-promotion.md fully and autonomously from pre-flight through deployment and wrapup. Do not stop for questions unless you hit a genuine blocker."
```

> **Before launching:** Run `/oh-my-claudecode:hud setup` for live observability.
> This session runs two long scripts against the live DB — HUD is useful.
> If the session hits a rate limit during classification, `omc wait --start`
> will auto-resume.

---

## TYPE: SCRIPT + CODE FIX — DATA PIPELINE
## OMC MODE: autopilot (migration + classification script + promotion script + inferStepTimings fix)

## The problem

`recipe_steps` has 1,200+ rows with inferred timing data sitting inert:
`duration_min`, `duration_max`, `is_passive`, `uses_oven`, `phase`,
`timing_confidence` — all populated. But none of it is feeding the
knowledge graph.

`cooking_action_timings` has only 40 entries (from Wikipedia) because the
promotion pipeline that was designed in `.omc/planning/02-data-strategy.md`
was never built.

`inferStepTimings()` checks `cooking_action_timings` first, misses almost
every time (40 entries ≠ coverage), and falls through to a Haiku API call —
paying ~$0.0003 per step, every time, for data we already have.

**Root cause:** `recipe_steps` has timing values but no `technique` or
`ingredient_category` columns — the two keys needed to match
`cooking_action_timings.canonical_key`. Without them, aggregation is
impossible.

## The fix — four parts in sequence

1. **Migration 084** — add `technique` + `ingredient_category` to `recipe_steps`
2. **Classification script** — classify all existing timed steps via Haiku
3. **Promotion script** — aggregate classified steps into `cooking_action_timings`
4. **inferStepTimings() fix** — capture technique + ingredient_category on every
   future inference so new steps feed the pipeline automatically

---

## Agent files to read — ALL of these, in order, before writing a single line of code

- `.claude/agents/wrapup.md`
- `.claude/agents/testing.md`
- `.claude/agents/feature-registry.md`
- `.claude/agents/ai-cost.md`
- `.claude/agents/deployment.md`

Run ALL pre-flight checklists before writing any code.

---

## OMC agent routing

| Task | Agent | Model |
|------|-------|-------|
| Pre-flight + schema verification | architect | opus |
| Migration 084 | coder | sonnet |
| Classification script | coder | sonnet |
| Promotion script | coder | sonnet |
| inferStepTimings() fix | coder | sonnet |
| Verification queries | coder | haiku |
| Wrapup | architect | sonnet |

---

## Pre-flight: before writing any code

1. **Confirm next migration number.** List the migrations directory on slux:
   ```bash
   ssh pilzner@slux "ls /opt/luxlabs/chefsbook/repo/supabase/migrations/ | sort | tail -10"
   ```
   Expected next: **084**. Use whatever the actual next number is.

2. **Read `packages/ai/src/inferStepTimings.ts` in full.** Understand exactly
   what it currently extracts, what it writes to `recipe_steps`, and how it
   checks `cooking_action_timings`. Do not guess — read the file.

3. **Verify current `recipe_steps` schema:**
   ```bash
   ssh pilzner@slux "docker exec supabase-db psql -U postgres -c '\d recipe_steps'"
   ```
   Confirm timing columns exist. Confirm `technique` and `ingredient_category`
   do NOT exist yet (they will be added in Part 1).

4. **Verify current `cooking_action_timings` schema and row count:**
   ```bash
   ssh pilzner@slux "docker exec supabase-db psql -U postgres -c \
     'SELECT COUNT(*), source FROM cooking_action_timings GROUP BY source;'"
   ```

5. **Count timed steps available for promotion:**
   ```bash
   ssh pilzner@slux "docker exec supabase-db psql -U postgres -c \
     \"SELECT COUNT(*) FROM recipe_steps \
       WHERE timings_inferred_at IS NOT NULL \
       AND timing_confidence > 0;\""
   ```
   This is the number of rows the classification script will process.

6. **Read `.claude/agents/ai-cost.md`** — confirm Haiku cost per call.
   The classification script calls Haiku once per step. At ~$0.0001/call,
   1,200 steps ≈ $0.12 total. Confirm this is acceptable before proceeding.

---

## Part 1 — Migration 084: add technique + ingredient_category to recipe_steps

File: `supabase/migrations/20260504_084_recipe_steps_technique.sql`

```sql
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
```

Apply: `ssh pilzner@slux "docker exec supabase-db psql -U postgres -f /opt/luxlabs/chefsbook/repo/supabase/migrations/20260504_084_recipe_steps_technique.sql"`

Then: `ssh pilzner@slux "docker restart supabase-rest"`

---

## Part 2 — Classification script

File: `scripts/classify-step-techniques.mjs`

**Purpose:** For every `recipe_steps` row that has timing data but no technique
classification, call Haiku to identify the cooking technique and ingredient
category, then write them back to the row.

**Auto-loads `.env.local`.** Same pattern as other scripts in `scripts/`.

### Haiku prompt per step

```
You are a culinary technique classifier.

Given this recipe step instruction, identify:
1. The PRIMARY cooking technique (one word: simmer, roast, sauté, blanch,
   marinate, fry, bake, grill, steam, poach, braise, smoke, rest, reduce,
   deglaze, caramelise, stir-fry, render, boil, whisk, fold, knead, proof,
   chill, freeze, strain, blend, chop, slice, dice, season, mix, combine,
   coat, sear, char, flambé, cure, pickle, ferment, infuse, emulsify, temper)
2. The PRIMARY ingredient category being acted on (one or two words):
   beef, chicken, pork, lamb, fish, shellfish, eggs, dairy, vegetables,
   onions, garlic, pasta, rice, bread, dough, sauce, stock, oil, spices,
   fruit, pastry, chocolate, sugar, flour — or null if the technique is
   preparation-only (e.g. "combine dry ingredients")

Return ONLY valid JSON: {"technique":"...","ingredient_category":"..."}
technique must be a single lowercase word from the list above or null.
ingredient_category must be one or two lowercase words or null.

Step: "{step_instruction}"
```

### Script behaviour

```
- Batch size: 10 steps per iteration
- Delay: 1 second between batches (Haiku rate limit headroom)
- On JSON parse error: retry once, then skip and log
- On API error: exponential backoff (5s, 10s, 20s), then skip and log
- On skip: write classified_at = NOW(), technique = null, ingredient_category = null
  so the row is not reprocessed
- Progress: print [N/total] CLASSIFIED technique:ingredient or SKIPPED
- Final summary: classified / skipped / failed counts
```

### SQL query to fetch unclassified steps

```sql
SELECT rs.id, rs.instruction
FROM recipe_steps rs
WHERE rs.timings_inferred_at IS NOT NULL
  AND rs.timing_confidence > 0
  AND rs.classified_at IS NULL
ORDER BY rs.timings_inferred_at ASC
```

### After classification, update the row

```sql
UPDATE recipe_steps
SET technique = $1,
    ingredient_category = $2,
    classified_at = NOW()
WHERE id = $3
```

### CLI flags

```bash
node scripts/classify-step-techniques.mjs           # classify all unclassified
node scripts/classify-step-techniques.mjs --dry-run # print what would be classified
node scripts/classify-step-techniques.mjs --limit 100 # classify first N only
```

---

## Part 3 — Promotion script

File: `scripts/promote-step-timings.mjs`

**Purpose:** Aggregate classified `recipe_steps` into canonical
`cooking_action_timings` entries. Run this after the classification script
completes (or on a schedule as new classifications accumulate).

**Auto-loads `.env.local`.** No AI calls — pure SQL aggregation.

### Aggregation query

```sql
SELECT
  technique,
  ingredient_category,
  technique || ':' || COALESCE(ingredient_category, '_none') AS canonical_key,
  COUNT(*)                                    AS observation_count,
  PERCENTILE_CONT(0.25) WITHIN GROUP
    (ORDER BY duration_min)::INTEGER          AS duration_min_agg,
  PERCENTILE_CONT(0.75) WITHIN GROUP
    (ORDER BY duration_max)::INTEGER          AS duration_max_agg,
  MODE() WITHIN GROUP (ORDER BY is_passive)   AS is_passive_agg,
  MODE() WITHIN GROUP (ORDER BY uses_oven)    AS uses_oven_agg,
  MODE() WITHIN GROUP
    (ORDER BY oven_temp_celsius
     NULLS LAST)                              AS oven_temp_agg,
  MODE() WITHIN GROUP (ORDER BY phase)        AS phase_agg,
  AVG(timing_confidence)                      AS avg_confidence
FROM recipe_steps
WHERE technique IS NOT NULL
  AND timings_inferred_at IS NOT NULL
  AND timing_confidence > 0
GROUP BY technique, ingredient_category
HAVING COUNT(*) >= 2
-- Require at least 2 observations before promoting
ORDER BY observation_count DESC
```

### Confidence scoring from observation count

```
1 observation   → confidence = 'low'      (never promoted — requires >= 2)
2-4 observations → confidence = 'low'
5-9 observations → confidence = 'medium'
10-24 observations → confidence = 'high'
25+ observations → confidence = 'very_high'
```

### Upsert into cooking_action_timings

For each aggregated row, upsert with conflict resolution on `canonical_key`.
On conflict: update all fields only if new `observation_count` is higher.
Always increment `observations_count`.

```sql
INSERT INTO cooking_action_timings (
  canonical_key, technique, ingredient_category,
  duration_min, duration_max, is_passive, uses_oven,
  oven_temp_celsius, phase, confidence, source,
  observations_count
)
VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'recipe_steps_promotion', $11)
ON CONFLICT (canonical_key) DO UPDATE SET
  duration_min       = EXCLUDED.duration_min,
  duration_max       = EXCLUDED.duration_max,
  is_passive         = EXCLUDED.is_passive,
  uses_oven          = EXCLUDED.uses_oven,
  oven_temp_celsius  = EXCLUDED.oven_temp_celsius,
  phase              = EXCLUDED.phase,
  confidence         = EXCLUDED.confidence,
  observations_count = EXCLUDED.observations_count,
  source             = CASE
    WHEN cooking_action_timings.source = 'wikipedia' THEN 'wikipedia+recipe_steps'
    ELSE 'recipe_steps_promotion'
  END
```

### Print final summary

```
Promotion complete:
  Canonical keys processed: 147
  New entries inserted:      112
  Existing entries updated:   35 (of which 8 were Wikipedia entries, now enriched)
  cooking_action_timings total rows: 152
```

### CLI flags

```bash
node scripts/promote-step-timings.mjs           # full promotion run
node scripts/promote-step-timings.mjs --dry-run # print what would be upserted
node scripts/promote-step-timings.mjs --min-observations 3 # raise threshold
```

---

## Part 4 — Fix inferStepTimings() to capture technique going forward

File: `packages/ai/src/inferStepTimings.ts`

**Current behaviour:** extracts timing data only, writes to `recipe_steps`
timing columns, does not extract or store `technique` or `ingredient_category`.

**New behaviour:** extend the Haiku prompt and response to also extract
`technique` and `ingredient_category`. Write them to the new columns
alongside the timing data. Set `classified_at = NOW()`.

This means every recipe imported going forward automatically feeds the
promotion pipeline — no separate classification pass needed.

**Important:** Read the existing function carefully before editing. Match
the existing prompt structure, error handling, and DB write pattern.
Do not change the function signature or what it returns to callers —
the new fields are written to DB only, not returned.

**Haiku prompt addition** — extend the existing JSON response schema to include:

```json
{
  "duration_min": 5,
  "duration_max": 10,
  "is_passive": false,
  "uses_oven": false,
  "oven_temp_celsius": null,
  "phase": "cook",
  "timing_confidence": 0.8,
  "technique": "sauté",
  "ingredient_category": "onions"
}
```

Add `technique` and `ingredient_category` to the existing Haiku prompt
instruction. Keep the same one-word/two-word constraints from Part 2.

**DB write addition** — in the existing UPDATE statement, add:
```sql
technique = $N,
ingredient_category = $N+1,
classified_at = NOW()
```

---

## Verification

After all four parts complete:

```bash
# Count classified steps
ssh pilzner@slux "docker exec supabase-db psql -U postgres -c \
  \"SELECT COUNT(*) FROM recipe_steps WHERE classified_at IS NOT NULL;\""

# Top techniques by observation count
ssh pilzner@slux "docker exec supabase-db psql -U postgres -c \
  \"SELECT technique, COUNT(*) as steps
    FROM recipe_steps WHERE technique IS NOT NULL
    GROUP BY technique ORDER BY steps DESC LIMIT 20;\""

# cooking_action_timings before vs after
ssh pilzner@slux "docker exec supabase-db psql -U postgres -c \
  \"SELECT source, COUNT(*), AVG(observations_count)::INT as avg_obs,
    COUNT(*) FILTER (WHERE confidence = 'high') as high_confidence
    FROM cooking_action_timings GROUP BY source;\""

# Confirm inferStepTimings() now writes technique on a fresh import
# Import any recipe via the scan page, then:
ssh pilzner@slux "docker exec supabase-db psql -U postgres -c \
  \"SELECT instruction, technique, ingredient_category, duration_min, phase
    FROM recipe_steps
    WHERE classified_at > NOW() - INTERVAL '10 minutes'
    LIMIT 5;\""
```

**Expected outcome:**
- `recipe_steps`: 1,200+ rows now have `technique` and `ingredient_category`
- `cooking_action_timings`: grows from 40 to 100+ entries with
  `source = 'recipe_steps_promotion'` or `'wikipedia+recipe_steps'`
- `inferStepTimings()`: new imports write technique + ingredient_category
  immediately — no classification pass needed

---

## Run order on slux

```bash
# 1. Apply migration
ssh pilzner@slux "docker exec supabase-db psql -U postgres \
  -f /opt/luxlabs/chefsbook/repo/supabase/migrations/20260504_084_recipe_steps_technique.sql"
ssh pilzner@slux "docker restart supabase-rest"

# 2. Classify existing steps (runs ~10-15 minutes for 1,200 steps)
node scripts/classify-step-techniques.mjs

# 3. Promote to knowledge graph
node scripts/promote-step-timings.mjs

# 4. Deploy updated inferStepTimings() to slux
# (follow deployment.md)
```

---

## Wrapup

Follow `wrapup.md` fully. Log in DONE.md:

- Migration 084 applied
- Steps classified: N
- Techniques found: list top 10 by count
- `cooking_action_timings` row count before and after
- New entries vs updated Wikipedia entries
- `inferStepTimings()` updated — technique captured on all future imports

Add to AGENDA.md:
- [ ] Schedule weekly promotion run (cron on slux)
- [ ] Monitor `cooking_action_timings` hit rate in `inferStepTimings()` over
      next 2 weeks — should see Haiku call volume decrease as graph grows
- [ ] Run `promote-step-timings.mjs` again after 500+ new recipes imported
