# kitchen-conductor.md — Chef / Kitchen Conductor Agent

**MANDATORY**: Read this file in full before touching anything related to Start Cooking,
cooking sessions, kitchen scheduling, Chef voice, or the cooking_sessions table.

Add to CLAUDE.md agent lookup table:
```
| Any session touching Start Cooking, cooking sessions, kitchen scheduling, or Chef voice | kitchen-conductor.md (MANDATORY) |
| Any session touching cooking_action_timings, knowledge graph, step_actuals, or data learning loop | data-strategy.md (MANDATORY) |
```

---

## Feature overview

**Chef** is the ChefsBook kitchen orchestration system. When a user taps "Start Cooking"
on a menu, Chef generates a reverse-scheduled cooking plan across all dishes, allocates
steps to named chefs, detects oven conflicts, and guides the team through cooking
step-by-step via a single active card UI and TTS voice call-outs.

The app persona is literally named **Chef** — calm, authoritative, addresses each cook
by name. Users interact with it as: *"Chef, shrimp are cooking — what's next?"*

---

## Architecture map — what lives where

| Concern | Location | Notes |
|---------|----------|-------|
| Scheduling algorithm | `packages/ui/src/scheduler.ts` | Pure TypeScript, zero dependencies, fully unit testable |
| Type contracts | `packages/ui/src/scheduler.types.ts` | Shared by web, mobile, and AI packages |
| AI timing inference | `packages/ai/src/inferStepTimings.ts` | Haiku model — runs at import/scan time, cached to DB |
| Chef briefing generation | `packages/ai/src/chefBriefing.ts` | Haiku model — generates spoken briefing from CookingPlan |
| DB queries / session mgmt | `packages/db/src/cookingSessions.ts` | Supabase client, RLS-aware |
| Knowledge graph queries | `packages/db/src/queries/cookingKnowledge.ts` | cooking_action_timings lookup |
| Promotion pipeline | `packages/ai/src/promoteToKnowledgeGraph.ts` | Async — runs after import, never on cook tap |
| Web setup modal | `apps/web/app/dashboard/menus/[id]/cook/` | Primary flow, replaces useless side panel |
| Web active cooking view | `apps/web/app/dashboard/menus/[id]/cook/active/` | Single-card mode |
| Mobile setup flow | `apps/mobile/app/(app)/menus/[id]/cook.tsx` | Full-screen, primary flow |
| Mobile active cooking | `apps/mobile/app/(app)/menus/[id]/cook-active.tsx` | Large Done Chef button, screen-keep-awake, TTS |
| TTS voice | `apps/mobile` — reuse Speak a Recipe infrastructure | `expo-speech` (NOT @react-native-voice/voice) |
| Web TTS | Web Speech API (`window.speechSynthesis`) | Fallback for noisy kitchens |

---

## Type contracts — use these exactly, do not deviate

```typescript
// packages/ui/src/scheduler.types.ts

export type StepPhase = 'prep' | 'cook' | 'rest' | 'plate';
export type TimingConfidence = 'low' | 'medium' | 'high';
export type ServiceStyle = 'plated' | 'buffet';

/** Augmented recipe step — includes AI-inferred timing fields */
export interface RecipeStepWithTimings {
  id: string;
  recipe_id: string;
  step_number: number;
  instruction: string;
  duration_min: number | null;
  duration_max: number | null;
  is_passive: boolean;
  uses_oven: boolean;
  oven_temp_celsius: number | null;
  phase: StepPhase;
  timing_confidence: TimingConfidence;
  canonical_key: string | null;      // e.g. "sear:fish" — added in migration 084
}

/** Setup answers collected from the user before cooking starts */
export interface ChefSetup {
  chefs: string[];
  oven_count: 1 | 2 | 0;
  service_style: ServiceStyle;
  chefs_eating_at_table: boolean;
  serve_time: Date | null;
}

/** A single scheduled task assigned to a chef */
export interface ScheduledStep {
  step: RecipeStepWithTimings;
  recipe_title: string;
  recipe_id: string;
  course: string;
  chef_name: string;
  planned_start: Date | null;
  planned_end: Date | null;
  is_critical_path: boolean;
  parallel_with: string[];
}

/** The full cooking plan output by the scheduler */
export interface CookingPlan {
  menu_id: string;
  setup: ChefSetup;
  steps: ScheduledStep[];
  earliest_start: Date | null;
  oven_conflicts: OvenConflict[];
  warnings: PlanWarning[];
  total_duration_minutes: number;
}

export interface OvenConflict {
  step_a_id: string;
  step_b_id: string;
  temp_a: number;
  temp_b: number;
  resolution: 'sequenced';
  adds_minutes: number;
}

export interface PlanWarning {
  type: 'window_too_tight' | 'no_timing_data' | 'oven_overloaded';
  message: string;
  affected_step_ids: string[];
}

/** Live session state stored in DB and synced via Supabase Realtime */
export interface CookingSession {
  id: string;
  menu_id: string;
  user_id: string;
  setup: ChefSetup;
  plan: CookingPlan;
  status: 'briefing' | 'prep' | 'cooking' | 'complete';
  current_step_index: number;
  step_actuals: StepActual[];
  version: number;                  // optimistic lock for multi-device
  started_at: string;
  completed_at: string | null;
}

export interface StepActual {
  step_id: string;
  actual_start: string;
  actual_end: string | null;
  overrun_minutes: number;
}
```

