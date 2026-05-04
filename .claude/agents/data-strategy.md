# data-strategy.md — ChefsBook Data Intelligence Agent

**MANDATORY**: Read this file before any session touching:
- cooking_action_timings table
- inferStepTimings() function
- step_actuals recording
- knowledge graph promotion pipeline
- recipe import pipeline data capture
- any AI training or learning loop logic

Add to CLAUDE.md agent lookup table:
```
| Any session touching cooking_action_timings, knowledge graph, step_actuals, or data learning loop | data-strategy.md (MANDATORY) |
```

---

## The Data Mission

ChefsBook's competitive moat is not the recipe collection — it's what the platform
learns from cooking behaviour over time. Every recipe imported, every step inferred,
every meal cooked makes Chef smarter for every user. This compounds. No competitor
has this architecture.

**The goal**: Build the world's most accurate cooking timing knowledge graph,
seeded from clean structured sources, refined by real cooking behaviour over time.

---

## Data Quality Hierarchy — Trust Tiers

Never mix tiers without flagging confidence. Never promote Tier 3+ data to the
knowledge graph without sufficient sample count. Never use session data (Tier 4)
to update knowledge graph until user volume justifies statistical noise reduction.

### Tier 1 — Explicit Structured Data (highest trust, use immediately)
- `schema.org` `prepTime` / `cookTime` from URL recipe imports
- Published cookbook step timings from ISBN scans
- User manual corrections to existing recipe steps
- Steps with explicit time references ("bake for exactly 30 minutes")
- `recipes.prep_minutes` / `recipes.cook_minutes` user-entered values

**Action**: Promote to `cooking_action_timings` immediately with `confidence = 'high'`

### Tier 2 — High-Confidence AI Inference (use with validation)
- `inferStepTimings()` results with `timing_confidence = 'high'`
- YouTube transcript timestamps from video recipe imports
- Step inference validated against `recipes.cook_minutes` total (within 20%)
- Recipe corpus statistical averages (SQL aggregates across existing recipes)

**Action**: Promote to `cooking_action_timings` with `confidence = 'medium'`
after validation against recipe total time.

### Tier 3 — Statistical Aggregation (use carefully, flag as estimated)
- SQL averages across recipe corpus by technique + ingredient category
- Ingredient-technique co-occurrence patterns
- Food.com / Recipe1M bulk dataset seeding
- `inferStepTimings()` results with `timing_confidence = 'medium'`

**Action**: Promote with `confidence = 'low'`, require `inferred_count >= 3`
before scheduler uses as primary timing source.

### Tier 4 — Live Session Data (collect now, use later)
- `step_actuals` from real cook sessions
- Too noisy at current user volume for knowledge graph promotion
- Session integrity issues: app closed mid-cook, forgotten taps, multi-device races

**Action**: COLLECT but DO NOT promote to knowledge graph until:
- User base exceeds 1,000 active monthly cooks
- Statistical outlier removal pipeline is built
- Session integrity validation is implemented
- `observed_count >= 5` per canonical key before overriding inferred data

**CRITICAL RULE**: Never wire `step_actuals` directly into `cooking_action_timings`
promotion without the outlier removal pipeline. Dirty session data corrupts the
knowledge graph and makes Chef less accurate, not more.

---

## Clean Data Sources — Available Now

### Source 1: Existing Recipe Corpus (1,290+ steps)
**What**: All recipe steps already in DB with `timings_inferred_at IS NOT NULL`
**Quality**: Tier 2 — AI inferred, mixed confidence
**Action**: Run promotion pipeline to aggregate into `cooking_action_timings`
**SQL to find promotable steps**:
```sql
SELECT
  phase,
  timing_confidence,
  COUNT(*) as step_count,
  ROUND(AVG(duration_max)) as avg_max_min
FROM recipe_steps
WHERE timings_inferred_at IS NOT NULL
  AND duration_max IS NOT NULL
GROUP BY phase, timing_confidence
ORDER BY timing_confidence DESC, step_count DESC;
```

