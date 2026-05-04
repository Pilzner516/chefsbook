# Prompt: ChefsBook Community Knowledge Engine

## LAUNCH PROMPT (paste this into Claude Code to start the session)

```
/autopilot "Read and execute docs/prompts/community-knowledge.md fully and autonomously from pre-flight through deployment and wrapup. ultrawork. Do not stop for questions unless you hit a genuine blocker."
```

> **Dependency:** `docs/prompts/knowledge-graph-promotion.md` must have been
> run and completed before this session. Verify `cooking_action_timings` has
> more than 40 rows before proceeding. If not, halt and run that prompt first.

> **Before launching:** Run `/oh-my-claudecode:hud setup` for live observability.

---

## TYPE: FEATURE — WEB + MOBILE
## OMC MODE: autopilot + ultrawork

## Vision

Turn knowledge gaps in ChefsBook's AI brain into a community engagement loop.

When the knowledge graph identifies that it has no data on a specific
technique + ingredient combination (e.g. rotisserie chicken), that gap
becomes a community request. A card appears in position 2 on every user's
My Recipes page:

> *"Our Sous Chef is looking for a great rotisserie chicken recipe.*
> *Do you have one to share?"*
> **[I have one!]**

Users who contribute earn points. Gap-filling imports earn double points.
Points unlock badges. The community builds ChefsBook's intelligence while
feeling rewarded for it.

Admins and agents manage the gap queue — reviewing detected gaps, approving
which become community requests, and letting agents find candidate URLs when
no user steps up within a set window.

---

## Agent files to read — ALL of these, in order, before writing a single line of code

- `.claude/agents/wrapup.md`
- `.claude/agents/testing.md`
- `.claude/agents/feature-registry.md`
- `.claude/agents/ui-guardian.md`
- `.claude/agents/data-flow.md`
- `.claude/agents/import-pipeline.md`
- `.claude/agents/import-quality.md`
- `.claude/agents/ai-cost.md`
- `.claude/agents/deployment.md`
- `.omc/planning/05-social-platform.md`

Run ALL pre-flight checklists before writing any code.

---

## OMC agent routing (ultrawork — parallelise where marked)

| Task | Agent | Model | Parallel? |
|------|-------|-------|-----------|
| Pre-flight + schema verification | architect | opus | No |
| Migrations 085 + 086 | coder | sonnet | No (sequential) |
| Gap detection job | coder | sonnet | No |
| Admin gap queue UI | coder | sonnet | Yes ↓ |
| Agent URL discovery | coder | sonnet | Yes ↓ |
| Community request card (web) | coder | sonnet | Yes ↓ |
| Community request card (mobile) | coder | sonnet | Yes ↓ |
| Points + badges system | coder | sonnet | Yes ↓ |
| Import pipeline wiring | coder | sonnet | No |
| TypeScript check + deploy | coder | sonnet | No |
| Verification | coder | haiku | No |
| Wrapup | architect | sonnet | No |

---

## Pre-flight: before writing any code

1. **Verify dependency:** confirm `knowledge-graph-promotion.md` has run:
   ```bash
   ssh pilzner@slux "docker exec supabase-db psql -U postgres -c \
     'SELECT COUNT(*), source FROM cooking_action_timings GROUP BY source;'"
   ```
   Must show more than 40 total rows. If only 40 exist (Wikipedia only),
   halt — the promotion pipeline must run first.

2. **Confirm next migration numbers.** List migrations on slux:
   ```bash
   ssh pilzner@slux "ls /opt/luxlabs/chefsbook/repo/supabase/migrations/ \
     | sort | tail -5"
   ```
   Expected: 084 exists (recipe_steps_technique), next available is **085**.

3. **Read `packages/ai/src/inferStepTimings.ts`** — understand how technique
   and ingredient_category are now captured (from promotion pipeline session).

4. **Read `apps/web/app/dashboard/my-recipes/` and the equivalent mobile
   screen** — understand the My Recipes layout so the sticky card integrates
   correctly at position 2 without breaking existing grid/list rendering.

5. **Read `.omc/planning/05-social-platform.md`** — extract any reputation
   system design decisions already made. Do not contradict them.

6. **Check for existing user points or badges tables:**
   ```bash
   ssh pilzner@slux "docker exec supabase-db psql -U postgres -c \
     \"SELECT to_regclass('public.user_points'),
              to_regclass('public.user_badges'),
              to_regclass('public.knowledge_gaps');\""
   ```
   If any exist, read their schemas before adding columns or tables.

---

## Part 1 — Migration 085: knowledge gaps and community requests

