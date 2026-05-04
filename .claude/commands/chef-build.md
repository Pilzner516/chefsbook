# Chef Kitchen Conductor — Full Build Orchestration

You are Ralph, the persistent orchestrator for the Chef / Kitchen Conductor feature build.
Do not stop until all phases are verified complete. Manage the full sequence below.
If context fills, resume from the last completed phase checkpoint.

---

## Before anything else — mandatory reading

Read ALL of these agent files before writing a single line of code or running any command.
Do not skip any. These exist because the same bugs have been introduced and fixed multiple times.

1. `.claude/agents/kitchen-conductor.md` — the complete Chef feature spec, types, DB schema, constraints, tone of voice rules, known failure patterns
2. `.claude/agents/testing.md` — mandatory every session
3. `.claude/agents/feature-registry.md` — verify Chef / Kitchen Conductor not already partially built
4. `.claude/agents/ui-guardian.md` — mandatory before any component work
5. `.claude/agents/ai-cost.md` — mandatory before touching packages/ai (inferStepTimings runs on every imported recipe step — track the cost)
6. `.claude/agents/data-flow.md` — mandatory before any Supabase query or Zustand store
7. `.claude/agents/deployment.md` — mandatory before touching apps/web

---

## Phase 0 — Discovery (run before any planning or code)

Run these deepsearches. Study results carefully. Do not skip.

```
deepsearch for recipe_steps table usage — find every query and type that references recipe_steps so the migration does not break existing code
```

```
deepsearch for speak OR speakText OR speechSynthesis OR expo-speech OR voice utility — find the existing TTS infrastructure from Speak a Recipe. We REUSE this, never create a new one.
```

```
deepsearch for Supabase Realtime OR subscription OR channel — find existing Realtime patterns in the codebase to follow the same conventions
```

```
deepsearch for Start Cooking OR cooking session OR cookingPlan OR kitchen — verify no partial implementation already exists
```

```
deepsearch for menus OR menu_recipes — understand course assignment structure before building the scheduler
```

After deepsearch: verify the latest migration number in `supabase/migrations/` — confirm next available numbers are 081 and 082. If not, adjust accordingly.

Record findings before proceeding. Do not guess at existing patterns — the deepsearch tells you what's actually there.

---

## Phase 1 — Plan (ralplan before any code)