### Source 2: Recipe Metadata Validation
**What**: `recipes.prep_minutes` + `recipes.cook_minutes` vs sum of step durations
**Quality**: Tier 1 — user-entered or scraped structured data
**Use**: Calibration anchor — if step inference totals within 20% of recipe total,
promote with higher confidence. If diverges > 20%, flag for review.
**Implementation**:
```typescript
// In promotion pipeline
function validateStepTotals(
  recipe: Recipe,
  steps: RecipeStepWithTimings[]
): 'valid' | 'divergent' | 'unvalidatable' {
  const recipeTotal = (recipe.prep_minutes || 0) + (recipe.cook_minutes || 0);
  if (!recipeTotal) return 'unvalidatable';
  const stepTotal = steps.reduce((sum, s) => sum + (s.duration_max || 0), 0);
  const divergence = Math.abs(stepTotal - recipeTotal) / recipeTotal;
  return divergence <= 0.2 ? 'valid' : 'divergent';
}
```

### Source 3: schema.org Import Extraction
**What**: `prepTime`, `cookTime`, `totalTime` from structured recipe markup on imported URLs
**Quality**: Tier 1 — structured data from original source
**Implementation**: Enhance URL import parser to extract ISO 8601 durations
```typescript
// PT30M → 30, PT1H30M → 90
function parseISO8601Duration(duration: string): number | null {
  const match = duration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!match) return null;
  const hours = parseInt(match[1] || '0');
  const minutes = parseInt(match[2] || '0');
  return hours * 60 + minutes;
}
```
Store as `recipes.structured_prep_minutes` and `recipes.structured_cook_minutes`
(separate from user-entered values to preserve data provenance).

### Source 4: User Edit Signal Capture
**What**: When user edits a recipe step that has `timings_inferred_at` set
**Quality**: Tier 1 — human correction is ground truth
**Implementation**: In step update handler, if instruction text changes:
1. Clear `timings_inferred_at` to null
2. Queue step for re-inference (async, fire-and-forget)
3. Log the edit as a quality signal in `data_quality_events` table (future)
**Never** re-run inference synchronously on edit — it blocks the UI.

### Source 5: Recipe Corpus Statistical Aggregates
**What**: SQL averages across existing recipe steps grouped by technique + phase
**Quality**: Tier 3 — real data, but averaged
**When to run**: After each batch of 100+ new recipes imported
**Key query** (seeds canonical keys with statistical averages):
```sql
SELECT
  phase,
  LOWER(SPLIT_PART(instruction, ' ', 1)) as likely_technique,
  COUNT(*) as sample_count,
  MIN(duration_min) as observed_min,
  MAX(duration_max) as observed_max,
  ROUND(AVG(duration_max)) as avg_max,
  ROUND(AVG(duration_min)) as avg_min,
  MODE() WITHIN GROUP (ORDER BY is_passive) as typical_passive,
  MODE() WITHIN GROUP (ORDER BY uses_oven) as typical_oven
FROM recipe_steps
WHERE timing_confidence IN ('high', 'medium')
  AND duration_max IS NOT NULL
  AND duration_max < 480  -- exclude outliers (8hr+ steps)
GROUP BY phase, likely_technique
HAVING COUNT(*) >= 3
ORDER BY sample_count DESC;
```

### Source 6: Food.com Kaggle Dataset
**What**: ~180k recipes, public domain, structured steps
**Quality**: Tier 3 — community-submitted, variable quality
**Where**: https://www.kaggle.com/datasets/shuyangli94/food-com-recipes-and-user-interactions
**Implementation**: One-time bulk seeding script (separate from ongoing pipeline)
Run `inferStepTimings()` against step text, aggregate into canonical keys.
NEVER import as recipes into ChefsBook — timing signal extraction only.
Store results directly to `cooking_action_timings` with `source = 'bulk_seed'`.