File: `supabase/migrations/20260504_085_knowledge_gaps.sql`

```sql
-- Detected gaps in the knowledge graph
CREATE TABLE knowledge_gaps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  technique TEXT NOT NULL,
  ingredient_category TEXT,
  canonical_key TEXT NOT NULL UNIQUE,
  -- technique:ingredient_category or technique:_none
  observation_count INTEGER NOT NULL DEFAULT 0,
  -- how many recipe_steps observations exist for this key
  priority TEXT NOT NULL DEFAULT 'medium'
    CHECK (priority IN ('low', 'medium', 'high', 'critical')),
  status TEXT NOT NULL DEFAULT 'detected'
    CHECK (status IN (
      'detected',      -- found by gap detection job, not yet reviewed
      'approved',      -- admin approved for community request
      'active',        -- currently shown as community request card
      'agent_hunting', -- agent is actively searching for URLs
      'filled',        -- enough observations now exist
      'dismissed'      -- admin dismissed, not worth pursuing
    )),
  -- community request fields (set when status = active)
  request_title TEXT,
  -- e.g. "a great rotisserie chicken recipe"
  request_body TEXT,
  -- e.g. "Our Sous Chef doesn't know much about this technique yet."
  fill_threshold INTEGER NOT NULL DEFAULT 5,
  -- how many observations needed to mark as filled
  -- admin URL suggestions from agent discovery
  suggested_urls JSONB DEFAULT '[]',
  -- [{"url": "...", "title": "...", "source": "...", "suggested_at": "..."}]
  -- tracking
  detected_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  approved_at TIMESTAMPTZ,
  approved_by UUID REFERENCES auth.users(id),
  filled_at TIMESTAMPTZ,
  dismissed_at TIMESTAMPTZ,
  dismissed_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_knowledge_gaps_status ON knowledge_gaps(status);
CREATE INDEX idx_knowledge_gaps_priority ON knowledge_gaps(priority, status);
CREATE INDEX idx_knowledge_gaps_canonical ON knowledge_gaps(canonical_key);

-- Track which recipe imports were made in response to a gap request
CREATE TABLE gap_contributions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  gap_id UUID NOT NULL REFERENCES knowledge_gaps(id) ON DELETE CASCADE,
  recipe_id UUID NOT NULL REFERENCES recipes(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  points_awarded INTEGER NOT NULL DEFAULT 0,
  is_double_points BOOLEAN NOT NULL DEFAULT TRUE,
  -- gap-filling imports always earn double
  contributed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(gap_id, recipe_id)
);

CREATE INDEX idx_gap_contributions_user ON gap_contributions(user_id);
CREATE INDEX idx_gap_contributions_gap ON gap_contributions(gap_id);

-- RLS
ALTER TABLE knowledge_gaps ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read for active gaps" ON knowledge_gaps
  FOR SELECT USING (status IN ('active', 'agent_hunting'));
CREATE POLICY "Admin full access" ON knowledge_gaps
  USING (EXISTS (
    SELECT 1 FROM admin_users
    WHERE admin_users.user_id = auth.uid()
  ));

ALTER TABLE gap_contributions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users see own contributions" ON gap_contributions
  FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "Users insert own contributions" ON gap_contributions
  FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "Admin full access" ON gap_contributions
  USING (EXISTS (
    SELECT 1 FROM admin_users
    WHERE admin_users.user_id = auth.uid()
  ));
```

---

## Part 2 — Migration 086: points and badges

File: `supabase/migrations/20260504_086_points_badges.sql`