---

## Data model — migrations

### Migrations 080, 081, 083 — ALREADY APPLIED ON SLUX
Do not re-run. See git history for SQL.

### Migration 084 — canonical_key on recipe_steps
**NOT YET APPLIED — run this next**

```sql
-- supabase/migrations/20260504_084_recipe_steps_canonical_key.sql

ALTER TABLE recipe_steps
  ADD COLUMN canonical_key              text,
  ADD COLUMN canonical_key_extracted_at timestamptz;

CREATE INDEX recipe_steps_canonical_key_idx ON recipe_steps (canonical_key)
  WHERE canonical_key IS NOT NULL;

COMMENT ON COLUMN recipe_steps.canonical_key IS
  'Canonical knowledge graph key e.g. sear:fish, simmer:sauce. '
  'Extracted by Haiku at promotion time. Cached to avoid re-extraction.';

ALTER TABLE cooking_action_timings
  DROP CONSTRAINT IF EXISTS cooking_action_timings_source_check;

ALTER TABLE cooking_action_timings
  ADD CONSTRAINT cooking_action_timings_source_check
  CHECK (source IN ('wikipedia','epicurious','inferred','observed','bulk_seed','cookbook'));
```

**AFTER APPLYING:**
```bash
ssh pilzner@slux "docker restart supabase-rest"
```

---

## Scheduler algorithm — rules the implementation must follow

### Constraint 1 — active step exclusivity (HARD)
Never assign two `is_passive = false` steps to the same chef at the same time.

### Constraint 2 — oven temperature conflict resolution (HARD)
- 1 oven + different temps: sequence them, add preheat cost (10 min)
- 2 ovens: parallel allowed
- `oven_temp_celsius` null on either step: assume conflict, sequence to be safe

### Constraint 3 — same oven temp = shareable
Two steps with identical `oven_temp_celsius` can share oven time simultaneously.

### Constraint 4 — rest steps absorb overrun (SCHEDULING SLACK)
`phase = 'rest'` steps have no upper bound. Use as shock absorbers before cascading.

### Constraint 5 — course sequencing in plated mode
Course N must plate before course N+1 starts cooking (unless passive/make-ahead).
Course order: starter → salad → main → other.

### Constraint 6 — chefs eating at table
All `plate` steps must complete before `serve_time`. No steps assigned after serve_time.

### Scheduler timing fallback chain
1. `cooking_action_timings` by `canonical_key` (knowledge graph — most reliable)
2. `recipe_steps.duration_max` (per-step AI inference)
3. Phase defaults: prep=10min, cook=15min, rest=60min, plate=5min
Never block. Always produce a plan.

### Re-plan on overrun
1. Record `overrun_minutes` in `step_actuals`
2. Recompute downstream planned times
3. Absorb into rest steps first
4. Cascade if absorption fails
5. Return updated CookingPlan

---

## AI timing inference — inferStepTimings()

**Model**: Haiku | **When**: Import time only, never on cook tap | **Cost**: Track in ai-cost.md

