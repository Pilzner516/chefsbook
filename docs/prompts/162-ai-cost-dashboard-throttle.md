# ChefsBook — Session 162: AI Cost Dashboard + User Cost Tracking + Throttle System
# Source: Need visibility into AI costs + automatic circuit breaker for high-cost users
# Target: packages/db + packages/ai + apps/web (admin) + database

---

## CONTEXT

Read CLAUDE.md, DONE.md, feature-registry.md, and ai-cost.md before
touching anything.

This session builds three interconnected systems:
1. AI usage logging on every API call
2. Admin cost dashboard with aggregated views
3. Automatic throttle system with admin-configurable thresholds

---

## PART 1 — Database: AI Usage Logging

### Migration 041

```sql
-- AI usage log — one row per AI call
CREATE TABLE ai_usage_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES user_profiles(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  -- Actions: 'import_url', 'import_file', 'import_scan', 'import_speak',
  --          'translate_recipe', 'detect_language', 'describe_image',
  --          'rewrite_steps', 'moderate_recipe', 'suggest_tags',
  --          'generate_image', 'regenerate_image', 'check_watermark',
  --          'generate_ingredients', 'generate_meal_plan',
  --          'merge_shopping_list', 'suggest_recipes', 'translate_titles'
  model TEXT NOT NULL,
  -- Models: 'haiku', 'sonnet', 'flux-schnell', 'flux-dev'
  tokens_in INT DEFAULT 0,
  tokens_out INT DEFAULT 0,
  cost_usd NUMERIC(10,6) NOT NULL,
  recipe_id UUID REFERENCES recipes(id) ON DELETE SET NULL,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX ON ai_usage_log(user_id, created_at DESC);
CREATE INDEX ON ai_usage_log(action, created_at DESC);
CREATE INDEX ON ai_usage_log(created_at DESC);
CREATE INDEX ON ai_usage_log(user_id, action, created_at DESC);

-- Pre-aggregated daily totals (updated by cron or trigger)
CREATE TABLE ai_usage_daily (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date DATE NOT NULL,
  user_id UUID REFERENCES user_profiles(id) ON DELETE CASCADE,
  action TEXT NOT NULL,
  model TEXT NOT NULL,
  call_count INT DEFAULT 0,
  total_cost_usd NUMERIC(10,4) DEFAULT 0,
  UNIQUE(date, user_id, action, model)
);

CREATE INDEX ON ai_usage_daily(date DESC);
CREATE INDEX ON ai_usage_daily(user_id, date DESC);

-- User throttle state
CREATE TABLE user_throttle (
  user_id UUID PRIMARY KEY REFERENCES user_profiles(id) ON DELETE CASCADE,
  is_throttled BOOLEAN DEFAULT false,
  throttle_level TEXT DEFAULT NULL
    CHECK (throttle_level IN ('yellow', 'red', NULL)),
  throttled_at TIMESTAMPTZ,
  throttled_reason TEXT,
  auto_restore_at TIMESTAMPTZ,  -- next billing cycle reset
  admin_override BOOLEAN DEFAULT false,  -- admin whitelist
  override_by UUID REFERENCES user_profiles(id),
  override_note TEXT,
  monthly_cost_usd NUMERIC(10,4) DEFAULT 0,
  monthly_cost_updated_at TIMESTAMPTZ
);

-- Throttle thresholds (admin-configurable)
-- These go in system_settings table (already exists)
INSERT INTO system_settings (key, value) VALUES
  -- Yellow threshold: % of expected plan cost
  ('throttle_yellow_pct', '150'),
  -- Red threshold: % of expected plan cost
  ('throttle_red_pct', '300'),
  -- Grace period for new users (days)
  ('throttle_grace_days', '30'),
  -- Rolling window for burst detection (days)
  ('throttle_window_days', '7'),
  -- Expected monthly cost per plan (USD)
  ('throttle_expected_cost_free', '0.05'),
  ('throttle_expected_cost_chef', '0.20'),
  ('throttle_expected_cost_family', '0.71'),
  ('throttle_expected_cost_pro', '0.44'),
  -- Whether throttling is enabled at all
  ('throttle_enabled', 'true')
ON CONFLICT (key) DO NOTHING;
```

---

## PART 2 — AI Usage Logging in packages/ai

### 2a — logAiCall() helper in packages/db

