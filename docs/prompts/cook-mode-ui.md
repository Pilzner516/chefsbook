# Prompt: ChefsBook Chef Kitchen Conductor — Cook Mode UI + step_actuals Learning Loop

## LAUNCH PROMPT (paste this into Claude Code to start the session)

```
/autopilot "Read and execute docs/prompts/cook-mode-ui.md fully and autonomously from pre-flight through deployment and wrapup. Do not stop for questions unless you hit a genuine blocker."
```

> **Dependency:** `docs/prompts/knowledge-graph-promotion.md` must have been
> run first. Verify `recipe_steps` has `technique` and `ingredient_category`
> columns before proceeding.

> **Before launching:** Run `/oh-my-claudecode:hud setup` for live observability.
> This is a web + mobile session — HUD is essential.

---

## TYPE: FEATURE — WEB + MOBILE
## OMC MODE: autopilot

## Overview

The backend for Chef Kitchen Conductor is fully built. This session builds
the UI and wires the critical `step_actuals` learning loop.

**What exists (do not rebuild):**
- `cooking_sessions` table with JSONB plan + Realtime + optimistic locking
- `packages/ui/src/scheduler.ts` — zero-AI TypeScript scheduler
- `packages/ui/src/scheduler.types.ts` — CookingPlan, ScheduledStep, ChefSetup
- `packages/db/src/queries/cookingSessions.ts` — CRUD
- `packages/ai/src/inferStepTimings.ts` — step timing inference
- `packages/ai/src/chefBriefing.ts` — briefing generation (~$0.001/session)
- Existing simple CookMode in `apps/mobile/app/recipe/[id].tsx` — keep it,
  this is a different deeper experience

**What this session builds:**
- Migration 087: `step_actuals` table
- New web route: `/cook/[recipeId]` — full Kitchen Conductor UI
- New mobile screen: `apps/mobile/app/cook/[id].tsx` — full Kitchen Conductor
- step_actuals recording when user completes each step
- Feedback loop: step_actuals → cooking_action_timings confidence update
- "Cooked it!" completion moment + 5 points awarded
- Entry point from recipe detail page on both platforms

---

## Agent files to read — ALL of these, in order, before writing a single line of code

- `.claude/agents/wrapup.md`
- `.claude/agents/testing.md`
- `.claude/agents/feature-registry.md`
- `.claude/agents/ui-guardian.md`
- `.claude/agents/data-flow.md`
- `.claude/agents/ai-cost.md`
- `.claude/agents/deployment.md`
- `.omc/planning/02-data-strategy.md`

Run ALL pre-flight checklists before writing any code.

---

## OMC agent routing

| Task | Agent | Model |
|------|-------|-------|
| Pre-flight + schema reads | architect | opus |
| Migration 087 | coder | sonnet |
| Web Cook Mode UI | coder | sonnet |
| Mobile Cook Mode screen | coder | sonnet |
| step_actuals recording | coder | sonnet |
| Feedback loop to knowledge graph | coder | sonnet |
| Points wiring + completion | coder | sonnet |
| Entry points on recipe detail | coder | sonnet |
| i18n (5 locales) | coder | haiku |
| TypeScript + deploy | coder | sonnet |
| Verification | coder | haiku |
| Wrapup | architect | sonnet |

---

## Pre-flight: before writing any code

1. **Read `packages/ui/src/scheduler.ts` and `scheduler.types.ts` in full.**
   Understand the CookingPlan output shape, ScheduledStep fields, and how
   the scheduler handles serve time, oven conflicts, and parallel steps.

2. **Read `packages/ai/src/chefBriefing.ts`** — understand what it generates
   and what inputs it needs.

3. **Read the existing CookMode component in `apps/mobile/app/recipe/[id].tsx`**
   — understand what exists so the new screen doesn't conflict. The existing
   CookMode is a simple step-through with TTS. The new Kitchen Conductor is
   the full scheduled experience. Both coexist.

4. **Read `apps/mobile/app/cook-menu/[id].tsx`** — this is the menu cook mode.
   The new single-recipe cook mode should feel similar but is a different screen.

5. **Verify `recipe_steps` has technique columns from promotion pipeline:**
   ```bash
   ssh pilzner@slux "docker exec supabase-db psql -U postgres -c \
     \"SELECT column_name FROM information_schema.columns
       WHERE table_name = 'recipe_steps'
       AND column_name IN ('technique','ingredient_category','classified_at');\""
   ```
   If missing, halt — `knowledge-graph-promotion.md` must run first.

6. **Confirm next migration number.** Expected: **087**.
   ```bash
   ssh pilzner@slux "ls /opt/luxlabs/chefsbook/repo/supabase/migrations/ \
     | sort | tail -5"
   ```

