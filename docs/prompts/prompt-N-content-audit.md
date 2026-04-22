# Prompt N — Content Health Audit Tool (Admin)
## Scope: apps/web (admin pages, new audit system, packages/ai extensions)

---

## AGENTS TO READ FIRST (in order)
1. `.claude/agents/wrapup.md`
2. `CLAUDE.md`
3. `DONE.md`
4. `.claude/agents/testing.md`
5. `.claude/agents/feature-registry.md`
6. `.claude/agents/deployment.md`
7. `.claude/agents/ui-guardian.md`
8. `.claude/agents/ai-cost.md` — MANDATORY (new AI calls, cost estimates)

Run ALL pre-flight checklists before writing a single line of code.
Inspect: `\d recipes` `\d recipe_comments` `\d user_profiles`
`\d recipe_flags` `\d tag_moderation_log` `\d admin_users`

Read the following existing moderation functions before writing any code:
- `packages/ai/src/moderateRecipe.ts`
- `packages/ai/src/moderateComment.ts`
- `packages/ai/src/moderateTag.ts`
- `packages/ai/src/moderateProfile.ts`

---

## FEATURE OVERVIEW

A Content Health Audit tool in the admin dashboard that allows admins
to scan the platform's content at any time for policy violations.
Results are shown in a report with multi-select batch actions.
Two scan modes: Standard and Deep (strict).
Admin selects what to scan before running.

---

## DATABASE: Audit tables

### Table 1: content_audit_runs
```sql
CREATE TABLE IF NOT EXISTS content_audit_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_by UUID NOT NULL REFERENCES auth.users(id),
  scan_scope TEXT[] NOT NULL,
  scan_mode TEXT NOT NULL CHECK (scan_mode IN ('standard', 'deep')),
  status TEXT NOT NULL DEFAULT 'running'
    CHECK (status IN ('running', 'complete', 'failed')),
  total_items_scanned INTEGER DEFAULT 0,
  total_flagged INTEGER DEFAULT 0,
  estimated_cost_usd NUMERIC(10,6),
  actual_cost_usd NUMERIC(10,6),
  rules_version TEXT NOT NULL DEFAULT '1.0',
  started_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  error_message TEXT
);
```

### Table 2: content_audit_findings
```sql
CREATE TABLE IF NOT EXISTS content_audit_findings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  audit_run_id UUID NOT NULL REFERENCES content_audit_runs(id)
    ON DELETE CASCADE,
  content_type TEXT NOT NULL
    CHECK (content_type IN ('recipe','comment','tag','profile','cookbook')),
  content_id UUID NOT NULL,
  content_preview TEXT,
  recipe_id UUID REFERENCES recipes(id) ON DELETE CASCADE,
  recipe_title TEXT,
  owner_username TEXT,
  finding_severity TEXT NOT NULL
    CHECK (finding_severity IN ('standard','deep_only')),
  reasons TEXT[] NOT NULL,
  ai_explanation TEXT,
  action_taken TEXT
    CHECK (action_taken IN (
      'none','ignored','made_private','hidden','deleted','flagged'
    )) DEFAULT 'none',
  action_taken_by UUID REFERENCES auth.users(id),
  action_taken_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_audit_findings_run ON content_audit_findings(audit_run_id);
CREATE INDEX idx_audit_findings_type ON content_audit_findings(content_type);
CREATE INDEX idx_audit_findings_action ON content_audit_findings(action_taken);
```

Apply both migrations on RPi5 and restart supabase-rest.

---

## RULES VERSION SYSTEM

The current rules version is `'1.0'`. Store it as a constant in
`packages/ai/src/auditRules.ts`:

```typescript
export const AUDIT_RULES_VERSION = '1.0';

export const STANDARD_RULES = `
Family-friendly platform. Flag content containing:
- Profanity or offensive language
- Sexual or explicit content
- Hate speech or discrimination
- Violence or graphic content
- Spam or self-promotion (URLs, contact info, "buy now")
- Content clearly unrelated to food or cooking
`;

export const DEEP_RULES = `
${STANDARD_RULES}
Additionally flag:
- Borderline inappropriate language or innuendo
- Thinly veiled spam or promotional language
- Misleading health claims or dangerous instructions
- Copyright-suspicious content (verbatim recipes from major publishers)
- Unusually keyword-stuffed titles or descriptions
- Ingredient quantities that suggest dangerous amounts
`;
```