```typescript
// Cost per model (keep in sync with ai-cost.md)
const MODEL_COSTS = {
  haiku: { input: 0.00000025, output: 0.00000125 },
  sonnet: { input: 0.000003, output: 0.000015 },
  'flux-schnell': { fixed: 0.003 },
  'flux-dev': { fixed: 0.025 },
}

export async function logAiCall({
  userId,
  action,
  model,
  tokensIn = 0,
  tokensOut = 0,
  recipeId,
  metadata = {}
}: AiCallLog) {
  const costs = MODEL_COSTS[model]
  const costUsd = costs.fixed
    ?? (tokensIn * costs.input + tokensOut * costs.output)

  await supabaseAdmin.from('ai_usage_log').insert({
    user_id: userId ?? null,
    action,
    model,
    tokens_in: tokensIn,
    tokens_out: tokensOut,
    cost_usd: costUsd,
    recipe_id: recipeId ?? null,
    metadata
  })

  // Check throttle after logging
  if (userId) {
    await checkAndUpdateThrottle(userId)
  }

  return costUsd
}
```

### 2b — Wire logAiCall() into every AI function

Add logAiCall() at the end of every function in packages/ai:

```typescript
// Example: in importFromUrl()
const result = await callClaude({ ... })
await logAiCall({
  userId,
  action: 'import_url',
  model: 'haiku',
  tokensIn: result.usage.input_tokens,
  tokensOut: result.usage.output_tokens,
  recipeId
})

// Example: in generateRecipeImage()
await logAiCall({
  userId,
  action: 'generate_image',
  model: useFluxDev ? 'flux-dev' : 'flux-schnell',
  recipeId
})
```

Functions to wire (all of them):
- importFromUrl, importFromFile, scanRecipe, speakRecipe
- detectLanguage, translateRecipeToLanguage, translateTitles
- describeSourceImage, rewriteRecipeSteps
- isActuallyARecipe, moderateRecipe
- suggestTags, suggestRecipes
- generateRecipeImage, regenerateImage
- checkImageForWatermarks, generateMissingIngredients
- generateMealPlan, mergeShoppingList

### 2c — Daily aggregation function

Run nightly to aggregate ai_usage_log → ai_usage_daily:

```typescript
export async function aggregateDailyUsage(date: string) {
  await supabaseAdmin.rpc('aggregate_ai_usage_daily', { target_date: date })
}
```

SQL function:
```sql
CREATE OR REPLACE FUNCTION aggregate_ai_usage_daily(target_date DATE)
RETURNS void AS $$
  INSERT INTO ai_usage_daily
    (date, user_id, action, model, call_count, total_cost_usd)
  SELECT
    target_date,
    user_id,
    action,
    model,
    COUNT(*) as call_count,
    SUM(cost_usd) as total_cost_usd
  FROM ai_usage_log
  WHERE DATE(created_at) = target_date
  GROUP BY user_id, action, model
  ON CONFLICT (date, user_id, action, model)
  DO UPDATE SET
    call_count = EXCLUDED.call_count,
    total_cost_usd = EXCLUDED.total_cost_usd;
$$ LANGUAGE sql;
```

---

## PART 3 — Throttle System

### 3a — checkAndUpdateThrottle() in packages/db

```typescript
export async function checkAndUpdateThrottle(userId: string) {
  // Get throttle settings from system_settings
  const settings = await getThrottleSettings()
  if (!settings.enabled) return

  // Check admin override (whitelist)
  const { data: throttle } = await supabaseAdmin
    .from('user_throttle')
    .select('*')
    .eq('user_id', userId)
    .single()

  if (throttle?.admin_override) return  // whitelisted

  // Get user's plan and registration date
  const { data: profile } = await supabaseAdmin
    .from('user_profiles')
    .select('plan_tier, created_at')
    .eq('id', userId)
    .single()

  // Grace period check
  const daysSinceRegistration = daysSince(profile.created_at)
  if (daysSinceRegistration < settings.graceDays) return

  // Get rolling window cost
  const windowStart = daysAgo(settings.windowDays)
  const { data: usage } = await supabaseAdmin
    .from('ai_usage_log')
    .select('cost_usd')
    .eq('user_id', userId)
    .gte('created_at', windowStart)

  const windowCost = usage?.reduce((sum, r) => sum + r.cost_usd, 0) ?? 0

  // Expected cost for the window period
  const expectedMonthly = settings.expectedCosts[profile.plan_tier] ?? 0.20
  const expectedWindow = expectedMonthly * (settings.windowDays / 30)

  // Calculate thresholds
  const yellowThreshold = expectedWindow * (settings.yellowPct / 100)
  const redThreshold = expectedWindow * (settings.redPct / 100)

  // Determine throttle level
  let newLevel: 'yellow' | 'red' | null = null
  if (windowCost >= redThreshold) newLevel = 'red'
  else if (windowCost >= yellowThreshold) newLevel = 'yellow'

  // Update throttle state
  await supabaseAdmin.from('user_throttle').upsert({
    user_id: userId,
    is_throttled: newLevel === 'red',
    throttle_level: newLevel,
    throttled_at: newLevel ? new Date().toISOString() : null,
    throttled_reason: newLevel
      ? `${settings.windowDays}-day cost $${windowCost.toFixed(4)} exceeds ${newLevel} threshold $${(newLevel === 'red' ? redThreshold : yellowThreshold).toFixed(4)}`
      : null,
    monthly_cost_usd: windowCost,
    monthly_cost_updated_at: new Date().toISOString()
  }, { onConflict: 'user_id' })

  // Notify admin on new red throttle
  if (newLevel === 'red' && throttle?.throttle_level !== 'red') {
    await createAdminNotification({
      type: 'user_throttled',
      message: `User throttled (red): ${userId} — cost $${windowCost.toFixed(4)} in ${settings.windowDays} days`
    })
  }
}
```