```sql
-- User points balance and history
CREATE TABLE user_points (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  points INTEGER NOT NULL DEFAULT 0,
  -- positive = earned, negative = spent
  action TEXT NOT NULL,
  -- 'recipe_import', 'gap_contribution', 'gap_contribution_double',
  -- 'cooked_it', 'recipe_shared', 'badge_bonus'
  reference_id UUID,
  -- recipe_id, gap_contribution_id, etc.
  description TEXT NOT NULL,
  -- human-readable: "Contributed rotisserie chicken recipe (2× gap bonus)"
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_user_points_user ON user_points(user_id, created_at DESC);

-- Materialised balance view — avoid summing every time
CREATE TABLE user_points_balance (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  total_points INTEGER NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Badge definitions (seeded)
CREATE TABLE badge_definitions (
  id TEXT PRIMARY KEY,
  -- e.g. 'first_contribution', 'gap_filler_5', 'gap_filler_25'
  name TEXT NOT NULL,
  description TEXT NOT NULL,
  icon TEXT NOT NULL,
  -- emoji or icon name
  category TEXT NOT NULL
    CHECK (category IN ('contribution', 'cooking', 'social', 'milestone')),
  threshold INTEGER,
  -- for count-based badges: how many actions required
  is_active BOOLEAN NOT NULL DEFAULT TRUE
);

-- User earned badges
CREATE TABLE user_badges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  badge_id TEXT NOT NULL REFERENCES badge_definitions(id),
  earned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, badge_id)
);

CREATE INDEX idx_user_badges_user ON user_badges(user_id);

-- Seed badge definitions
INSERT INTO badge_definitions (id, name, description, icon, category, threshold) VALUES
  ('first_contribution', 'First Contribution',
   'You helped teach our Sous Chef something new!',
   '🌱', 'contribution', 1),
  ('gap_filler_5', 'Knowledge Keeper',
   'You filled 5 knowledge gaps for the community.',
   '📚', 'contribution', 5),
  ('gap_filler_25', 'Culinary Scholar',
   'You filled 25 knowledge gaps. The Sous Chef is smarter because of you.',
   '🎓', 'contribution', 25),
  ('gap_filler_100', 'Master Contributor',
   '100 gap contributions. You are building ChefsBook's intelligence.',
   '🏆', 'contribution', 100),
  ('first_import', 'Recipe Pioneer',
   'You imported your first recipe into ChefsBook.',
   '✨', 'milestone', 1),
  ('import_10', 'Recipe Collector',
   'You have imported 10 recipes.',
   '📖', 'milestone', 10),
  ('import_50', 'Recipe Curator',
   'You have imported 50 recipes.',
   '👨‍🍳', 'milestone', 50);

-- RLS
ALTER TABLE user_points ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users see own points" ON user_points
  FOR SELECT USING (user_id = auth.uid());

ALTER TABLE user_points_balance ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users see own balance" ON user_points_balance
  FOR SELECT USING (user_id = auth.uid());

ALTER TABLE badge_definitions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read" ON badge_definitions FOR SELECT USING (true);

ALTER TABLE user_badges ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read" ON user_badges FOR SELECT USING (true);
CREATE POLICY "System insert" ON user_badges FOR INSERT
  WITH CHECK (user_id = auth.uid());
```

Point values (set as constants in `packages/ai/src/points.ts`):
```
RECIPE_IMPORT          = 10 points
GAP_CONTRIBUTION       = 20 points (base)
GAP_CONTRIBUTION_BONUS = 20 points (double = 40 total)
COOKED_IT              = 5 points
RECIPE_SHARED          = 5 points
```

---

## Part 3 — Gap detection job

File: `packages/ai/src/detectKnowledgeGaps.ts`

Runs on a schedule (daily cron on slux) or triggered manually from admin.

**Logic:**

1. Query `cooking_action_timings` for all canonical keys with
   `observations_count < fill_threshold` OR `confidence IN ('low', 'medium')`

2. Query the most common `technique + ingredient_category` combinations
   in `recipe_steps` that do NOT have a corresponding `cooking_action_timings`
   entry yet — these are high-frequency gaps.

3. For each gap found, upsert into `knowledge_gaps`:
   - If it already exists: update `observation_count`, recalculate priority
   - If new: insert with `status = 'detected'`

4. Priority scoring:
   ```
   observation_count = 0 AND technique appears in >10 recipe_steps → critical
   observation_count < 3 AND technique appears in >5 recipe_steps  → high
   observation_count < 5                                            → medium
   observation_count >= 5 but confidence = 'low'                   → low
   ```

5. Mark gaps as `filled` where `cooking_action_timings.observations_count
   >= knowledge_gaps.fill_threshold` AND `confidence IN ('high', 'very_high')`

API route: `POST /api/admin/knowledge-gaps/detect`
- Super admin only
- Calls `detectKnowledgeGaps()`
- Returns `{ detected: N, updated: N, filled: N }`

Also wire as a scheduled job: run daily at 3am slux time via a cron
entry or existing cron pattern in the codebase.

---

## Part 4 — Agent URL discovery

File: `packages/ai/src/findGapRecipes.ts`

When an admin marks a gap as `agent_hunting`, this function runs.

**Logic:**
1. Takes `technique` + `ingredient_category` from the gap
2. Calls Claude Sonnet with `web_search` tool
3. Searches for: "best [technique] [ingredient] recipe site:seriouseats.com OR
   site:davidlebovitz.com OR site:smittenkitchen.com OR site:bonappetit.com"
   — use the site compatibility list from `import-quality.md`
4. For each URL found: check it's not already in `recipes` table
   (`source_url_normalized`)
