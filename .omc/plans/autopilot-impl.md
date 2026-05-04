# Community Knowledge Engine — Implementation Plan

## Phase 2: Execution Tasks

### Task 1: Pre-flight Schema Verification
**Agent:** architect (opus)
**Dependencies:** None
**Parallel:** No

**Steps:**
1. Verify cooking_action_timings has technique + ingredient_category columns
2. Confirm packages/ai/src/inferStepTimings.ts extracts both fields
3. Check web My Recipes layout at apps/web/app/dashboard/page.tsx
4. Check mobile My Recipes at apps/mobile/app/(tabs)/index.tsx
5. Verify FeedbackCard positioning (web: grid item 1, mobile: ListHeaderComponent)
6. Document injection points for gap request card (web: position 2, mobile: header)

**Deliverable:** Pre-flight checklist complete, injection points documented

---

### Task 2: Migration 085 — Knowledge Gaps Schema
**Agent:** coder (sonnet)
**Dependencies:** Task 1 complete
**Parallel:** No

**File:** `supabase/migrations/20260504_085_knowledge_gaps.sql`

**Schema:**
```sql
CREATE TABLE knowledge_gaps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  technique TEXT NOT NULL,
  ingredient_category TEXT,
  canonical_key TEXT NOT NULL UNIQUE,
  observation_count INTEGER NOT NULL DEFAULT 0,
  priority TEXT NOT NULL DEFAULT 'medium' CHECK (priority IN ('low','medium','high','critical')),
  status TEXT NOT NULL DEFAULT 'detected' CHECK (status IN ('detected','approved','active','agent_hunting','filled','dismissed')),
  request_title TEXT,
  request_body TEXT,
  fill_threshold INTEGER NOT NULL DEFAULT 5,
  suggested_urls JSONB DEFAULT '[]',
  detected_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  approved_at TIMESTAMPTZ,
  approved_by UUID REFERENCES auth.users(id),
  filled_at TIMESTAMPTZ,
  dismissed_at TIMESTAMPTZ,
  dismissed_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE gap_contributions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  gap_id UUID NOT NULL REFERENCES knowledge_gaps(id) ON DELETE CASCADE,
  recipe_id UUID NOT NULL REFERENCES recipes(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  points_awarded INTEGER NOT NULL DEFAULT 0,
  is_double_points BOOLEAN NOT NULL DEFAULT TRUE,
  contributed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(gap_id, recipe_id)
);
```

**Indexes + RLS as per spec**

**Apply:**
```bash
ssh pilzner@slux "docker exec supabase-db psql -U postgres -f /opt/luxlabs/chefsbook/repo/supabase/migrations/20260504_085_knowledge_gaps.sql"
docker restart supabase-rest
```

**Verification:**
```bash
ssh pilzner@slux "docker exec supabase-db psql -U postgres -c \"SELECT table_name FROM information_schema.tables WHERE table_name IN ('knowledge_gaps','gap_contributions');\""
```

---

### Task 3: Migration 086 — Points & Badges
**Agent:** coder (sonnet)
**Dependencies:** Task 2 complete
**Parallel:** No

**File:** `supabase/migrations/20260504_086_points_badges.sql`

**Schema:**
- `user_points` (transaction log)
- `user_points_balance` (materialized)
- `badge_definitions` (seeded with 7 badges)
- `user_badges` (earned)

**Seed data:** 7 badge definitions from spec

**Apply + verify** same pattern as Task 2

---

### Task 4: Gap Detection Job
**Agent:** coder (sonnet)
**Dependencies:** Task 3 complete
**Parallel:** No

**Files:**
- `packages/ai/src/detectKnowledgeGaps.ts`
- `apps/web/app/api/admin/knowledge-gaps/detect/route.ts`

**Logic:**
1. Query cooking_action_timings for low confidence/observations
2. Query recipe_steps for common combos not in graph
3. Upsert knowledge_gaps with priority scoring
4. Mark filled where threshold met

**Priority formula:**
- `critical`: observation_count=0 AND appears in >10 recipe_steps
- `high`: observation_count<3 AND appears in >5 recipe_steps
- `medium`: observation_count<5
- `low`: observation_count≥5 but confidence='low'

**API route:** Super admin only, returns `{ detected, updated, filled }`

---

### Task 5A: Admin Gap Queue UI
**Agent:** coder (sonnet)
**Dependencies:** Task 4 complete
**Parallel:** YES (with 5B, 5C, 5D, 5E)

**File:** `apps/web/app/admin/knowledge-gaps/page.tsx`

**Components:**
- KPI cards (total/active/filled/avg)
- Filter tabs
- Gap table with actions
- Approve modal (request_title + request_body inputs)
- Suggested URLs panel

**API route:** `GET /api/admin?page=knowledge-gaps`

**Add to sidebar:** Admin nav section → "Intelligence" group → "Knowledge Gaps"

---

### Task 5B: Agent URL Discovery
**Agent:** coder (sonnet)
**Dependencies:** Task 4 complete
**Parallel:** YES (with 5A, 5C, 5D, 5E)

**File:** `packages/ai/src/findGapRecipes.ts`

**Logic:**
1. Takes technique + ingredient_category
2. Claude Sonnet web_search on curated sites
3. Filters already-imported URLs (source_url_normalized check)
4. Returns top 5 with quality estimates from import_site_tracker
5. Saves to gap.suggested_urls JSONB