### Source 7: YouTube Transcript Timestamps
**What**: Spoken time references in video recipe transcripts ("after 3 minutes", "cook for another 5")
**Quality**: Tier 2 — demonstrated in video, highly reliable
**Implementation**: In YouTube import pipeline, after transcript extraction:
1. Run regex + NLP to find time references adjacent to action verbs
2. Map to corresponding recipe steps
3. Store as high-confidence duration overrides
This is a Sprint 2+ feature — requires YouTube import to be fully working first.

### Source 8: ISBN Cookbook Scans
**What**: Published cookbook recipes from scanning feature
**Quality**: Tier 1 — professionally tested, explicit times
**Implementation**: Tag recipe steps imported via ISBN scan with
`source = 'cookbook'` and boost inference confidence by one tier.
Cookbook-sourced timing data is the highest quality training signal available.

---

## The Promotion Pipeline — How Data Flows to Knowledge Graph

This pipeline runs asynchronously after every recipe import batch.
Never runs synchronously (blocks import). Never runs on session data (dirty).

```
Recipe imported / steps saved
         ↓
inferStepTimings() runs (already wired in saveWithModeration.ts)
         ↓
Results stored to recipe_steps timing fields
         ↓
[NEW] promoteToKnowledgeGraph() — async, fire-and-forget
         ↓
For each step with timing_confidence IN ('high', 'medium'):
  1. Extract canonical key: technique verb + ingredient category
  2. Validate against recipe total time (Tier 1 calibration)
  3. Upsert to cooking_action_timings:
     - If key exists: update running average, increment inferred_count
     - If key new: insert with source = 'inferred', appropriate confidence
         ↓
[FUTURE - Stage 2] After user volume > 1,000 monthly cooks:
  Batch process step_actuals with outlier removal
  Promote validated observed timings to cooking_action_timings
  observed_count >= 5 before overriding inferred data
```

### Canonical Key Extraction
The hardest part of the pipeline. Turning "sear the salmon fillet in a very hot pan"
into `sear:fish` requires NLP, not just regex.

**Implementation approach** (Haiku — cheap, fast):
```
Extract canonical cooking key from this recipe step.
Return JSON: { "technique": "verb", "ingredient_category": "category or null" }
Technique: the primary cooking verb (sear, braise, simmer, bake, chop, rest, plate)
Ingredient category: broadest applicable category (fish, beef, vegetable, dough, sauce, egg)
  Use null if step is generic (e.g. "season to taste", "set aside")
Return only JSON, no explanation.

Step: "{instruction}"
```

**Cost**: ~$0.00003 per step (much cheaper than full timing inference)
**Cache**: Store canonical key on `recipe_steps.canonical_key` column (add in migration 084)
**Never re-extract**: If `canonical_key` is already set, skip extraction

---

## cooking_action_timings — Confidence Upgrade Rules

Entries in the knowledge graph should upgrade confidence as evidence accumulates:

```typescript
function determineConfidence(entry: {
  inferred_count: number;
  observed_count: number;
  source: string;
}): TimingConfidence {
  // Observed data always wins
  if (entry.observed_count >= 10) return 'high';
  if (entry.observed_count >= 5) return 'medium';

  // Inferred data needs volume
  if (entry.source === 'wikipedia' && entry.inferred_count >= 1) return 'medium';
  if (entry.inferred_count >= 10) return 'medium';
  if (entry.inferred_count >= 3) return 'low';

  return 'low';
}
```

---

## Migration 084 — Required Schema Changes

Add `canonical_key` to `recipe_steps` to cache extraction results:

```sql
-- supabase/migrations/20260504_084_recipe_steps_canonical_key.sql

ALTER TABLE recipe_steps
  ADD COLUMN canonical_key text,
  ADD COLUMN canonical_key_extracted_at timestamptz;

CREATE INDEX recipe_steps_canonical_key_idx ON recipe_steps (canonical_key)
  WHERE canonical_key IS NOT NULL;

COMMENT ON COLUMN recipe_steps.canonical_key IS
  'Canonical knowledge graph key e.g. sear:fish, simmer:sauce. '
  'Extracted by Haiku at promotion time. Cached to avoid re-extraction.';
```

