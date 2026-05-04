# Chef Kitchen Conductor — Implementation Plan

**Created:** 2026-05-03
**Status:** APPROVED (Consensus Review v2)
**Scope:** Kitchen orchestration with multi-chef scheduling, TTS briefing, single-card active cooking UI

---

## RALPLAN-DR Summary

### Principles (5)
1. **Single-card focus** — Active cooking shows ONE step at a time; no timeline or step list during cooking
2. **Named chef allocation** — Always use actual chef names from setup; never generic "Chef A/B"
3. **AI at import, not cook time** — Timing inference runs at recipe import; zero latency on Start Cooking
4. **Reuse existing patterns** — TTS via `expo-speech` (pattern in `recipe/[id].tsx:93-97`), Realtime via existing channel pattern
5. **Conservative scheduling** — Use duration_max for planning; rest steps absorb overrun first

### Decision Drivers (Top 3)
1. **Kitchen UX** — Hands-free, voice-forward, single focus point in a chaotic environment
2. **Multi-device sync** — Family cooking together on multiple phones needs Realtime with crash recovery
3. **Cost efficiency** — Haiku for timing inference (~$0.0003/step), templates for step call-outs (free)

### Viable Options

#### Option A: Full Scheduler in packages/ui (CHOSEN)
**Approach:** Pure TypeScript scheduler with reverse-scheduling algorithm, no framework dependencies
**Pros:**
- Fully unit-testable in isolation
- Shared between web and mobile
- No runtime dependencies on React/Expo
- Instant re-plan on overrun (no network latency)
**Cons:**
- More upfront design work
- Need to carefully handle Date math for timezone safety
- Re-planned state must be synced to DB for crash recovery

#### Option B: Server-side scheduling API
**Approach:** POST /api/cooking/schedule endpoint generates plan server-side
**Pros:**
- Could use heavier algorithms
- Server can access more context
- Authoritative plan state in DB
**Cons:**
- Network latency before cooking starts
- Harder to re-plan on overrun without round-trip (~50-100ms per re-plan)
**Invalidation:** Real-time re-planning on step overrun requires client-side scheduler; while 50-100ms is not perceptually slow, the complexity of maintaining consistent state across re-plan requests outweighs benefits. Hybrid approach (client re-plan + debounced DB sync) captures both benefits.

---

## Requirements Summary

### Core Functionality
1. **Setup Flow** (4 steps): Chef names → Oven count (1/2/0) → Service style (plated/buffet) + eating toggle → Serve time
2. **Scheduler**: Reverse-schedule from serve time, allocate steps to named chefs, detect oven conflicts
3. **Chef Briefing**: Haiku-generated spoken overview before cooking starts
4. **Active Cooking**: Single-card view with current step, timer, "Done, Chef" button
5. **Multi-device Sync**: Supabase Realtime on cooking_sessions table with optimistic locking
6. **Crash Recovery**: Re-planned schedule persisted to DB after every re-computation

### Constraints (from kitchen-conductor.md)
- Never assign 2 active (is_passive=false) steps to same chef simultaneously
- Oven conflicts: 1 oven = sequence; 2 ovens = parallel allowed
- Rest steps (phase='rest') absorb overrun slack before cascading
- Plated mode: course N must plate before course N+1 starts cooking (full 9-course order)
- TTS: Briefing via Haiku AI; step call-outs via templates (no AI per step)

---

## Acceptance Criteria (Testable)

### Migration 080 (recipe_steps timing)
- [ ] `\d recipe_steps` on slux shows all 8 new columns: duration_min, duration_max, is_passive, uses_oven, oven_temp_celsius, phase, timing_confidence, timings_inferred_at
- [ ] Existing rows have default values (is_passive=false, uses_oven=false, phase='cook', timing_confidence='low')
- [ ] No migration errors in psql output

### Migration 081 (cooking_sessions)
- [ ] `\d cooking_sessions` shows table with all columns including `version` column
- [ ] RLS policies exist: select/insert/update restricted to user_id = auth.uid()
- [ ] `SELECT * FROM pg_publication_tables WHERE pubname='supabase_realtime'` includes cooking_sessions
- [ ] `docker restart supabase-rest` completed after both migrations