```
You are extracting cooking step timing metadata. Respond ONLY with valid JSON, no explanation.

Recipe step text: "{instruction}"

Return exactly this JSON structure:
{
  "duration_min": <integer minutes or null>,
  "duration_max": <integer minutes or null>,
  "is_passive": <true if chef can walk away, false if active attention required>,
  "uses_oven": <true/false>,
  "oven_temp_celsius": <integer or null>,
  "phase": <"prep" | "cook" | "rest" | "plate">,
  "timing_confidence": <"high" if explicit time stated, "medium" if implied, "low" if vague>
}

Rules:
- duration_min/max: extract explicit times. For ranges use both. For vague steps return null.
- is_passive: simmering/baking/resting = true. Searing/stirring/kneading = false.
- uses_oven: true only for oven steps. Stovetop = false.
- oven_temp_celsius: extract if stated. Convert F to C. Null if not stated.
- phase: prep=no heat. cook=heat on. rest=waiting/resting. plate=plating/serving.
- timing_confidence: high=explicit minutes. medium=method implies time. low=completely vague.
```

---

## Chef persona — tone of voice rules

1. **Always use the chef's name** — never "Chef A"
2. **Short sentences** — maximum two clauses
3. **State the action, not the system state**
4. **Time is concrete** — "You have 8 minutes" not "approximately 8 minutes"
5. **Conflicts are honest but calm**
6. **Ends with energy** — briefing: "Let's go." recovery: "Still on track." serve: "Done. Well cooked."
7. **Never say** — step numbers, percentages, queue position, "scheduler", "session"

### Chef briefing — Haiku prompt
```
You are Chef, a calm authoritative kitchen conductor. Generate the pre-service briefing.
Speak directly to the chefs by name. CookingPlan: {plan_json}
- Address each chef by name with their primary responsibilities
- Mention serve target time if set
- Flag oven conflicts honestly but calmly — one sentence max
- End with "Let's go."
- Maximum 120 words. No bullet points. Tone: head chef before service, not a chatbot.
```

### Step call-out format
`"{chef_name}: {brief_instruction}. {duration_hint}."`

---

## Setup flow

1. **Who's cooking** — name entry, add/remove pills, 1 chef minimum
2. **Ovens** — segmented: 1 oven / 2 ovens / None needed
3. **Serving style** — Plated courses / Buffet + "Eating at table?" toggle
4. **Serve time** — time picker (optional) + "Start by X" live hint

Web: modal overlay, progress dots, final button "Meet Chef"
Mobile: full-screen, large touch targets, expo-keep-awake from step 1

---

## Active cooking view — single card mode

**ONE card during cooking. No timeline. No step list. Always.**

```
[Chef name] — now
[Step instruction — large, readable from across kitchen]
[Sub-hint]
[Timer — large digits]

[Done, Chef]  ← full width primary button

Up next: [next step preview]
Parallel: [Chef B status]  [Oven status]
```

- "Done, Chef" records actual end time in step_actuals, advances index, speaks next step
- Handler named `handleStepComplete()` — v2 STT will call the same function
- Mobile: haptic feedback on tap
- Screen keep-awake: expo-keep-awake (mobile), Wake Lock API (web)

---

## TTS integration

### Mobile — expo-speech ONLY
```typescript
import * as Speech from 'expo-speech';
// Pattern from apps/mobile/app/recipe/[id].tsx:93-97
Speech.speak(text, { language: 'en' });
Speech.stop(); // before advancing to next step
```
**DO NOT use @react-native-voice/voice for TTS** — that is STT (v2 only)
**DO NOT create a duplicate voice utility** — find and reuse what exists

### Web — Web Speech API
```typescript
function speakChef(text: string) {
  if (!window.speechSynthesis) return;
  window.speechSynthesis.cancel();
  const utt = new SpeechSynthesisUtterance(text);
  utt.rate = 0.95;
  window.speechSynthesis.speak(utt);
}
```

---

## Data Quality Rules — Chef Scheduling Intelligence

**MANDATORY**: Read `.claude/agents/data-strategy.md` for any session touching
the knowledge graph, promotion pipeline, or step_actuals.

### step_actuals — collect but do NOT promote yet

`step_actuals` is collected on every "Done, Chef" tap. Data is too dirty at current
user volume to promote to the knowledge graph. Session integrity issues:
- App closed mid-cook → orphaned start times
- Forgotten taps → inflated durations
- Multi-device races → duplicate completions

**Promote step_actuals to knowledge graph ONLY when:**
1. User base > 1,000 monthly active cooks
2. Outlier removal pipeline is built
3. `observed_count >= 5` per canonical key

### What feeds the knowledge graph NOW (clean sources)

1. `schema.org` `prepTime`/`cookTime` from URL imports (Tier 1)
2. ISBN cookbook scans — `source = 'cookbook'` (Tier 1)
3. User step text corrections — re-queue inference on edit (Tier 1)
4. `inferStepTimings()` with `timing_confidence = 'high'` (Tier 2)
5. Recipe total validation — step sums within 20% of `cook_minutes` (Tier 2)
6. SQL aggregates from recipe corpus (Tier 3)