When rules are updated in future, increment `AUDIT_RULES_VERSION`.
Each audit run stores the version used so old results are clearly
marked if rules have changed since.

---

## SCAN SCOPES

The admin selects one or more of these scopes before running:

| Scope | What is scanned | AI function used |
|---|---|---|
| `tags` | All unique tags used platform-wide | `moderateTag` |
| `recipes` | Title, description, notes of all recipes | `moderateRecipe` |
| `comments` | All public comments and replies | `moderateComment` |
| `profiles` | All public bios and display names | `moderateProfile` |
| `cookbooks` | All public cookbook names/descriptions | `moderateProfile` |

---

## SCAN MODES

**Standard** — uses `STANDARD_RULES`. Flags clear violations.
**Deep** — uses `DEEP_RULES`. Flags borderline cases too.
Deep scan findings are tagged `finding_severity = 'deep_only'` so admins
know these are less certain. Standard findings are `'standard'`.

---

## COST ESTIMATION

Before running, calculate and show estimated cost to the admin:

```typescript
// Approximate item counts
const counts = {
  tags: uniqueTagCount,        // ~$0.0002 per tag (Haiku)
  recipes: recipeCount,        // ~$0.0004 per recipe (Haiku)
  comments: commentCount,      // ~$0.0001 per comment (Haiku)
  profiles: profileCount,      // ~$0.0002 per profile (Haiku)
  cookbooks: cookbookCount,    // ~$0.0002 per cookbook (Haiku)
};

// Deep mode costs ~1.5x standard (longer prompt)
const multiplier = mode === 'deep' ? 1.5 : 1.0;
const estimatedCost = selectedScopes
  .reduce((sum, scope) => sum + counts[scope] * costPerItem[scope], 0)
  * multiplier;
```

Show: *"Estimated cost: ~$0.04 for 200 recipes in Standard mode"*
Show a warning if estimated cost exceeds $1.00:
*"⚠️ This scan will cost approximately $X. Continue?"*

---

## API ROUTES