```
ralplan "Build the Chef kitchen conductor feature for ChefsBook.

WHAT IT IS:
Chef is a kitchen orchestration system. When a user taps Start Cooking on a menu, Chef generates a reverse-scheduled cooking plan across all dishes, allocates steps to named chefs by name, detects oven temperature conflicts, presents a spoken briefing, and guides the team step-by-step via a single-card UI with TTS voice call-outs.

The app persona is 'Chef' — calm, authoritative, addresses each cook by name. Future v2: 'Chef, done — what's next?' wake-word voice input.

DECISIONS ALREADY MADE (do not re-open these):
- Chef names asked upfront in setup step 1 — no generic Chef A/B labels anywhere
- 4-step setup flow: names → ovens → serving style → serve time
- Oven conflicts resolved by silent sequencing, surface warning only if window impossible
- Burner question dropped — default 3 internally
- TTS in v1 (briefing + step call-outs), STT in v2
- Active cooking view = single card only — no timeline or step list during cooking
- Done button label is 'Done, Chef' — primes for v2 voice command
- Setup: modal on web, full-screen on mobile (primary flow, replaces side panel)
- AI timing inference runs at import/scan time, cached to DB — no latency on first Start Cooking tap

BUILD SCOPE — 6 components to build:

1. DB MIGRATION 081 — add to recipe_steps:
   duration_min (integer nullable), duration_max (integer nullable), is_passive (boolean default false),
   uses_oven (boolean default false), oven_temp_celsius (integer nullable),
   phase (text enum: prep/cook/rest/plate, default cook),
   timing_confidence (text enum: low/medium/high, default low),
   timings_inferred_at (timestamptz nullable)

2. DB MIGRATION 082 — create cooking_sessions table:
   id, menu_id (FK menus), user_id (FK auth.users), setup (jsonb), plan (jsonb),
   status (text enum: briefing/prep/cooking/complete), current_step_index (integer default 0),
   step_actuals (jsonb default []), started_at (timestamptz), completed_at (timestamptz nullable)
   RLS: user_id = auth.uid() for all operations
   Enable Supabase Realtime: ALTER PUBLICATION supabase_realtime ADD TABLE cooking_sessions

3. AI TIMING — packages/ai/src/inferStepTimings.ts
   Haiku model. Input: step instruction text. Output: duration_min, duration_max, is_passive,
   uses_oven, oven_temp_celsius, phase, timing_confidence.
   Called at import/scan time for every step. Results stored to DB. Never called at cook time.

4. SCHEDULER — packages/ui/src/scheduler.ts + scheduler.types.ts
   Pure TypeScript, zero framework dependencies, fully unit testable.
   Input: MenuWithRecipes + ChefSetup. Output: CookingPlan.
   Algorithm: reverse-schedule from serve time, find critical path, allocate to chef lanes.
   Hard constraints: never assign two active (is_passive=false) steps to same chef simultaneously;
   oven temp conflicts must sequence (1 oven) or allow parallel (2 ovens);
   rest steps absorb overrun slack before cascading; plated mode enforces course sequencing.

5. WEB UI — apps/web
   Replace Start Cooking side panel with: 4-step setup modal (names/ovens/serving/time),
   Chef briefing screen, single-card active cooking view with timer and Done Chef button.
   Read ui-guardian.md and deployment.md.

6. MOBILE UI — apps/mobile
   Full-screen 4-step setup flow, Chef briefing screen with TTS,
   single-card active cooking view (large Done Chef button, screen-keep-awake via expo-keep-awake,
   TTS step read-outs using EXISTING speak infrastructure found in Phase 0 deepsearch,
   Supabase Realtime subscription for multi-device kitchen sync).

TYPE CONTRACTS (exact — do not deviate):
All types defined in kitchen-conductor.md: RecipeStepWithTimings, ChefSetup, CookingPlan,
ScheduledStep, CookingSession, StepActual, OvenConflict, PlanWarning.
Types file ships first. All other components depend on it.

CHEF VOICE RULES (from kitchen-conductor.md):
Always use chef name. Short sentences. State action not system state.
Briefing generated by Haiku from CookingPlan. Per-step call-outs are templates, not AI-generated.
Done button is 'Done, Chef'. Future STT hook is handleStepComplete() — both button and voice call this.

GOTCHAS FROM kitchen-conductor.md (do not repeat):
- docker restart supabase-rest after EVERY migration
- Never create a duplicate TTS utility — reuse what deepsearch found
- Never show timeline during active cooking — single card only
- Never hardcode Chef A/B — always use ChefSetup.chefs names
- Never put CookingPlan in useState on web — use server component or Zustand store
- Never call Haiku for per-step TTS copy — templates only
- React pinned to 19.1.0 across monorepo — do not upgrade"
```

Review the ralplan output carefully before approving. If anything conflicts with `kitchen-conductor.md`, reject and re-plan.

---

## Phase 2 — Foundation (data + AI + scheduler in parallel)

After ralplan is approved, spawn the foundational layer. These three are independent — build simultaneously.