### AI Timing Inference
- [ ] `inferStepTimings("bake for 30 minutes at 180°C")` returns `{duration_min:30, duration_max:30, is_passive:true, uses_oven:true, oven_temp_celsius:180, phase:'cook', timing_confidence:'high'}`
- [ ] `inferStepTimings("season to taste")` returns `{duration_min:null, duration_max:null, is_passive:false, uses_oven:false, oven_temp_celsius:null, phase:'prep', timing_confidence:'low'}`
- [ ] Cost logged via logAiCall as 'infer_step_timings/haiku'
- [ ] Integration: runs in `.then()` callback of `rewriteRecipeSteps()` in `saveWithModeration.ts`, NOT in parallel

### Scheduler
- [ ] `npx tsc --noEmit` passes in packages/ui with 0 errors
- [ ] `ScheduledStep.course` type is `MenuCourse` imported from `@chefsbook/db` (9 values, not 4)
- [ ] Unit test: solo chef with 5 steps produces valid CookingPlan
- [ ] Unit test: 2 chefs, no active step overlap per chef
- [ ] Unit test: oven conflict with 1 oven sequences steps (adds_minutes > 0)
- [ ] Unit test: oven conflict with 2 ovens allows parallel
- [ ] Unit test: plated mode enforces full COURSE_ORDER sequencing (starter→soup→salad→main→side→cheese→dessert→drink→other)
- [ ] Unit test: rest step absorbs 5min overrun without cascade
- [ ] `buildStepCallout(step, 'Alex')` returns "Alex: sear the salmon. About 4 minutes, stay close." (specific duration text, not vague)
- [ ] For low-confidence timings: `buildStepCallout()` returns "Alex: season to taste. Take your time."

### Chef Briefing
- [ ] `generateChefBriefing(plan)` returns <= 120 words (truncate or retry if exceeded)
- [ ] Briefing addresses each chef by name
- [ ] Briefing ends with "Let's go."
- [ ] Cost logged as 'chef_briefing/haiku'

### DB Queries
- [ ] `getMenuWithSteps(menuId)` returns menu with recipe_steps including all 8 timing columns
- [ ] `persistRecomputedPlan(sessionId, plan, expectedVersion)` updates plan JSONB and increments version
- [ ] `subscribeToCookingSession()` re-fetches on any change (including plan JSONB updates)

### Web UI
- [ ] Setup modal appears on "Start Cooking" button click (not old side panel)
- [ ] Step 1: can add/remove chef name pills; at least 1 required; validation error if empty
- [ ] Step 2: segmented control for 1/2/none ovens; "None needed" grayed out if any step uses oven
- [ ] Step 3: plated/buffet cards + "Eating at table?" toggle
- [ ] Step 4: time picker + "Start by X" hint updates live based on scheduler calculation
- [ ] Final button: "Meet Chef" → calls createCookingPlan + createCookingSession + navigates to briefing
- [ ] Briefing screen: text displayed + spoken via Web Speech API (with fallback if API unavailable)
- [ ] Active cooking: single card with step, timer, "Done, Chef" button
- [ ] "Done, Chef" advances to next step, speaks it, persists re-plan to DB
- [ ] `npx tsc --noEmit` passes in apps/web

### Mobile UI
- [ ] Route structure: `cook-menu/[id]/index.tsx` (renamed from `cook-menu/[id].tsx`)
- [ ] Full-screen setup flow (4 screens as siblings in `cook-menu/[id]/` folder)
- [ ] expo-keep-awake active during entire cooking session
- [ ] Briefing spoken via `expo-speech` on mount (pattern from `recipe/[id].tsx:93-97`)
- [ ] Active card: large "Done, Chef" button with haptic feedback
- [ ] TTS speaks next step on advance using `expo-speech` (NOT `expo-speech-recognition` which is STT)
- [ ] Supabase Realtime subscription syncs full session (plan + currentStepIndex)
- [ ] Optimistic lock: update uses `WHERE version = $expected`, retries on conflict
- [ ] `npx tsc --noEmit` passes in apps/mobile

### Multi-device Sync
- [ ] Device A marks step 3 done → Device B shows step 4 within 2 seconds
- [ ] Concurrent updates: Device A and B both tap "Done, Chef" → one succeeds, other retries with fresh state
- [ ] App crash recovery: close app mid-cook, reopen → session resumes with current re-planned state

---

## Implementation Steps

### Phase 1: Foundation (Parallel)

#### 1A. Migration 080 — recipe_steps timing
**File:** `supabase/migrations/20260503_080_recipe_steps_timing.sql`
```sql
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
```
**Apply:** `ssh pilzner@slux "docker exec supabase-db psql -U postgres -f /opt/luxlabs/chefsbook/repo/supabase/migrations/20260503_080_recipe_steps_timing.sql"`