Also add `source` column tracking to `cooking_action_timings`:
```sql
-- Already has source column from migration 083
-- Ensure 'bulk_seed' is a valid source value:
ALTER TABLE cooking_action_timings
  DROP CONSTRAINT cooking_action_timings_source_check;

ALTER TABLE cooking_action_timings
  ADD CONSTRAINT cooking_action_timings_source_check
  CHECK (source IN ('wikipedia','epicurious','inferred','observed','bulk_seed','cookbook'));
```

---

## What NOT to Build Yet

These are tempting but premature at current user volume:

**DO NOT**: Wire `step_actuals` into knowledge graph promotion (Stage 2 only)
**DO NOT**: Build real-time personalisation from session data (too noisy)
**DO NOT**: Scrape Epicurious or ATK (legal risk, not worth it)
**DO NOT**: Build outlier removal pipeline until 1,000+ monthly active cooks
**DO NOT**: Use USDA timing recommendations (professionally accurate but
  not representative of real kitchen cooking — food gets overcooked)

---

## Data Roadmap

### Stage 1 — NOW (current user base)
- Promotion pipeline: recipe_steps → cooking_action_timings
- schema.org extraction enhancement on URL imports
- User edit signal capture (re-queue inference on step edit)
- Recipe metadata validation (step totals vs recipe totals)
- Food.com bulk seed (one-time, Tier 3)
- canonical_key column on recipe_steps (migration 084)

### Stage 2 — After 1,000 monthly active cooks
- step_actuals batch processing with outlier removal
- Observed timing validation pipeline
- Session integrity scoring (detect incomplete sessions)
- YouTube transcript timestamp extraction

### Stage 3 — After 10,000 monthly active cooks
- Real-time personalisation from cook history
- Per-user timing factor (this user takes 40% longer on prep steps)
- Predictive scheduling using personal timing factors
- Skill assessment from cook session patterns
- Waste reduction from shopping list + cook session correlation

---

## Known Data Quality Issues

**Issue**: 61% of recipe steps have `timing_confidence = 'low'` (no timing data)
**Cause**: Vague recipe prose — "cook until done", "season to taste"
**Mitigation**: These steps still get canonical keys. Scheduler uses default
  times from knowledge graph for the canonical key even if step-level confidence is low.
  Over time observed data fills the gap.

**Issue**: `duration_max` averages for `rest` phase steps are very high (482 min avg)
**Cause**: Includes overnight rests, 24hr marinades, multi-day fermentation
**Mitigation**: Cap scheduler display at 480 min (8 hrs). Show "overnight" label.
  Rest steps with `duration_max > 480` are scheduled as make-ahead, not same-day.

**Issue**: Wikipedia seeding produced 40 entries, many with null durations
**Cause**: Wikipedia technique articles are conceptual, not time-specific
**Mitigation**: Wikipedia entries serve as canonical key stubs only.
  Timing data will be filled by recipe corpus aggregation over time.
  Do not rely on Wikipedia entries for scheduler timing — check `duration_max IS NOT NULL`.

---

## Pre-flight Checklist for Data Sessions

- [ ] Read ai-cost.md — canonical key extraction and timing inference have per-step costs
- [ ] Check current knowledge graph state:
      `SELECT source, confidence, COUNT(*) FROM cooking_action_timings GROUP BY source, confidence;`
- [ ] Check promotion pipeline backlog:
      `SELECT COUNT(*) FROM recipe_steps WHERE timings_inferred_at IS NOT NULL AND canonical_key IS NULL;`
- [ ] Verify migration 084 applied before running promotion pipeline
- [ ] Never run promotion pipeline synchronously in the request path
- [ ] Never promote step_actuals to knowledge graph without outlier removal

---

## Post-flight Checklist for Data Sessions

- [ ] Run knowledge graph distribution query and log results in DONE.md
- [ ] Update ai-cost.md with any new inference functions and estimated costs
- [ ] Verify no step_actuals → knowledge graph wiring was added accidentally
- [ ] Check canonical_key extraction cost estimate for current recipe corpus size
- [ ] docker restart supabase-rest after any migration