### 3b — isUserThrottled() check before expensive AI calls

```typescript
export async function isUserThrottled(userId: string): Promise<boolean> {
  const { data } = await supabaseAdmin
    .from('user_throttle')
    .select('is_throttled, admin_override')
    .eq('user_id', userId)
    .single()

  if (data?.admin_override) return false
  return data?.is_throttled ?? false
}
```

### 3c — Wire throttle check into expensive AI functions

Before image generation, translation, and meal planning:

```typescript
// In generateRecipeImage()
if (userId && await isUserThrottled(userId)) {
  // Return a soft failure — don't throw an error
  return {
    throttled: true,
    message: 'AI features are temporarily limited due to high demand.'
  }
}

// In translateRecipeToLanguage()
if (userId && await isUserThrottled(userId)) {
  return recipe  // Return untranslated (silent degradation)
}

// In generateMealPlan()
if (userId && await isUserThrottled(userId)) {
  throw new ThrottleError('AI features temporarily limited')
}
```

### 3d — User-facing throttle messages

When a throttled user tries to use an AI feature:

```
We're experiencing high demand on AI features right now.
Image generation and translation are temporarily limited.
Basic recipe import and viewing work normally.
AI features will be restored automatically.
```

NEVER say:
- "your account"
- "your usage"
- "you've exceeded"
- "cost"
- "throttle" or "limit"

Always frame as platform-wide, temporary, automatic restoration.

### 3e — Auto-restore at billing cycle

Add to the monthly cron job:
```typescript
// First day of each month: clear all non-override throttles
await supabaseAdmin
  .from('user_throttle')
  .update({
    is_throttled: false,
    throttle_level: null,
    throttled_at: null,
    throttled_reason: null,
    monthly_cost_usd: 0
  })
  .eq('admin_override', false)
  .eq('is_throttled', true)
```

---

## PART 4 — Admin Cost Dashboard (/admin/costs)

### 4a — New admin page: /admin/costs

Add to admin sidebar: "💰 Costs" link.

### 4b — Dashboard sections

**Section 1 — Platform Overview (top KPI cards)**
```
┌──────────────┐ ┌──────────────┐ ┌──────────────┐ ┌──────────────┐
│ Today        │ │ This Month   │ │ This Month   │ │ Avg Cost     │
│ $X.XX        │ │ $XX.XX       │ │ Revenue      │ │ Per User     │
│ AI spend     │ │ AI spend     │ │ $XXX.XX      │ │ $X.XX        │
└──────────────┘ └──────────────┘ └──────────────┘ └──────────────┘
```

**Section 2 — Cost by Action (bar chart)**
Horizontal bar chart showing total cost this month per action:
- generate_image: $XX.XX (XX%)
- import_url: $XX.XX (XX%)
- translate_recipe: $XX.XX (XX%)
- generate_meal_plan: $XX.XX (XX%)
- etc.

**Section 3 — Cost by Model (pie/donut)**
- Haiku: XX% ($XX.XX)
- Sonnet: XX% ($XX.XX)
- Flux Schnell: XX% ($XX.XX)
- Flux Dev: XX% ($XX.XX)

**Section 4 — Daily Cost Trend (line chart)**
Last 30 days, daily AI spend line.