#### 1B. Migration 081 — cooking_sessions (with version column)
**File:** `supabase/migrations/20260503_081_cooking_sessions.sql`
```sql
CREATE TABLE cooking_sessions (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  menu_id            uuid NOT NULL REFERENCES menus(id) ON DELETE CASCADE,
  user_id            uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  setup              jsonb NOT NULL,
  plan               jsonb NOT NULL,
  status             text NOT NULL DEFAULT 'briefing'
                       CHECK (status IN ('briefing','prep','cooking','complete')),
  current_step_index integer NOT NULL DEFAULT 0,
  step_actuals       jsonb NOT NULL DEFAULT '[]',
  version            integer NOT NULL DEFAULT 1,  -- optimistic lock for multi-device
  started_at         timestamptz NOT NULL DEFAULT now(),
  completed_at       timestamptz,
  created_at         timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE cooking_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "cooking_sessions_select" ON cooking_sessions
  FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "cooking_sessions_insert" ON cooking_sessions
  FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "cooking_sessions_update" ON cooking_sessions
  FOR UPDATE USING (user_id = auth.uid());

ALTER PUBLICATION supabase_realtime ADD TABLE cooking_sessions;
```
**Apply:** Same pattern as 080
**Post-migration:** `ssh pilzner@slux "docker restart supabase-rest"`

#### 1C. Type Contracts
**File:** `packages/ui/src/scheduler.types.ts`
```typescript
import { MenuCourse, COURSE_ORDER } from '@chefsbook/db';

export type StepPhase = 'prep' | 'cook' | 'rest' | 'plate';
export type TimingConfidence = 'low' | 'medium' | 'high';
export type ServiceStyle = 'plated' | 'buffet';

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
}

export interface ChefSetup {
  chefs: string[];
  oven_count: 1 | 2 | 0;
  service_style: ServiceStyle;
  chefs_eating_at_table: boolean;
  serve_time: Date | null;
}

export interface ScheduledStep {
  step: RecipeStepWithTimings;
  recipe_title: string;
  recipe_id: string;
  course: MenuCourse;  // CRITICAL: imported from @chefsbook/db, not redefined
  chef_name: string;
  planned_start: Date | null;
  planned_end: Date | null;
  is_critical_path: boolean;
  parallel_with: string[];
}

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

export interface CookingSession {
  id: string;
  menu_id: string;
  user_id: string;
  setup: ChefSetup;
  plan: CookingPlan;
  status: 'briefing' | 'prep' | 'cooking' | 'complete';
  current_step_index: number;
  step_actuals: StepActual[];
  version: number;  // optimistic lock
  started_at: string;
  completed_at: string | null;
}

export interface StepActual {
  step_id: string;
  actual_start: string;
  actual_end: string | null;
  overrun_minutes: number;
}

// Re-export for convenience
export { MenuCourse, COURSE_ORDER };
```

**Export from `packages/ui/src/index.ts`:** Add all scheduler types

### Phase 2: AI + Scheduler (Parallel after Phase 1)

#### 2A. AI Timing Inference
**File:** `packages/ai/src/inferStepTimings.ts`
- Haiku model call with exact prompt from kitchen-conductor.md
- Returns typed object matching RecipeStepWithTimings fields
- Export from `packages/ai/src/index.ts`

**Integration point:** `apps/web/lib/saveWithModeration.ts`
- Find the `rewriteRecipeSteps()` call (fire-and-forget)
- In the `.then()` callback of rewriteRecipeSteps, call `inferStepTimings()` for each step
- CRITICAL: must run AFTER rewrite completes (timing inference reads rewritten text)
```typescript
// In saveWithModeration.ts after recipe steps are saved:
rewriteRecipeSteps(recipeId, steps).then(async (rewrittenSteps) => {
  // Timing inference runs on REWRITTEN text
  for (const step of rewrittenSteps) {
    const timings = await inferStepTimings(step.instruction);
    if (timings) {
      await updateStepTimings(step.id, timings);
    }
  }
});
```

#### 2B. Chef Briefing
**File:** `packages/ai/src/chefBriefing.ts`
- Haiku model with exact prompt from kitchen-conductor.md
- Input: CookingPlan JSON
- Output: spoken briefing string
- Word count check: if > 120 words, truncate at sentence boundary + add "Let's go."