5. Return top 5 candidate URLs with title, source domain, estimated import
   quality (based on known site ratings from `import_site_ratings` table)
6. Save to `knowledge_gaps.suggested_urls`

API route: `POST /api/admin/knowledge-gaps/[id]/find-recipes`
- Super admin only (~$0.01/call — Sonnet + web search)
- Triggers `findGapRecipes()` for the given gap
- Updates gap status to `agent_hunting`
- Returns `{ urls: [...] }`

Log via `logAiCall` with `action: 'find_gap_recipes'`, `model: 'sonnet'`.

---

## Part 5 — Admin gap queue UI

Route: `/admin/knowledge-gaps`
Super admin + admin + proctor access.
Add to admin sidebar under "Intelligence" section.

**Page layout:**

**KPI cards (top row):**
- Total gaps detected
- Active community requests
- Filled this month
- Avg observations per canonical key

**Filter tabs:** Detected · Approved · Active · Agent Hunting · Filled · Dismissed

**Gap table columns:**
- Technique + ingredient (e.g. "rotisserie · chicken")
- Observations (current count / fill threshold)
- Priority pill (Critical/High/Medium/Low)
- Status pill
- Detected date
- Actions

**Actions per gap:**
- **Approve** (detected → approved): opens modal to set `request_title`,
  `request_body`, `fill_threshold`. Pre-fills with AI-suggested copy:
  "a great [technique] [ingredient] recipe"
- **Go Live** (approved → active): makes card visible to users
- **Find Recipes** (any → agent_hunting): triggers `findGapRecipes()`,
  shows suggested URLs with Import buttons
- **Import URL** (from suggested_urls): runs standard import pipeline,
  attributes to `@souschef`, links to this gap via `gap_contributions`
- **Dismiss**: marks as dismissed with optional reason

**Suggested URLs panel** (expandable per gap when `suggested_urls` is populated):
- URL, title, source domain, estimated quality badge
- "Import to @souschef" button per URL
- "Copy URL" button (for manual import via scan page)

---

## Part 6 — Community request card

### Positioning

Inject as position 2 in the My Recipes grid/list on both web and mobile.
Position 1 is always the most recently added recipe. The gap card sits
between it and the rest of the library.

Only show if:
- User is authenticated
- At least one gap has `status = 'active'`
- User has not dismissed this specific gap request in the last 7 days
  (store dismissal in `localStorage` / `AsyncStorage` keyed by gap id)

Rotate through active gaps — show a different one each session.
If no active gaps exist, the card is not rendered (no empty space).

### Web component

File: `apps/web/components/GapRequestCard.tsx`

```
┌─────────────────────────────────────────────┐
│  🧠  Our Sous Chef is looking for...        │
│                                             │
│  A great rotisserie chicken recipe          │
│                                             │
│  Help teach ChefsBook something new and     │
│  earn double points!                        │
│                                             │
│  [I have one!]          [Not now]           │
└─────────────────────────────────────────────┘
```

Style: matches recipe card dimensions exactly so the grid doesn't reflow.
Amber/gold accent (matches existing badge color conventions).
Subtle "🧠" or brain/chef icon — not emoji in production, use SVG.

**"I have one!" flow:**
1. Opens standard import modal (URL import or file scan)
2. Passes `gapId` as context to the import flow
3. On successful import: creates `gap_contributions` row, awards points,
   shows toast: "Thanks! You earned 40 points 🎉"
4. Checks if badge threshold met → awards badge if so

**"Not now" flow:**
1. Dismisses card for 7 days (localStorage)
2. Next session shows next active gap if available

### Mobile component

File: `apps/mobile/components/GapRequestCard.tsx`

Same logic, NativeWind styling matching existing recipe card style.
"I have one!" → navigates to scan tab with gap context passed via
navigation params.

i18n keys needed (all 5 locales):
```
gapRequest.title: "Our Sous Chef is looking for..."
gapRequest.body: "Help teach ChefsBook something new"
gapRequest.doublePoints: "Earn double points!"
gapRequest.cta: "I have one!"
gapRequest.dismiss: "Not now"
gapRequest.successToast: "Thanks! You earned {{points}} points"
```

---

## Part 7 — Points and badges wiring

### Award points

File: `packages/db/src/queries/points.ts`

```typescript
awardPoints(userId, action, points, referenceId, description)
// Inserts into user_points
// Upserts user_points_balance (increment total_points)
// Checks badge thresholds and awards new badges
// Returns { newBalance, newBadges }
```

### Wire into import pipeline