**Section 5 — Top Cost Users**
Table: top 10 users by AI cost this month
| User | Plan | Cost | Revenue | Delta | Throttle |
| @pilzner | Pro | $X.XX | $14.99 | +$X.XX | — |

**Section 6 — Throttled Users**
List of currently throttled users with:
- Username, plan, cost, threshold hit
- [Remove throttle] button (admin override)
- [Whitelist] button (permanent admin override)

---

## PART 5 — Throttle Settings in Admin

On the admin costs page or /admin/settings, add a
"Throttle Configuration" section:

```
Throttle Configuration
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Status: [● Enabled / ○ Disabled]

Rolling window: [7] days
Grace period for new users: [30] days

Yellow threshold (warning only): [150]% of expected plan cost
Red threshold (AI features limited): [300]% of expected plan cost

Expected monthly cost by plan:
  Free:   $[0.05]
  Chef:   $[0.20]
  Family: $[0.71]
  Pro:    $[0.44]

Current effective red thresholds (7-day window):
  Free:   $0.035  (300% × $0.05 × 7/30)
  Chef:   $0.14   (300% × $0.20 × 7/30)
  Family: $0.50   (300% × $0.71 × 7/30)
  Pro:    $0.31   (300% × $0.44 × 7/30)

[Save changes]
```

All values editable. Saving updates system_settings table.
Thresholds recalculate live as values change.

---

## PART 6 — Per-User Cost in Admin Users Table

On /admin/users, add columns:
- **Cost (MTD)**: current month AI cost from user_throttle.monthly_cost_usd
- **Revenue (MTD)**: plan_tier × months active this billing period
- **Delta**: Revenue − Cost (green if positive, red if negative)
- **Throttle**: pill showing None / ⚠️ Yellow / 🔴 Red

On the user detail page, add a "Cost History" section:
- Last 30 days daily cost chart
- Breakdown by action (what is this user spending on?)
- Throttle history (when were they throttled, why)
- [Whitelist from throttling] toggle
- [Manual throttle] button (admin can throttle manually too)

---

## PART 7 — Admin Overview Page Overhaul (/admin)

The current admin overview is minimal. Replace it with a
comprehensive command center dashboard.

### 7a — Layout: 4 sections

**Section 1 — Platform Health (top row, 6 KPI cards)**
```
┌──────────────┐ ┌──────────────┐ ┌──────────────┐
│ Total Users  │ │ Active Today │ │ New This Week│
│ 1,247        │ │ 89           │ │ 34           │
│ ↑ 12% MoM   │ │              │ │              │
└──────────────┘ └──────────────┘ └──────────────┘
┌──────────────┐ ┌──────────────┐ ┌──────────────┐
│ Total Recipes│ │ Imports Today│ │ AI Images    │
│ 12,847       │ │ 234          │ │ 8,921        │
│              │ │              │ │ Generated    │
└──────────────┘ └──────────────┘ └──────────────┘
```

**Section 2 — Revenue & Cost (second row)**
```
┌──────────────────────┐ ┌──────────────────────┐
│ MRR                  │ │ AI Cost MTD          │
│ $X,XXX               │ │ $XX.XX               │
│ Chef: N · Fam: N     │ │ Margin: XX%          │
│ Pro: N               │ │ vs revenue: $X,XXX   │
└──────────────────────┘ └──────────────────────┘
┌──────────────────────┐ ┌──────────────────────┐
│ Plan Distribution    │ │ Throttled Users      │
│ Free: XX%            │ │ 🔴 Red: N            │
│ Chef: XX%            │ │ ⚠️ Yellow: N         │
│ Family: XX%          │ │ [View all]           │
│ Pro: XX%             │ │                      │
└──────────────────────┘ └──────────────────────┘
```

**Section 3 — Content & Quality (third row)**
```
┌──────────────────────┐ ┌──────────────────────┐
│ Import Success Rate  │ │ Incomplete Recipes   │
│ XX% (last 7 days)    │ │ N recipes            │
│ Server: XX%          │ │ Needs review         │
│ Extension: XX%       │ │ [Review →]           │
└──────────────────────┘ └──────────────────────┘
┌──────────────────────┐ ┌──────────────────────┐
│ Pending Flags        │ │ Copyright Queue      │
│ N items              │ │ N pending            │
│ [Review →]           │ │ [Review →]           │
└──────────────────────┘ └──────────────────────┘
```