#### 2C. Scheduler
**File:** `packages/ui/src/scheduler.ts`
Functions to implement:
- `createCookingPlan(menu: MenuWithSteps, setup: ChefSetup): CookingPlan`
- `recomputeFromOverrun(plan: CookingPlan, stepId: string, actualEndTime: Date): CookingPlan`
- `buildStepCallout(step: ScheduledStep, chefName: string): string`

Algorithm (using full COURSE_ORDER from @chefsbook/db):
1. Collect all steps from all recipes with their timings
2. Group by phase: plate → cook → prep (reverse order)
3. For plated mode, enforce COURSE_ORDER sequencing (all 9 courses)
4. For each step, calculate latest_start from serve_time working backwards
5. Detect oven conflicts, sequence if 1 oven
6. Allocate steps to chefs: round-robin for non-overlapping active steps
7. Mark critical path (zero float): passive step float ≠ 0 if another chef available
8. Return CookingPlan

`buildStepCallout()` format:
- High confidence: "Alex: sear the salmon. About 4 minutes, stay close."
- Low/null confidence: "Alex: season to taste. Take your time."

### Phase 3: DB Queries
**File:** `packages/db/src/queries/cookingSessions.ts`

```typescript
import { supabase } from '../client';
import type { CookingPlan, ChefSetup, CookingSession } from '@chefsbook/ui';

// NEW: Fetch menu with full recipe steps including timing columns
export async function getMenuWithSteps(menuId: string) {
  const { data, error } = await supabase
    .from('menus')
    .select(`
      *,
      menu_items (
        *,
        recipe:recipes (
          id, title, description, prep_minutes, cook_minutes, servings, image_url,
          recipe_steps (
            id, step_number, instruction, timer_minutes,
            duration_min, duration_max, is_passive, uses_oven,
            oven_temp_celsius, phase, timing_confidence
          )
        )
      )
    `)
    .eq('id', menuId)
    .single();

  if (error) throw error;
  return data;
}

export async function createCookingSession(
  menuId: string,
  userId: string,
  setup: ChefSetup,
  plan: CookingPlan
): Promise<CookingSession> {
  const { data, error } = await supabase
    .from('cooking_sessions')
    .insert({
      menu_id: menuId,
      user_id: userId,
      setup,
      plan,
      status: 'briefing',
      version: 1,
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function getCookingSession(id: string): Promise<CookingSession | null> {
  const { data, error } = await supabase
    .from('cooking_sessions')
    .select('*')
    .eq('id', id)
    .single();

  if (error) {
    if (error.code === 'PGRST116') return null;
    throw error;
  }
  return data;
}

// Optimistic lock update — fails if version mismatch
export async function updateCookingSession(
  id: string,
  updates: Partial<Pick<CookingSession, 'status' | 'current_step_index' | 'step_actuals' | 'plan' | 'completed_at'>>,
  expectedVersion: number
): Promise<{ success: boolean; session: CookingSession | null }> {
  const { data, error } = await supabase
    .from('cooking_sessions')
    .update({
      ...updates,
      version: expectedVersion + 1,
    })
    .eq('id', id)
    .eq('version', expectedVersion)  // optimistic lock
    .select()
    .single();

  if (error) {
    if (error.code === 'PGRST116') {
      // Version mismatch — another device updated first
      return { success: false, session: null };
    }
    throw error;
  }
  return { success: true, session: data };
}

// Persist re-planned schedule (called after every recomputeFromOverrun)
export async function persistRecomputedPlan(
  sessionId: string,
  plan: CookingPlan,
  expectedVersion: number
): Promise<boolean> {
  const result = await updateCookingSession(sessionId, { plan }, expectedVersion);
  return result.success;
}

// Realtime subscription
export function subscribeToCookingSession(
  sessionId: string,
  callback: (session: CookingSession) => void
) {
  return supabase
    .channel(`cooking-session-${sessionId}`)
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'cooking_sessions', filter: `id=eq.${sessionId}` },
      async () => {
        const session = await getCookingSession(sessionId);
        if (session) callback(session);
      }
    )
    .subscribe();
}
```

Export from `packages/db/src/index.ts`

### Phase 4: Web UI