7. **Check `user_points_balance` table exists** (from community-knowledge.md).
   If it does not exist yet, the 5-point award on completion should be a
   fire-and-forget no-op — do not fail if the points system isn't live yet.

---

## Part 1 — Migration 087: step_actuals

File: `supabase/migrations/20260504_087_step_actuals.sql`

```sql
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
```

Apply and restart PostgREST.

---

## Part 2 — Web Cook Mode: `/cook/[recipeId]`

File: `apps/web/app/cook/[recipeId]/page.tsx`

This is a full-screen, distraction-free cooking experience. No sidebar,
no nav, minimal chrome. `use client`. Keep screen awake if the
Wake Lock API is available (non-blocking, fail silently if not supported).

### Flow

**Screen 1 — Setup**
- Recipe title and hero image (small, top)
- Chef Briefing: call `chefBriefing()` on mount, display the 120-word
  briefing with animated typewriter reveal. Show a skeleton while loading.
- Serve time picker: "When do you want to eat?" — time input defaulting
  to 1 hour from now. Adjustable in 15-minute increments.
- Oven setup: "How many ovens do you have?" — 1 or 2 (ChefSetup input)
- "Start Cooking →" button

**Screen 2 — Scheduled Plan (overview)**
Show the full `CookingPlan` from `scheduler.ts`:
- Reverse-scheduled list of steps from serve time backwards
- Each step shows: scheduled start time, duration range, step instruction
  (truncated), phase badge (prep/cook/rest/plate), parallel indicator
- Critical path steps highlighted
- Oven conflict warnings if any
- "Let's Go →" button to enter step-by-step mode

**Screen 3 — Step-by-step (main experience)**
One step at a time, full screen.

Layout:
```
[Exit]                    Step 3 of 12        [⏸ Pause]

────────────────────────────────────────────────
 Sauté the onions until golden, about 8 minutes
────────────────────────────────────────────────

 ⏱  07:43  remaining

 [████████████░░░░░░░░]  62%

 Phase: Cook · Technique: sauté · Onions

────────────────────────────────────────────────

 ← Previous          [Done — Next Step →]
```

Timer behaviour:
- Auto-starts at `planned_duration_max` seconds when step loads
- Counts down. Displays MM:SS.
- At 0: gentle pulse animation (no sound by default), timer turns red,
  continues counting up as overtime
- Pause button stops the timer, resumes on tap
- "Done — Next Step →" records the actual elapsed time to step_actuals,
  advances to next step

For `is_passive` steps (e.g. "let rest for 20 minutes"):
- Show a passive indicator: "This step runs in the background"
- Timer still counts but UI is muted — user can move around

For parallel steps:
- Show a small indicator: "⚡ Parallel — you can do this while [other step]"

**Screen 4 — Completion ("Cooked it!")**
- Recipe hero image, large
- "You cooked [Recipe Title]!" heading
- Time taken (total session duration)
- How accurate the timing predictions were:
  "Our Sous Chef predicted Xm — it took Ym. We'll remember that."
  (Only show if step_actuals were recorded for this session)
- Award 5 points (fire-and-forget — no-op if points system not live)
- Check badge threshold for 'cooked_it' badge — show milestone popup if earned
- "Done" button → returns to recipe detail

### API routes

```
POST /api/cook/sessions
→ Creates cooking_session, calls chefBriefing(), runs scheduler
→ Returns { sessionId, plan, briefing }

POST /api/cook/sessions/[id]/step-actual
→ Records one step_actual row
→ Fires knowledge graph update (fire-and-forget)
→ Returns { ok }

POST /api/cook/sessions/[id]/complete
→ Marks session complete, awards points
→ Returns { ok, pointsAwarded, newBadges }
```

All routes: authenticated, use `supabaseAdmin` for writes.

### Entry point on recipe detail

Add a "Start Cooking" button to the recipe detail page
(`apps/web/app/recipe/[id]/page.tsx`). Position: below the ingredients
section, above the steps. Only shown if the recipe has `is_complete = true`
and has at least 3 steps with timing data.

Button navigates to `/cook/[recipeId]`.

---

## Part 3 — Mobile Cook Mode: `apps/mobile/app/cook/[id].tsx`

Same flow as web but adapted for mobile. This is a separate screen from
the existing simple CookMode — both coexist. The existing CookMode remains
on the recipe detail for quick step-through. The new Kitchen Conductor is
for the full scheduled experience.

Add `/cook/[id]` to the FloatingTabBar exclusion list in `_layout.tsx`
(same pattern as `/cook-menu/[id]`).

Use `expo-keep-awake` to prevent screen sleep during cooking (already used
in `cook-menu/[id].tsx` — follow the same pattern).

TTS: integrate the same `Speech.speak()` pattern from the existing CookMode
for step instructions. TTS toggle pill in header.