In `apps/web/lib/saveWithModeration.ts`, after successful recipe save:
- If `gapId` was passed in context:
  - Insert `gap_contributions` row
  - Call `awardPoints(userId, 'gap_contribution_double', 40, gapContributionId, ...)`
  - Check if gap observation_count now meets `fill_threshold` → update status
- Else (normal import):
  - Call `awardPoints(userId, 'recipe_import', 10, recipeId, ...)`

### Points display

Points are private — never shown publicly or to other users.
Do NOT add a points balance to the header, nav, or any shared UI.

The only place points appear is on the user's own profile page, in a
private "Your Contributions" section visible only to that user:
- Total points earned (lifetime)
- Recent point history (last 10 actions, simple list)
- No ranking, no comparison to others

### Badge display

Add earned badges to the user's own profile page (web + mobile) in a
quiet "Achievements" section below their bio. Visible to other users
(badges are public recognition) but not prominent — small icons in a
subtle row, not a hero element.

Tooltip/tap shows badge name and a one-line description.

**Milestone popup (private, one-time):**
When a badge is earned, show a single full-screen or bottom-sheet
celebration moment to that user only — badge icon, name, and a short
personal message. Shown once, not repeatable. No sound, no confetti.
Examples:
- "🌱 You taught our Sous Chef something new for the first time."
- "📚 Five gaps filled. The whole community cooks a little better now."

After dismissal, the badge appears quietly in their profile. No further
notifications, no feed posts, no public announcements.

---

## Part 8 — Gap auto-fill detection

After every successful `gap_contribution` import and after every
`promote-step-timings` run, check if any active gaps are now filled:

```sql
UPDATE knowledge_gaps
SET status = 'filled', filled_at = NOW()
WHERE status IN ('active', 'agent_hunting')
  AND canonical_key IN (
    SELECT canonical_key FROM cooking_action_timings
    WHERE observations_count >= (
      SELECT fill_threshold FROM knowledge_gaps kg2
      WHERE kg2.canonical_key = cooking_action_timings.canonical_key
    )
    AND confidence IN ('high', 'very_high')
  );
```

When a gap is filled: remove its community request card for all users
(the card won't render since status is no longer 'active').

---

## Verification

```bash
# Confirm all tables created
ssh pilzner@slux "docker exec supabase-db psql -U postgres -c \
  \"SELECT table_name FROM information_schema.tables
    WHERE table_schema = 'public'
    AND table_name IN (
      'knowledge_gaps', 'gap_contributions',
      'user_points', 'user_points_balance',
      'user_badges', 'badge_definitions'
    );\""

# Confirm badge seed data
ssh pilzner@slux "docker exec supabase-db psql -U postgres -c \
  'SELECT id, name, threshold FROM badge_definitions ORDER BY threshold;'"

# Trigger gap detection and confirm gaps are found
curl -X POST https://chefsbk.app/api/admin/knowledge-gaps/detect \
  -H "Authorization: Bearer <admin_token>"
# Should return { detected: N, updated: N, filled: N } with N > 0

# Confirm gap card renders at position 2 in My Recipes
# (requires at least one gap with status = 'active' in DB)
```

**Web UI verification:**
- `/admin/knowledge-gaps` loads for admin, 401 for non-admin
- Gap detection returns results
- Approve flow opens modal, sets request text, saves correctly
- Go Live makes gap `status = 'active'`
- Find Recipes triggers agent search, populates suggested_urls
- Community request card appears at position 2 on `/dashboard`
- "I have one!" opens import modal
- Successful import awards 40 points, shows toast
- Badge awarded on threshold met
- Points balance visible in header
- No console errors throughout

**Mobile verification (ADB):**
- Gap card visible at position 2 in My Recipes tab
- "I have one!" navigates to scan tab with gap context
- Points balance visible on profile tab
- Badges visible on profile screen

---

## Deploy

Follow `deployment.md`. Deploy web to slux.
Apply migrations 085 and 086 in order before deploying.
Run `docker restart supabase-rest` after each migration.
Build and deploy mobile APK if gap card is confirmed working on web first.

---

## Wrapup

Follow `wrapup.md` fully. Log in DONE.md:

- Migrations 085 + 086 applied
- N knowledge gaps detected on first run
- N gaps approved and set to active
- Gap request card live on web + mobile
- Points system live: actions and values
- Badges seeded: list all badge IDs
- Agent URL discovery wired (`findGapRecipes`)

Add to AGENDA.md:
- [ ] Set up daily cron for gap detection on slux (3am)
- [ ] Run `promote-step-timings.mjs` weekly as cron
- [ ] Monitor gap fill rate over first 30 days
- [ ] Review badge thresholds after 90 days of data