#### 4A. Setup Modal
**File:** `apps/web/app/dashboard/menus/[id]/cook/page.tsx` (new)
- 4-step modal with progress dots
- ChefSetup state accumulates across steps
- Step 2: gray out "None needed" if any recipe step has `uses_oven: true`
- Final "Meet Chef" button calls createCookingPlan + createCookingSession
- Web Speech API existence check before TTS

#### 4B. Briefing Screen
**File:** `apps/web/app/dashboard/menus/[id]/cook/briefing/page.tsx` (new)
- Display briefing text
- Web Speech API speaks on mount (with fallback: visual-only if API unavailable)
- "Start cooking" button → active view

#### 4C. Active Cooking View
**File:** `apps/web/app/dashboard/menus/[id]/cook/active/page.tsx` (new)
- Single card: chef name, instruction, timer, "Done, Chef" button
- `handleStepComplete()` function:
  1. Record actual time in step_actuals
  2. Call `recomputeFromOverrun()` if overrun > 2 min
  3. Call `persistRecomputedPlan()` to sync re-plan to DB
  4. Advance current_step_index via `updateCookingSession()`
  5. Speak next step via Web Speech API
- Wake Lock API for screen keep-awake
- Store cooking state in Zustand (NOT useState) to avoid hydration issues

### Phase 5: Mobile UI

#### 5A. Route Structure Migration (CRITICAL)
**Before any new files:**
1. Rename `apps/mobile/app/cook-menu/[id].tsx` → `apps/mobile/app/cook-menu/[id]/index.tsx`
2. This converts the route from file-based to folder-based, allowing sibling routes

#### 5B. Setup Flow
**Files (all siblings in `apps/mobile/app/cook-menu/[id]/`):**
- `setup.tsx` — Step 1: Chef names (text input + pill chips)
- `setup-ovens.tsx` — Step 2: Oven count (large segmented buttons)
- `setup-style.tsx` — Step 3: Service style (card options + toggle)
- `setup-time.tsx` — Step 4: Serve time (time picker + "Start by X" hint)

#### 5C. Briefing Screen
**File:** `apps/mobile/app/cook-menu/[id]/briefing.tsx`
- Dark background, large text
- TTS via `expo-speech` on mount (reuse pattern from `apps/mobile/app/recipe/[id].tsx:93-97`):
  ```typescript
  import * as Speech from 'expo-speech';
  
  useEffect(() => {
    Speech.speak(briefingText, { language: 'en' });
    return () => Speech.stop();
  }, [briefingText]);
  ```
- "Start cooking" button → active view

#### 5D. Active Cooking View
**File:** `apps/mobile/app/cook-menu/[id]/active.tsx`
- expo-keep-awake
- Large "Done, Chef" button with haptic via `expo-haptics`
- `handleStepComplete()` same logic as web, plus:
  - On version conflict: refetch session, show toast "Another device updated", resume with fresh state
- Supabase Realtime subscription via `subscribeToCookingSession()`

### Phase 6: Integration + Wiring

1. Replace "Start Cooking" button destinations in:
   - `apps/web/app/dashboard/menus/[id]/page.tsx` → `/dashboard/menus/[id]/cook`
   - `apps/mobile/app/menu/[id].tsx` → `/cook-menu/[id]/setup`

2. Add i18n keys to all 5 locale files (en/fr/es/it/de):
   - `chef.setup.*` (names, ovens, style, time, meet_chef)
   - `chef.briefing.*` (lets_go, start_cooking)
   - `chef.active.*` (done_chef, next_step, running_late, another_device_updated)

3. Update ai-cost.md with:
   - inferStepTimings: Haiku ~$0.0003/step
   - chefBriefing: Haiku ~$0.001/session

4. Update feature-registry.md:
   - Add "Chef / Kitchen Conductor | LIVE | packages/ui/scheduler.*, packages/ai/inferStepTimings.ts, apps/*/cook-menu | CHEF-BUILD | Multi-chef scheduling, TTS briefing, single-card active cooking"

---

## Risks and Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Timing inference accuracy | Steps scheduled wrong | Use duration_max (conservative); show ~prefix for low confidence; allow manual override in v2 |
| Oven conflict detection misses edge cases | Food burns/undercooks | Null oven_temp = treat as conflict; sequence to be safe; add warning in briefing |
| Multi-device sync race condition | Chefs see different steps | Optimistic lock via `version` column; retry with fresh state on conflict; toast notification |
| App crash mid-cook | Session state lost | Re-plan persisted to DB after every `recomputeFromOverrun()`; recovery loads from DB |
| TTS not working on some devices | Chef can't hear instructions | Visual fallback always present; check API existence; test on multiple Android versions |
| Re-plan on overrun cascades badly | Serve time blown | Rest steps absorb first; warn early if window genuinely lost; show recovery card |