```
/team 3:executor "Build in parallel — do not wait for each other:

AGENT 1 — Data layer:
Read kitchen-conductor.md and data-flow.md first.
(1) Write supabase/migrations/081_recipe_steps_timing.sql — exact SQL in kitchen-conductor.md.
(2) Write supabase/migrations/082_cooking_sessions.sql — exact SQL in kitchen-conductor.md including RLS policies and ALTER PUBLICATION supabase_realtime.
(3) Apply both migrations on slux: ssh pilzner@slux 'docker exec supabase-db psql -U postgres -f /opt/luxlabs/chefsbook/repo/supabase/migrations/081_recipe_steps_timing.sql'
(4) Run: ssh pilzner@slux 'docker restart supabase-rest' — MANDATORY after every migration.
(5) Write packages/db/src/cookingSessions.ts — CRUD and Realtime subscription for cooking_sessions. Follow existing patterns found in deepsearch Phase 0.
(6) Verify with: ssh pilzner@slux 'docker exec supabase-db psql -U postgres -c \"\d recipe_steps\"' and \"\d cooking_sessions\"

AGENT 2 — AI timing inference:
Read kitchen-conductor.md and ai-cost.md first.
(1) Write packages/ai/src/inferStepTimings.ts using Haiku model.
    Exact Haiku prompt is in kitchen-conductor.md — use it verbatim.
    Input: step instruction string. Output: { duration_min, duration_max, is_passive, uses_oven, oven_temp_celsius, phase, timing_confidence }.
    Returns null fields rather than guessing for vague steps.
(2) Write packages/ai/src/chefBriefing.ts using Haiku model.
    Exact Haiku prompt in kitchen-conductor.md. Input: CookingPlan JSON. Output: spoken briefing string.
    Max 120 words. Always addresses chefs by name. Ends with 'Let's go.'
(3) Hook inferStepTimings() into the existing recipe import/scan pipeline so it runs automatically on every imported recipe step and stores results to DB. Find the pipeline location via deepsearch results from Phase 0.
(4) Test with 3 real recipe step strings covering: explicit time ('bake 30 min'), implied time ('sear until golden'), vague ('season to taste').
(5) Update ai-cost.md with estimated cost per recipe (steps × Haiku input/output tokens).

AGENT 3 — Scheduler:
Read kitchen-conductor.md only.
(1) Write packages/ui/src/scheduler.types.ts — exact types verbatim from kitchen-conductor.md. This is the contract all other agents depend on. Ship it first.
(2) Write packages/ui/src/scheduler.ts — CookingScheduler class or function.
    Implement all 6 constraints from kitchen-conductor.md exactly.
    Critical path: zero-float steps marked is_critical_path true.
    Re-plan function: recomputeFromOverrun(plan, stepId, actualEndTime) → updated CookingPlan.
    buildStepCallout(step, chefName) → string for TTS — template-based, no AI call.
(3) Write unit tests covering: solo chef single dish, 2 chefs birthday menu, oven temp conflict 1 oven, oven temp conflict 2 ovens, plated course sequencing, rest step slack absorption, overrun re-plan.
(4) npx tsc --noEmit in packages/ui — must pass before done."
```

**Checkpoint after Phase 2**: All three agents done. Migrations applied and verified on slux. Types file exists and compiles. Scheduler unit tests pass. Only then proceed to Phase 3.

---

## Phase 3 — UI (web + mobile in parallel)