### POST /api/admin/audit/start
Request: `{ scope: string[], mode: 'standard' | 'deep' }`
- Verify admin status
- Create `content_audit_runs` row with status 'running'
- Return `{ auditRunId }` immediately (don't wait for completion)
- Kick off background processing (see below)

### Background processing
Use a fire-and-forget async function that:
1. Fetches content for each selected scope
2. Runs the appropriate AI moderation function on each item
3. Inserts findings into `content_audit_findings`
4. Updates `content_audit_runs` status to 'complete' when done
5. Updates actual_cost_usd based on token usage

**Batch processing:** Process items in batches of 10 with 100ms delay
between batches to avoid rate limiting.

**Tag scope special handling:**
- Get all unique tags across all recipes:
  ```sql
  SELECT DISTINCT unnest(tags) as tag, 
    COUNT(*) as recipe_count,
    ARRAY_AGG(id) as recipe_ids
  FROM recipes GROUP BY tag
  ```
- For each flagged tag, store ALL recipe_ids that use it
- `content_preview` = the tag text
- `recipe_title` = "{N} recipes use this tag"

### GET /api/admin/audit/runs
Returns list of past audit runs (most recent first), with summary stats.

### GET /api/admin/audit/runs/[runId]/findings
Returns all findings for a specific run.
Supports filters: `?content_type=tag&action=none&severity=standard`

### POST /api/admin/audit/findings/action
Request: `{ findingIds: string[], action: 'ignore' | 'make_private' | 'hide' | 'delete' | 'flag' }`
- Batch action on multiple findings
- For each finding, apply action to the underlying content
- Update `action_taken`, `action_taken_by`, `action_taken_at` on each finding
- **ignore**: marks as reviewed/cleared — no content change, just removes
  from active queue. Logged so there's a record a human approved it.
- **make_private**: sets recipe visibility = 'private'
- **hide**: sets moderation_status = 'hidden'
- **delete**: permanently deletes (requires ChefsDialog confirmation)
- **flag**: creates a recipe_flags row (routes to the flagged queue from K2)

---

## ADMIN UI

### Entry point
Add "Content Audit" tab/section to the admin pages.

### Page 1: Run a new audit

**Scope selector** (multi-select pills):
- Tags | Recipes | Comments | Profiles | Cookbooks

**Mode selector** (radio):
- ○ Standard Scan — catches clear violations
- ● Deep Scan — catches borderline cases (marked separately in results)

**Cost estimate** — updates live as scope/mode selection changes.

**"Run Audit" button** (primary, pomodoro red)
Disabled while a scan is already running.

**Past runs list** (below the form):
- Date/time, scope, mode, items scanned, flagged count, status
- Click to view results

### Page 2: Audit results (for a specific run)

**Summary bar:**
- X items scanned | Y flagged | Z actioned | Rules v1.0 | Standard/Deep

**Filter bar:**
- Content type: All | Tags | Recipes | Comments | Profiles | Cookbooks
- Severity: All | Standard | Deep Only
- Action: All | Pending | Ignored | Actioned

**Results table** (multi-select):
- Checkbox (for batch actions)
- Content type badge
- Content preview (truncated, 80 chars)
- Recipe title + owner (link to recipe detail)
- Severity badge (Standard / Deep Only — different colours)
- Reasons (pills)
- AI explanation (truncated, expandable)
- Action taken (or "Pending")

**Selected items action bar** (appears when 1+ checkboxes selected):
Shows count of selected items and action buttons:
- **Ignore** (ghost) — mark as reviewed, no action
- **Make Private** (secondary)
- **Hide** (secondary)  
- **Flag for Review** (secondary)
- **Delete** (destructive red) — requires ChefsDialog confirmation

**Tag-specific finding display:**
When content_type = 'tag', show:
- The tag text (large)
- "{N} recipes use this tag"
- Expandable list of affected recipe titles
- Extra action: **"Block tag globally"** — adds to blocked_tags table

**Deep Only findings** are visually distinct:
- Amber/yellow background instead of red
- Label: "Deep Scan Finding — admin discretion advised"

---

## REGRESSION CHECKS — MANDATORY

After deploying, verify ALL of the following:
1. Admin can access Content Audit page ✓
2. Scope + mode selection updates cost estimate ✓
3. Running a scan creates an audit run and shows progress ✓
4. Findings appear in results table after scan completes ✓
5. Multi-select checkboxes work, batch action bar appears ✓
6. Ignore action marks findings as ignored, removes from pending ✓
7. Make Private changes recipe visibility ✓
8. Tag finding shows all affected recipes ✓
9. Deep scan findings show amber/yellow, labelled correctly ✓
10. Past runs list shows scan history ✓
11. My Recipes images still show ✓
12. Search page images still show ✓
13. Recipe detail page still works ✓

---

## IMPLEMENTATION ORDER
1. Apply both migrations (content_audit_runs, content_audit_findings)
2. Create `packages/ai/src/auditRules.ts` with rules constants
3. Create API routes (start, runs list, findings, action)
4. Build admin UI — Page 1 (new audit form + past runs)
5. Build admin UI — Page 2 (results table + batch actions)
6. Update ai-cost.md with audit scan cost estimates
7. Update feature-registry.md
8. TypeScript check: `cd apps/web && npx tsc --noEmit` — must be clean
9. Deploy per `deployment.md`

---

## GUARDRAILS
- All admin routes verify admin status via admin_users table server-side
- Never process more than 10 items at once — batch with delays
- Background processing must update run status to 'failed' on any
  unhandled error so the UI doesn't show a stuck 'running' state
- Delete action is permanent — always require ChefsDialog confirmation
- Cost estimate must show BEFORE the admin can click Run
- Deep scan findings do NOT auto-trigger any actions — report only,
  admin decides
- Standard findings also do NOT auto-action — this tool is report +
  manual action only, not automatic enforcement
- Model is always Haiku for all scan types — never use Sonnet for audits

---

## WRAPUP REQUIREMENT
DONE.md entry must include:
- Both migrations applied and supabase-rest restarted confirmed
- auditRules.ts path and AUDIT_RULES_VERSION value
- All API route paths created
- Estimated cost display screenshot description
- All 13 regression checks confirmed
- tsc clean + deploy confirmed