**Section 4 — Activity Feed (bottom, full width)**
Last 20 system events in a live feed:
- ✅ Recipe imported: "Chocolate Chip Cookies" by @username
- 🎨 AI image generated for "Pasta Carbonara"
- 🚩 Recipe flagged for copyright by @username2
- 🔴 User @username3 throttled (red level)
- 👤 New user registered: @username4 (Chef plan)
- ⚠️ Import failed: allrecipes.com (needs extension)

Feed pulls from:
- import_attempts (recent imports)
- ai_usage_log (recent AI calls)
- recipe_flags (recent flags)
- user_throttle (throttle events)
- user_profiles (new registrations)

Auto-refreshes every 30 seconds.

### 7b — Quick action buttons on overview

Row of quick action buttons below KPI cards:
- [Run Site Tests] → opens /admin/import-sites test modal
- [View Incomplete] → /admin/incomplete-recipes
- [View Flags] → /admin/flags
- [View Copyright] → /admin/copyright
- [View Costs] → /admin/costs

### 7c — System status indicators

Small status row showing:
- 🟢 Database: Online
- 🟢 AI API: Online (show current Anthropic credit balance if available)
- 🟢 Replicate: Online (show credit balance)
- 🟢 Storage: Online
- 🟢 Cloudflare Tunnel: Online
- 🔴 / 🟡 if any service has issues

For Replicate balance — call GET https://api.replicate.com/v1/account
to get billing info and show remaining credits.

---

## DEPLOYMENT

```bash
ssh rasp@rpi5-eth

# Apply migration 041
docker exec -it supabase-db psql -U postgres -d postgres \
  -f /mnt/chefsbook/repo/supabase/migrations/041_ai_cost_tracking.sql
docker restart supabase-rest

cd /mnt/chefsbook/repo
git pull
cd apps/web
rm -rf node_modules/react node_modules/react-dom .next
NODE_OPTIONS=--max-old-space-size=1536 npm run build 2>&1 | tail -20
pm2 restart chefsbook-web
```

---

## COMPLETION CHECKLIST

### Database
- [ ] Migration 041 applied: ai_usage_log, ai_usage_daily, user_throttle tables
- [ ] system_settings populated with throttle thresholds
- [ ] aggregate_ai_usage_daily SQL function created
- [ ] PostgREST restarted

### Logging
- [ ] logAiCall() in packages/db
- [ ] Wired into ALL AI functions (list every one confirmed)
- [ ] Cost calculated correctly per model

### Throttle system
- [ ] checkAndUpdateThrottle() runs after every AI call
- [ ] isUserThrottled() checked before expensive functions
- [ ] Grace period respected (30 days new users)
- [ ] Yellow/red thresholds from system_settings (not hardcoded)
- [ ] User-facing messages never mention cost/throttle/account
- [ ] Admin notified on new red throttle
- [ ] Auto-restore wired into monthly cron

### Admin cost dashboard
- [ ] /admin/costs page created
- [ ] KPI cards: today / month / revenue / avg per user
- [ ] Cost by action bar chart
- [ ] Cost by model breakdown
- [ ] Daily trend line chart (30 days)
- [ ] Top cost users table
- [ ] Throttled users list with remove/whitelist actions

### Throttle settings
- [ ] Admin settings section with all thresholds editable
- [ ] Effective thresholds calculated and shown
- [ ] All values from system_settings (nothing hardcoded)

### Per-user costs in admin
- [ ] Cost MTD column on /admin/users table
- [ ] Revenue MTD column
- [ ] Delta column (green/red)
- [ ] Throttle status pill
- [ ] User detail: cost history chart + action breakdown
- [ ] Whitelist toggle + manual throttle button

### Admin Overview overhaul (Part 7)
- [ ] 6 platform health KPI cards (users, active, new, recipes, imports, images)
- [ ] Revenue & cost section (MRR, AI cost MTD, margin, plan distribution)
- [ ] Throttled users count with link to full list
- [ ] Content quality section (import success rate, incomplete recipes, flags, copyright)
- [ ] Live activity feed (last 20 events, auto-refresh 30s)
- [ ] Quick action buttons row
- [ ] System status indicators (DB, AI API, Replicate, Storage, Tunnel)
- [ ] Replicate credit balance shown in status row

### General
- [ ] feature-registry.md updated
- [ ] ai-cost.md updated
- [ ] tsc --noEmit passes both apps
- [ ] Deployed to RPi5
- [ ] Run /wrapup
- [ ] At the end: show the top 3 cost actions from ai_usage_log,
      confirm throttle settings are all from system_settings,
      confirm no thresholds are hardcoded anywhere.