```
/team 2:executor "Build in parallel:

AGENT 1 — Web UI:
Read kitchen-conductor.md, ui-guardian.md, deployment.md first.
Import CookingPlan, ChefSetup types from packages/ui/src/scheduler.types.
Import CookingScheduler from packages/ui/src/scheduler.
Import chefBriefing from packages/ai/src/chefBriefing.
Import cookingSessions queries from packages/db/src/cookingSessions.

Build at apps/web/app/dashboard/menus/[id]/cook/:
(1) Setup modal — 4 steps: names (add/remove chef pills), ovens (segmented 1/2/none), serving style (plated/buffet + eating toggle), serve time (time picker + show 'start by X' hint live). Final button: 'Meet Chef'. Modal overlay, blocks background, progress dots across top.
(2) Briefing screen — full width, Chef's spoken text displayed, single 'Start cooking' button. Call window.speechSynthesis to speak briefing on mount.
(3) Active cooking view — single card: chef name + instruction + sub-hint + countdown timer + 'Done, Chef' button (full width). Below: next step preview + parallel chips. NO timeline. NO step list. onDone calls handleStepComplete() which records actual time, advances index, speaks next step via Web Speech API, re-renders.
(4) Running late recovery card — appears for 3 seconds when re-plan reallocates a step. Auto-dismisses.
Replace the existing Start Cooking side panel trigger completely.
npx tsc --noEmit must pass with 0 errors.
Deploy to slux staging after build.

AGENT 2 — Mobile UI:
Read kitchen-conductor.md, ui-guardian.md first.
Import same types and scheduler as Web agent.
Find the existing TTS speak utility from Phase 0 deepsearch — use it. Do not create a new one.
Install expo-keep-awake if not already present.

Build at apps/mobile/app/(app)/menus/[id]/:
(1) cook.tsx — full-screen setup flow. 4 screens navigated with Expo Router. Names: text input + large pill chips + big + button. Ovens: large segmented buttons. Serving: large card options + toggle. Time: time picker + 'Start by X' hint. Final button: 'Meet Chef'.
(2) cook-briefing.tsx — dark background screen. Chef briefing text large and readable. Speak briefing via existing TTS utility on mount. Single 'Start cooking' button.
(3) cook-active.tsx — single card view. expo-keep-awake active. Large readable instruction. Large countdown timer. 'Done, Chef' button full width with haptic feedback. Next step preview below. onDone calls handleStepComplete() — records actual, speaks next step via existing TTS, advances. Supabase Realtime subscription to cooking_sessions for multi-device sync.
(4) Running late card — 3 second toast/overlay when re-plan happens. Auto-dismisses.
Replace Start Cooking button destination in menu detail screen.
npx tsc --noEmit must pass with 0 errors."
```

**Checkpoint after Phase 3**: Both UI agents done. TypeScript clean on both apps. Staging deployed.

---

## Phase 4 — Integration verification

Run these checks yourself — do not delegate to agents:

```bash
# 1. Verify migrations applied correctly
ssh pilzner@slux "docker exec supabase-db psql -U postgres -c '\d recipe_steps'" | grep -E "duration|passive|oven|phase|confidence"

ssh pilzner@slux "docker exec supabase-db psql -U postgres -c '\d cooking_sessions'"

# 2. TypeScript clean on both apps
cd apps/web && npx tsc --noEmit
cd apps/mobile && npx tsc --noEmit

# 3. Staging live
curl -s -o /dev/null -w "%{http_code}" http://100.83.66.51:3001/dashboard
```

Manual test sequence on staging/device:
1. Open a menu with 3+ dishes spanning multiple courses
2. Tap Start Cooking → setup modal appears (not old side panel)
3. Enter two chef names → next → 1 oven → next → plated + eating yes → next → set serve time 2 hours out
4. Tap Meet Chef → briefing screen → hear briefing spoken
5. Tap Start cooking → single card with first step and countdown
6. Tap Done, Chef → hear next step spoken → card advances
7. Force a late finish (wait past timer) → verify re-plan message appears

---

## Phase 5 — Wrap up

1. Update `DONE.md` with full session summary covering all 6 components built
2. Update `feature-registry.md` — set Chef / Kitchen Conductor status to COMPLETE v1
3. Add to CLAUDE.md agent lookup table:
   ```
   | Any session touching Start Cooking, cooking sessions, kitchen scheduling, or Chef voice | kitchen-conductor.md (MANDATORY) |
   ```
4. Run `/wrapup`

---

## If you get stuck or context fills

Resume with:
```
ralph "Resume Chef Kitchen Conductor build from Phase [N]. kitchen-conductor.md is in .claude/agents/. Migrations 081 and 082 [are/are not] applied. Types file [exists/does not exist] at packages/ui/src/scheduler.types.ts. Last completed checkpoint: [describe]. Continue from there."
```

Do not restart from Phase 0. Pick up from the last verified checkpoint.