Entry point: add "Start Cooking" button to `apps/mobile/app/recipe/[id].tsx`
below the ingredients section. Same gate: `is_complete` + 3+ timed steps.
Navigates to `/cook/[id]` via `router.push`.

i18n keys needed (all 5 locales):
```
cookMode.setup.title: "Ready to cook?"
cookMode.setup.serveTime: "When do you want to eat?"
cookMode.setup.ovens: "How many ovens?"
cookMode.setup.start: "Start Cooking"
cookMode.plan.title: "Your cooking plan"
cookMode.plan.go: "Let's Go"
cookMode.step.of: "Step {{current}} of {{total}}"
cookMode.step.passive: "This step runs in the background"
cookMode.step.parallel: "Parallel step"
cookMode.step.done: "Done — Next Step"
cookMode.step.pause: "Pause"
cookMode.step.resume: "Resume"
cookMode.step.overtime: "Over time"
cookMode.complete.title: "You cooked it!"
cookMode.complete.prediction: "Predicted {{predicted}}m · Took {{actual}}m"
cookMode.complete.done: "Done"
cookMode.startCooking: "Start Cooking"
```

---

## Part 4 — Knowledge graph feedback loop

File: `packages/ai/src/updateKnowledgeFromActuals.ts`

Called fire-and-forget from `POST /api/cook/sessions/[id]/step-actual`
after recording each step_actual.

**Logic:**
1. If `technique` is NULL on the step_actual: skip (nothing to update)
2. Look up `cooking_action_timings` by `canonical_key =
   technique:ingredient_category` (or `technique:_none`)
3. If found: increment `observations_count`, recalculate
   `duration_min`/`duration_max` using weighted average with new actual:
   ```
   new_min = (existing_min * observations_count + actual_seconds/60) /
             (observations_count + 1)
   ```
   Update confidence based on new observation count.
4. If not found: insert new entry with `source = 'step_actuals'`,
   `confidence = 'low'`, `observations_count = 1`
5. Also update `knowledge_gaps`: if a gap exists for this canonical_key
   and `observations_count >= fill_threshold`, mark gap as `filled`

This runs asynchronously — never blocks the UI response.
Log errors but do not throw.

---

## Part 5 — Plan gating

Cook Mode (Kitchen Conductor) is available on **Chef plan and above**.
Free users see the button but get a plan upgrade prompt on tap.
Use the existing plan gating pattern from `feature-registry.md`.

The existing simple CookMode (step-through in recipe detail) remains
available on all plans.

---

## Verification

```bash
# Confirm step_actuals table exists
ssh pilzner@slux "docker exec supabase-db psql -U postgres -c '\d step_actuals'"

# After a manual test cook session, confirm data recorded
ssh pilzner@slux "docker exec supabase-db psql -U postgres -c \
  \"SELECT technique, ingredient_category, actual_duration_seconds,
    planned_duration_min, planned_duration_max
    FROM step_actuals ORDER BY created_at DESC LIMIT 5;\""

# Confirm knowledge graph updated
ssh pilzner@slux "docker exec supabase-db psql -U postgres -c \
  \"SELECT canonical_key, observations_count, confidence, source
    FROM cooking_action_timings
    WHERE source = 'step_actuals'
    ORDER BY observations_count DESC LIMIT 10;\""
```

**Web UI verification:**
- `/cook/[recipeId]` loads for recipe with timed steps
- Scheduler runs, plan displays correctly
- Timer counts down, pauses, resumes
- "Done" records step_actual row in DB
- Completion screen shows, points awarded
- Free user sees upgrade prompt
- "Start Cooking" button visible on recipe detail for complete recipes
- Not visible for incomplete recipes

**Mobile verification (ADB):**
- "Start Cooking" button visible on recipe detail
- Navigates to `/cook/[id]`
- Timer works, TTS speaks step on advance
- Screen stays awake during cooking
- Completion screen shows

---

## Deploy

Follow `deployment.md`. Deploy web to slux.
Apply migration 087 before deploying.
Build and deploy mobile APK after web is verified.

---

## Wrapup

Follow `wrapup.md`. Log in DONE.md:

- Migration 087: step_actuals live
- Cook Mode UI live on web at `/cook/[recipeId]`
- Cook Mode UI live on mobile at `/cook/[id]`
- step_actuals → knowledge graph feedback loop wired
- Entry points added to recipe detail (web + mobile)
- First real cook session data in step_actuals (manual test)

Add to AGENDA.md:
- [ ] Monitor step_actuals growth over first 30 days
- [ ] Compare inferStepTimings() Haiku call volume before/after
      step_actuals feedback starts feeding the graph
- [ ] Consider "Cooking streak" feature once step_actuals has 30 days of data