---

## Verification Steps

### Post-Migration Verification
```bash
# Verify recipe_steps columns
ssh pilzner@slux "docker exec supabase-db psql -U postgres -c '\d recipe_steps'" | grep -E "duration|passive|oven|phase|confidence"

# Verify cooking_sessions table (including version column)
ssh pilzner@slux "docker exec supabase-db psql -U postgres -c '\d cooking_sessions'" | grep version

# Verify Realtime enabled
ssh pilzner@slux "docker exec supabase-db psql -U postgres -c \"SELECT * FROM pg_publication_tables WHERE pubname='supabase_realtime' AND tablename='cooking_sessions'\""
```

### TypeScript Verification
```bash
cd packages/ui && npx tsc --noEmit
cd apps/web && npx tsc --noEmit
cd apps/mobile && npx tsc --noEmit
```

### Manual Testing Sequence
1. Import a recipe with steps containing explicit times → verify timing fields populated in DB
2. Create a menu with 3+ recipes spanning multiple courses
3. Tap Start Cooking → verify setup modal appears (not old side panel)
4. Complete setup with 2 chef names, 1 oven, plated, serve time 2h out
5. Verify briefing speaks and addresses both chefs by name
6. Verify active view shows single card, not timeline
7. Tap "Done, Chef" → verify next step spoken, card advances
8. Force late finish (wait past timer) → verify re-plan persists to DB
9. **Multi-device test:** Open same session on 2 devices → verify sync within 2 seconds
10. **Crash recovery test:** Force-close app mid-cook → reopen → verify session resumes with current state

---

## ADR: Chef Kitchen Conductor Architecture

### Decision
Implement kitchen orchestration as a client-side scheduler in packages/ui with AI timing inference at import time, Supabase Realtime for multi-device sync, and optimistic locking for conflict resolution.

### Drivers
1. Zero latency on "Start Cooking" tap — timing data pre-computed at import
2. Real-time re-planning on overrun without server round-trip
3. Multi-device sync for family cooking together
4. Crash recovery via persisted re-plan state
5. Cost efficiency — Haiku for inference, templates for TTS

### Alternatives Considered
- **Server-side scheduling API**: Rejected due to latency on re-plan; hybrid approach (client re-plan + DB sync) captures benefits of both
- **Step timings as user input**: Rejected — too much friction; AI inference is good enough
- **Separate voice assistant service**: Rejected — expo-speech/Web Speech API sufficient for v1

### Why Chosen
Client-side scheduler with pre-computed timings gives the best UX for a time-sensitive cooking context. The scheduler can instantly re-plan on overrun without network latency. Optimistic locking prevents race conditions without complex distributed consensus. Supabase Realtime (already used for shopping lists) provides reliable multi-device sync.

### Consequences
- Must cache timing inference results to DB at import time
- Scheduler complexity lives in packages/ui (need good test coverage)
- Mobile and web share scheduler code (good for consistency)
- Version column adds small overhead to every update

### Follow-ups
- v2: Add STT wake-word "Chef, done" calling handleStepComplete()
- v3: Learning loop — compare actual vs planned timings, offer to update estimates
- Future: Smart oven integration (actual temp feedback)

---

## Changelog
- 2026-05-03 v1: Initial plan created from kitchen-conductor.md spec
- 2026-05-03 v2: Incorporated Architect + Critic feedback:
  - CRITICAL: Fixed course type to import `MenuCourse` from `@chefsbook/db` (9 courses, not 4)
  - CRITICAL: Added `getMenuWithSteps()` query joining recipe_steps with timing columns
  - CRITICAL: Fixed TTS to use `expo-speech` pattern from recipe/[id].tsx (not @react-native-voice/voice)
  - MAJOR: Added route structure migration (rename [id].tsx to [id]/index.tsx)
  - MAJOR: Added crash recovery via `persistRecomputedPlan()` after every re-computation
  - MAJOR: Added optimistic locking via `version` column in cooking_sessions
  - MAJOR: Fixed integration timing — inferStepTimings runs AFTER rewriteRecipeSteps completes
  - Added specific acceptance criteria for multi-device sync and crash recovery
  - Clarified buildStepCallout() format for high/low confidence timings