**API route:** `POST /api/admin/knowledge-gaps/[id]/find-recipes`

**Cost logging:** `logAiCall('find_gap_recipes', 'sonnet', ...)`

---

### Task 5C: Community Request Card (Web)
**Agent:** coder (sonnet)
**Dependencies:** Task 4 complete
**Parallel:** YES (with 5A, 5B, 5D, 5E)

**File:** `apps/web/components/GapRequestCard.tsx`

**Injection point:** `apps/web/app/dashboard/page.tsx` — grid position 2 (after FeedbackCard)

**Styling:** Amber/gold accent, matches recipe card dimensions, brain SVG icon

**Logic:**
- Fetch one random active gap
- Check localStorage dismissal (7-day expiry)
- "I have one!" → opens import modal with gapId context
- "Not now" → localStorage dismiss

**i18n keys:** 6 keys across all 5 locales

---

### Task 5D: Community Request Card (Mobile)
**Agent:** coder (sonnet)
**Dependencies:** Task 4 complete
**Parallel:** YES (with 5A, 5B, 5C, 5E)

**File:** `apps/mobile/components/GapRequestCard.tsx`

**Injection point:** `apps/mobile/app/(tabs)/index.tsx` — FlashList header after FeedbackCard

**Styling:** NativeWind, matches RecipeCard, amber border

**Logic:**
- Same as web but uses AsyncStorage for dismissal
- "I have one!" → navigate to scan tab with gapId param
- "Not now" → AsyncStorage dismiss

**i18n keys:** Same 6 keys as web

---

### Task 5E: Points & Badges System
**Agent:** coder (sonnet)
**Dependencies:** Task 4 complete
**Parallel:** YES (with 5A, 5B, 5C, 5D)

**Files:**
- `packages/db/src/queries/points.ts` — awardPoints(), checkBadges()
- `packages/ai/src/points.ts` — point value constants

**Point values:**
```typescript
export const POINTS = {
  RECIPE_IMPORT: 10,
  GAP_CONTRIBUTION: 40, // double
  COOKED_IT: 5,
  RECIPE_SHARED: 5,
} as const;
```

**Badge checking:**
- Query user_points for action counts
- Check against badge_definitions.threshold
- Insert user_badges if threshold met
- Return newBadges array

---

### Task 6: Import Pipeline Wiring
**Agent:** coder (sonnet)
**Dependencies:** Tasks 5A-5E complete
**Parallel:** No

**Files to modify:**
- `apps/web/lib/saveWithModeration.ts` — after successful save, check gapId
- `apps/mobile/lib/zustand/recipeStore.ts` — addRecipe after save
- `apps/web/app/api/recipes/finalize/route.ts` — wire awardPoints call

**Logic:**
```typescript
if (gapId) {
  await createGapContribution({ gap_id: gapId, recipe_id, user_id });
  const result = await awardPoints(user_id, 'gap_contribution_double', 40, gapContributionId, ...);
  // Check if gap now filled
  // Return newBadges for celebration modal
} else {
  await awardPoints(user_id, 'recipe_import', 10, recipe_id, ...);
}
```

**Celebration modal:**
- Web: `components/BadgeCelebrationModal.tsx`
- Mobile: `components/BadgeCelebrationSheet.tsx`
- Shows once per badge, non-repeatable

---

### Task 7: TypeScript Check + Deploy
**Agent:** coder (sonnet)
**Dependencies:** Task 6 complete
**Parallel:** No

**Steps:**
1. `cd apps/web && npx tsc --noEmit`
2. `cd apps/mobile && npx tsc --noEmit`
3. Fix any errors
4. Deploy web via `ssh pilzner@slux "/opt/luxlabs/chefsbook/deploy-staging.sh"`
5. Verify HTTP 200 on key pages

---

### Task 8: Verification
**Agent:** coder (haiku)
**Dependencies:** Task 7 complete
**Parallel:** No

**Verification checklist:**
1. Confirm tables exist (psql SELECT)
2. Confirm badge seed data (7 rows)
3. Trigger gap detection, confirm results
4. Approve a gap, set to active
5. Verify gap card renders at position 2 (web + mobile)
6. Import a recipe with gapId, verify 40 points awarded
7. Verify badge awarded on threshold
8. No console errors on web
9. No TypeScript errors

---

### Task 9: Wrapup
**Agent:** architect (sonnet)
**Dependencies:** Task 8 complete
**Parallel:** No

**Steps:**
1. Read docs/prompts/community-knowledge.md completion checklist
2. Audit every item (DONE/SKIPPED/FAILED)
3. Update DONE.md with [SESSION XXX] entries
4. Update feature-registry.md
5. Run /wrapup

---

## Estimated Effort
- Total tasks: 9
- Parallel tasks: 5 (Tasks 5A-5E)
- Sequential critical path: 1 → 2 → 3 → 4 → 5* → 6 → 7 → 8 → 9
- Estimated time: ~3-4 hours (with ultrawork parallelization)

## Risk Areas
- Gap detection query performance on large recipe_steps table
- Web import modal needs gapId context plumbing
- Mobile scan tab needs gapId navigation param handling
- Badge celebration modal must not block import success flow
