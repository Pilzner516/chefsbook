# Prompt: ChefsBook — Instagram Import Completion: Background Job + Progress UI (Web Only)

## LAUNCH PROMPT (paste this into Claude Code to start the session)

```
Read and execute docs/prompts/instagram-completion-background.md fully and autonomously, from pre-flight through deployment and /wrapup. Do not stop for questions unless you hit a genuine blocker.
```

---

## TYPE: BUG FIX + FEATURE — WEB ONLY

## Overview

Session P-211 built Instagram import completion (Sonnet vision generating ingredients +
steps from image + caption). However, completion runs client-side, so navigating away
from the Import & Scan page mid-completion cancels the entire batch. Users are left
with 60+ recipes stuck in `_incomplete` state with no feedback and no reliable way to
recover. The "generate for all" bulk action also has no visible progress.

This session moves completion to a server-side background queue and adds a persistent
progress indicator that survives page navigation.

This is web-only. Do NOT touch `apps/mobile` or `apps/extension`.

---

## Agent files to read — ALL of these, in order, before writing a single line of code

- `.claude/agents/wrapup.md`
- `CLAUDE.md`
- `DONE.md`
- `.claude/agents/testing.md`
- `.claude/agents/feature-registry.md`
- `.claude/agents/deployment.md`
- `.claude/agents/ai-cost.md`
- `.claude/agents/sous-chef.md`
- `.claude/agents/import-pipeline.md`
- `.claude/agents/data-flow.md`

Run ALL pre-flight checklists before writing any code.

---

## Pre-flight: before writing any code

1. Read `apps/web/app/api/import/instagram-export/complete/route.ts` (P-211) — understand
   the current completion logic that needs to move server-side
2. Read `apps/web/components/InstagramExportImporter.tsx` — understand the current
   client-side batch loop that navigating away kills
3. Check whether the project has any existing background job / queue infrastructure
   (check DONE.md + look for any queue, worker, or job table in the DB schema)
4. Check the existing "generate for all" action — find where it lives and how it
   currently triggers completion
5. Confirm next available DB migration number from DONE.md
6. Confirm current count of recipes stuck in `_incomplete` + `source_type = 'instagram_export'`
   state that need to be retroactively completed:
   ```sql
   SELECT COUNT(*) FROM recipes 
   WHERE source_type = 'instagram_export' 
   AND '_incomplete' = ANY(tags);
   ```

---

## The problems

### Problem 1: Client-side completion is fragile
The P-211 completion loop runs in the browser. Navigating away, closing the tab, or
a network hiccup kills it mid-batch. Users end up with partial imports — some recipes
complete, some stuck as stubs.

### Problem 2: "Generate for all" has no feedback
The bulk completion action fires off requests but the user has no visibility into
progress. They don't know if it's working, how many are done, or when it'll finish.

### Problem 3: 60 recipes are currently stuck
The current user has ~60 recipes in `_incomplete` state from the P-210/P-211 import
that need to be completed. This session must also fix these retroactively.

---

## Solution: Server-side job queue

### New DB table: import_completion_jobs

```sql
CREATE TABLE import_completion_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  recipe_id UUID NOT NULL REFERENCES recipes(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'processing', 'complete', 'failed')),
  attempts INTEGER NOT NULL DEFAULT 0,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_completion_jobs_user_pending 
  ON import_completion_jobs(user_id, status) 
  WHERE status IN ('pending', 'processing');

CREATE INDEX idx_completion_jobs_recipe 
  ON import_completion_jobs(recipe_id);

ALTER TABLE import_completion_jobs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users own completion jobs" ON import_completion_jobs
  USING (user_id = auth.uid());
```

### New architecture

```
Instagram import save (existing)
  └─ For each saved recipe: INSERT into import_completion_jobs (status='pending')
  └─ Return recipe IDs + job IDs immediately to client

Client polls GET /api/import/instagram-export/completion-status
  └─ Returns { pending: N, processing: N, complete: N, failed: N, jobs: [...] }
  └─ Client shows persistent progress banner (survives navigation)

Server-side processor: POST /api/import/instagram-export/process-jobs
  └─ Called by client polling OR by a lightweight server trigger
  └─ Picks up to 5 pending jobs, marks as 'processing', runs Sonnet completion
  └─ On success: marks 'complete', updates recipe
  └─ On failure: marks 'failed', stores error_message, allows retry
```

---

## Implementation details

### Processing trigger

Since the project runs on RPi5 without a dedicated job runner, use a **client-driven
polling model**:

1. After save, client starts polling `GET /api/import/instagram-export/completion-status`
   every 5 seconds
2. Each poll response includes pending job count
3. Client also calls `POST /api/import/instagram-export/process-jobs` each poll cycle
   to advance the queue
4. If user navigates away: polling stops BUT jobs remain in DB as `pending`
5. When user returns to any page, a **global progress banner** detects pending jobs
   and resumes polling + processing automatically

This means completion is resilient to navigation — jobs survive in the DB and resume
whenever the user is on the web app.

### Global progress banner

Add a persistent banner component to the root layout (`apps/web/app/dashboard/layout.tsx`
or equivalent) that:

- On mount: calls `GET /api/import/instagram-export/completion-status`
- If any `pending` or `processing` jobs exist: shows banner
- Banner: "Generating recipes from your Instagram import — 12 / 47 complete"
- Clicking banner navigates to `/dashboard/scan`
- Disappears automatically when all jobs are `complete` or `failed`
- Shows failed count if any: "44 complete, 3 failed — tap to retry"

The banner polls every 5 seconds while jobs are pending/processing, and also drives
`process-jobs` calls to advance the queue.

---

## API routes

### GET /api/import/instagram-export/completion-status

Returns current job counts for the authenticated user:

```typescript
{
  pending: number
  processing: number  
  complete: number
  failed: number
  total: number
  isActive: boolean   // true if pending + processing > 0
  recentlyCompleted: Array<{ recipeId: string, title: string }>  // last 5 completed
}
```

### POST /api/import/instagram-export/process-jobs

Picks up to 5 pending jobs and runs Sonnet completion on them. This is the same
completion logic from P-211's complete route, now driven by the job queue.

- Atomically claims jobs: UPDATE status='processing' WHERE status='pending' LIMIT 5
- Runs `completeInstagramRecipe()` for each
- On success: UPDATE status='complete', update recipe
- On failure: UPDATE status='failed', store error_message, increment attempts
- Max 3 attempts per job before permanently marking failed
- Returns: `{ processed: N, succeeded: N, failed: N }`

### POST /api/import/instagram-export/retry-failed

Resets failed jobs back to `pending` for retry:

```typescript
// Request: { jobIds?: string[] }  // if empty, retry all failed for this user
// Response: { reset: number }
```

---

## Changes to existing routes

### save/route.ts

After creating recipe stubs, replace the current direct completion calls with:

```typescript
// Insert a completion job for each saved recipe
await supabaseAdmin.from('import_completion_jobs').insert(
  savedRecipeIds.map(recipeId => ({
    user_id: userId,
    recipe_id: recipeId,
    status: 'pending'
  }))
)
// Return immediately — do NOT await completion
return { saved: N, jobsQueued: N, recipeIds: [...] }
```

### InstagramExportImporter.tsx

Replace Phase 4 (client-side completion loop) with:
- Show "Recipes saved! Generating ingredients and steps in the background…"
- Start polling `completion-status` to show progress
- The global banner takes over if user navigates away

---

## Retroactive fix for stuck recipes

After the new queue infrastructure is in place, backfill completion jobs for all
currently stuck recipes:

```sql
-- Run after migration is applied
INSERT INTO import_completion_jobs (user_id, recipe_id, status)
SELECT user_id, id, 'pending'
FROM recipes
WHERE source_type = 'instagram_export'
  AND '_incomplete' = ANY(tags)
  AND id NOT IN (SELECT recipe_id FROM import_completion_jobs);
```

This queues all 60 stuck recipes for completion. The global banner will then pick
them up and process them automatically when the user is on the web app.

Add a one-time admin action or document this SQL so it can be run on RPi5 after deploy.

---

## UI: "Generate for all" button

Update the existing "generate for all" button on My Recipes to:
1. Call the new retroactive backfill endpoint (or run the SQL via an admin API action)
2. Show the global progress banner immediately
3. Replace button text with "Generating… (N remaining)" while jobs are active
4. Show "All done!" when complete

---

## Testing

1. Start an Instagram import, let it reach Phase 4 (saving), then immediately navigate
   to a different page
2. Confirm global banner appears: "Generating recipes from your Instagram import…"
3. Wait — confirm recipes complete in the background without staying on the import page
4. Return to My Recipes — confirm recipes have ingredients + steps
5. Test retry: manually set a job to `failed` in psql, click "retry failed" in UI,
   confirm it processes

### psql verification

```sql
-- Check job status distribution
SELECT status, COUNT(*) 
FROM import_completion_jobs 
GROUP BY status;

-- Confirm stuck recipes are now queued
SELECT COUNT(*) FROM import_completion_jobs 
WHERE status = 'pending';

-- After completion: confirm no more _incomplete instagram recipes
SELECT COUNT(*) FROM recipes
WHERE source_type = 'instagram_export'
  AND '_incomplete' = ANY(tags);
```

Expected final state: 0 recipes with `_incomplete` + `instagram_export`.

---

## Deploy

Follow `deployment.md`. Deploy web to RPi5 via `deploy-staging.sh`.
After deploy, run the retroactive backfill SQL to queue the 60 stuck recipes.
Verify the global banner appears and starts processing.

---

## Wrapup

Follow `wrapup.md` fully.

- [ ] `tsc --noEmit` clean on `apps/web`
- [ ] Migration applied on RPi5 + `docker restart supabase-rest`
- [ ] Retroactive backfill SQL run — all 60 stuck recipes queued
- [ ] Global banner tested — appears and disappears correctly
- [ ] `feature-registry.md` P-210/P-211 row updated with note about background queue
- [ ] `DONE.md` entry written
- [ ] Deployed to RPi5 and smoke-tested
- [ ] TYPE classification: CODE (bug fix + feature extension)
