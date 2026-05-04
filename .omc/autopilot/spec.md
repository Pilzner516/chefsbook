# Community Knowledge Engine — Specification

## Vision
Transform knowledge gaps in ChefsBook's AI into community engagement. When the knowledge graph lacks data on a technique+ingredient combination (e.g., "rotisserie chicken"), that gap becomes a community request card. Users who contribute earn points and badges.

## Dependencies
- ✅ knowledge-graph-promotion.md completed (194 rows in cooking_action_timings)
- ✅ Migration 084 exists, next available: 085-086

## Core Components

### 1. Database Schema (Migrations 085-086)

**Migration 085: Knowledge Gaps**
- `knowledge_gaps` table: tracks technique+ingredient gaps with priority, status, community request text
- `gap_contributions` table: links recipes to gaps, tracks points awarded
- Status flow: detected → approved → active → filled/dismissed
- RLS: public read for active gaps, admin full access

**Migration 086: Points & Badges**
- `user_points` table: transaction log (earn/spend)
- `user_points_balance` table: materialized balance
- `badge_definitions` table: seeded with 7 badges
- `user_badges` table: earned badges per user
- Point values: import=10, gap_contribution=40 (double), cooked_it=5

### 2. Gap Detection Job
- Query cooking_action_timings for low-confidence or low-observation entries
- Query recipe_steps for common technique+ingredient combos not in knowledge graph
- Priority scoring: critical (0 obs, high frequency) → low (≥5 obs, low confidence)
- Auto-mark filled when observations_count ≥ fill_threshold + confidence high
- API: POST /api/admin/knowledge-gaps/detect (super admin)

### 3. Agent URL Discovery
- Takes technique + ingredient_category from gap
- Claude Sonnet web_search on curated sites (seriouseats, bonappetit, etc.)
- Returns top 5 URLs with quality estimates from import_site_tracker
- Saves to gap.suggested_urls JSONB
- API: POST /api/admin/knowledge-gaps/[id]/find-recipes (~$0.01/call)

### 4. Admin Gap Queue UI
- Route: /admin/knowledge-gaps
- KPI cards: total detected, active requests, filled this month, avg observations
- Filter tabs: Detected / Approved / Active / Agent Hunting / Filled / Dismissed
- Gap table: technique+ingredient, observations, priority pill, status pill, actions
- Actions: Approve (modal for request text), Go Live, Find Recipes, Import URL, Dismiss
- Suggested URLs panel: expandable per gap, shows quality badge, import buttons

### 5. Community Request Card
**Positioning:**
- Web: position 2 in grid (after FeedbackCard at position 1)
- Mobile: after FeedbackCard in FlashList header
- Only shows if: user authenticated + ≥1 gap with status='active' + not dismissed in last 7 days
- Rotate through active gaps each session

**Card design:**
- Brain icon (SVG not emoji)
- Title: "Our Sous Chef is looking for..."
- Body: gap.request_title (e.g., "a great rotisserie chicken recipe")
- Subtitle: "Help teach ChefsBook something new and earn double points!"
- CTAs: [I have one!] [Not now]

**"I have one!" flow:**
- Opens import modal with gapId context
- On success: creates gap_contributions row, awards 40 points, shows toast
- Checks badge thresholds, awards if met
- Shows one-time celebration modal for new badges

**"Not now" flow:**
- Dismisses for 7 days (localStorage/AsyncStorage by gap id)

### 6. Points & Badges Wiring
**Award points function:**
```typescript
awardPoints(userId, action, points, referenceId, description)
// Inserts user_points row
// Upserts user_points_balance
// Checks badge thresholds
// Returns { newBalance, newBadges }
```

**Import pipeline integration:**
- Web: saveWithModeration.ts after successful save
- Mobile: recipeStore.addRecipe after successful save
- If gapId present: 40 points + gap_contributions row
- Else: 10 points for normal import

**Points display:**
- Private only: user's own profile page
- "Your Contributions" section: lifetime total + last 10 actions
- No public ranking, no comparison

**Badge display:**
- Public: quiet row in profile "Achievements" section
- Tooltip/tap: badge name + description
- One-time celebration popup on earn: full-screen/bottom-sheet, badge icon + message

### 7. Auto-fill Detection
After every gap_contribution and after promote-step-timings runs:
```sql
UPDATE knowledge_gaps SET status='filled', filled_at=NOW()
WHERE status IN ('active','agent_hunting')
AND canonical_key IN (
  SELECT canonical_key FROM cooking_action_timings
  WHERE observations_count >= fill_threshold
  AND confidence IN ('high','very_high')
)
```

## Implementation Order (Ultrawork)

1. **Pre-flight + schema verification** (architect, opus) — sequential
2. **Migrations 085 + 086** (coder, sonnet) — sequential
3. **Gap detection job** (coder, sonnet) — after migrations
4. **Parallel block 1:**
   - Admin gap queue UI (coder, sonnet)
   - Agent URL discovery (coder, sonnet)
   - Community request card web (coder, sonnet)
   - Community request card mobile (coder, sonnet)
   - Points + badges system (coder, sonnet)
5. **Import pipeline wiring** (coder, sonnet) — after parallel block
6. **TypeScript check + deploy** (coder, sonnet) — after wiring
7. **Verification** (coder, haiku) — after deploy
8. **Wrapup** (architect, sonnet) — final

## Success Criteria
- ✅ All tables created and seeded
- ✅ Gap detection returns results
- ✅ Admin UI functional (detect, approve, go live, find recipes)
- ✅ Gap card renders at position 2 on web + mobile
- ✅ Import awards points correctly (10 normal, 40 gap)
- ✅ Badges awarded on threshold
- ✅ Web deployed to slux
- ✅ No TypeScript errors
- ✅ No console errors

## AI Cost
- Gap detection: Haiku ~$0.0003/gap check (classification)
- Agent URL discovery: Sonnet + web_search ~$0.01/call (admin-triggered)
- Total estimated: ~$0.50 for initial setup + $5/month ongoing

## Non-Goals (Future Work)
- Mobile notification UI (web has NotificationBell, mobile deferred)
- Mobile message inbox (web has threads, mobile deferred)
- Daily cron setup (manual trigger for now)
- Weekly promote-step-timings cron