### Promotion pipeline (async, never synchronous)
```
inferStepTimings() → stores to recipe_steps
→ promoteToKnowledgeGraph() fires async (fire-and-forget)
→ Extracts canonical_key via Haiku (~$0.00003/step)
→ Validates against recipe.cook_minutes total
→ Upserts to cooking_action_timings
→ Increments inferred_count
```

**NEVER wire step_actuals into cooking_action_timings without outlier removal.**
**NEVER use USDA timing data** — results in overcooked food, not real kitchen standards.

---

## Pre-flight checklist

- [ ] Read `data-strategy.md` if touching knowledge graph or promotion pipeline
- [ ] `\d recipe_steps` on slux — check canonical_key column exists (migration 084)
- [ ] `\d cooking_sessions` — verify version column exists
- [ ] `\d cooking_action_timings` — verify table exists
- [ ] `deepsearch for expo-speech OR Speech.speak` — find TTS utility before writing
- [ ] `deepsearch for cooking session OR cookingPlan` — check current state
- [ ] Read `ai-cost.md`, `ui-guardian.md`, `data-flow.md`, `deployment.md`
- [ ] Check `feature-registry.md` for current build status

---

## Post-flight checklist

- [ ] `npx tsc --noEmit` in apps/web — 0 errors
- [ ] `npx tsc --noEmit` in apps/mobile — 0 errors (UIKit.tsx pre-existing acceptable)
- [ ] `docker restart supabase-rest` after any migration
- [ ] TTS tested — no duplicate voice utility created
- [ ] Active cooking card tested — timer, Done Chef, next step preview
- [ ] Verified step_actuals NOT promoted to knowledge graph
- [ ] `DONE.md` and `feature-registry.md` updated

---

## Known failure patterns — do not repeat

**NEVER** create a duplicate TTS utility — expo-speech already exists, reuse it
**NEVER** use @react-native-voice/voice for TTS — that is STT (v2)
**NEVER** show a timeline during active cooking — one card only
**NEVER** schedule two active steps for the same chef simultaneously
**NEVER** assume oven temp compatibility without checking — null = conflict
**NEVER** call briefing generation on step advance — once only at session start
**NEVER** hardcode "Chef A" or "Chef B" — always use ChefSetup.chefs names
**NEVER** skip docker restart supabase-rest after migrations
**NEVER** put CookingPlan in component useState on web — use Zustand or server component
**NEVER** promote step_actuals to knowledge graph at current user volume — dirty data
**NEVER** use USDA timing recommendations — food gets overcooked

---

## OMC agent responsibilities

| Agent | Builds | Reads |
|-------|--------|-------|
| Data | Migrations, DB queries, RLS, Realtime | kitchen-conductor.md, data-flow.md, data-strategy.md |
| AI | inferStepTimings(), chefBriefing(), promoteToKnowledgeGraph() | kitchen-conductor.md, ai-cost.md, data-strategy.md |
| Scheduler | CookingScheduler, TypeScript types, unit tests | kitchen-conductor.md |
| Web UI | Setup modal, briefing, active card | kitchen-conductor.md, ui-guardian.md, deployment.md |
| Mobile UI | Full-screen setup, active card, expo-speech, Realtime | kitchen-conductor.md, ui-guardian.md |
| Voice | buildStepCallout() templates, briefing prompt, TTS wiring | kitchen-conductor.md, ai-cost.md |

**Integration checkpoint**: all agents align on `packages/ui/src/scheduler.types.ts` before writing anything else.

---

## Feature status

**Status**: V1 BUILT — deployed to slux, APK built, sign-in crash being fixed
**Migrations applied**: 080, 081, 083
**Migration pending**: 084 (canonical_key) — run before promotion pipeline
**v1**: Scheduling + setup flow + active card + TTS + knowledge graph lookup
**v2**: STT "Chef, done" — handleStepComplete() hook already in place
**v3**: step_actuals learning loop — requires 1,000+ monthly active cooks first
**Next**: Fix sign-in crash → test birthday menu → migration 084 → promotion pipeline
**Data strategy**: `.claude/agents/data-strategy.md`
**Planning docs**: `.omc/planning/chef-kitchen-conductor.md`, `.omc/planning/chefsbook-strategy-2026.md`
