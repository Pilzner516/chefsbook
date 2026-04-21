# ChefsBook — Session 166: Complete Session 162 Incomplete Items
# Source: Session 162 left 9 of 15 checklist items incomplete
# Target: packages/ai + packages/db + apps/web (admin)

---

## CONTEXT

Read CLAUDE.md, DONE.md, feature-registry.md, ai-cost.md, and
docs/prompts/WRAPUP-STANDARD.md before touching anything.

Session 162 completed: migration 045, logAiCall() base function,
logging in 3 API routes, /admin/costs page skeleton, admin overview
KPI cards, sidebar link.

Session 162 DID NOT complete:
- Part 0: image generation fixes (wrong dish, same regen image)
- Throttle logic (checkAndUpdateThrottle, isUserThrottled)
- logAiCall() wired into remaining 15+ AI functions
- Throttle settings UI in admin
- Per-user cost/revenue/delta columns on /admin/users
- Activity feed on admin overview
- System status indicators
- Daily aggregation cron
- Auto-restore throttle at billing cycle reset

This session completes ALL of the above.

---

## PART 0 — Fix image generation (FIRST — highest user impact)

### 0a — Fix buildImagePrompt() — dish name must always anchor the prompt

Read packages/ai/src/imageGeneration.ts (or imageThemes.ts).
Find buildImagePrompt(). Fix it:

```typescript
export async function buildImagePrompt(
  recipe: Recipe,
  theme: ImageTheme = 'bright_fresh',
  modifier?: string,
  creativityLevel: CreativityLevel = 3
): Promise<string> {
  const creativity = CREATIVITY_PROMPTS[creativityLevel]

  // Clean the dish name — remove generic words
  const dishName = recipe.title
    .replace(/recipe/gi, '')
    .replace(/how to make/gi, '')
    .replace(/\|.*$/, '')  // remove site name after pipe
    .trim()

  const keyIngredients = (recipe.ingredients ?? [])
    .slice(0, 3)
    .map(i => i.name)
    .filter(Boolean)
    .join(', ')

  // Source description: supplementary only at levels 1-2
  // NEVER replaces the dish name
  const sourceContext = (creativity.useSourceDescription
    && recipe.source_image_description)
    ? `presented similarly to: ${recipe.source_image_description}`
    : ''

  return [
    `Professional food photography of ${dishName}`,  // ALWAYS first
    keyIngredients ? `featuring ${keyIngredients}` : '',
    sourceContext,
    `served in a dish appropriate for ${dishName}`,  // prevents wrong vessel
    creativity.promptModifier,
    IMAGE_THEMES[theme].prompt,
    modifier ?? '',
    'high resolution, no text, no watermarks, no people, photorealistic'
  ].filter(Boolean).join(', ')
}
```

### 0b — Fix regen pills — stronger modifiers + random seed

Update REGEN_PILLS in packages/ai:

```typescript
export const REGEN_PILLS = [
  {
    id: 'wrong_dish',
    label: '🍽️ Dish looks wrong',
    modifier: 'CRITICAL: the image must clearly show the dish named in the title. Completely different angle, plating, and background. Make the dish instantly recognizable.'
  },
  {
    id: 'update_scene',
    label: '🏡 Change the scene',
    modifier: 'completely different background environment and surface material, different color palette'
  },
  {
    id: 'brighter',
    label: '☀️ Make it brighter',
    modifier: 'very bright high-key lighting, white marble surface, airy overexposed atmosphere'
  },
  {
    id: 'moodier',
    label: '🌙 Make it moodier',
    modifier: 'dark low-key dramatic lighting, deep shadows, candlelit atmosphere, rich dark tones'
  },
  {
    id: 'closer',
    label: '🔍 Zoom in closer',
    modifier: 'extreme macro close-up shot, lens inches from food, bokeh background'
  },
  {
    id: 'overhead',
    label: '📸 Overhead view',
    modifier: 'perfect overhead aerial flat lay, camera pointing straight down at the dish'
  },
]
```

Add random seed to every Replicate call:
```typescript
input: {
  prompt,
  aspect_ratio: '4:3',
  num_outputs: 1,
  output_format: 'jpg',
  output_quality: 85,
  safety_tolerance: 5,
  seed: Math.floor(Math.random() * 999999)  // guarantees different image
}
```

### 0c — Test

After fixing, run generate-recipe-images.mjs for one test recipe
and confirm the image matches the dish name.

---

## PART 1 — Wire logAiCall() into ALL remaining AI functions

Session 162 only wired 3 routes. Wire into ALL of these:

Read every file in packages/ai/src/ and add logAiCall() to:

```typescript
// Pattern for every function:
const response = await callClaude({ ... })
await logAiCall({
  userId,
  action: 'FUNCTION_NAME',  // use the action names from migration 045
  model: 'haiku' | 'sonnet',
  tokensIn: response.usage?.input_tokens ?? 0,
  tokensOut: response.usage?.output_tokens ?? 0,
  recipeId
})
```

Functions that still need wiring:
- detectLanguage() → action: 'detect_language', model: 'haiku'
- translateRecipeToLanguage() → action: 'translate_recipe', model: 'sonnet'
- describeSourceImage() → action: 'describe_image', model: 'haiku'
- rewriteRecipeSteps() → action: 'rewrite_steps', model: 'haiku'
- isActuallyARecipe() → action: 'moderate_recipe', model: 'haiku'
- moderateRecipe() → action: 'moderate_recipe', model: 'haiku'
- suggestTags() → action: 'suggest_tags', model: 'haiku'
- suggestRecipes() → action: 'suggest_recipes', model: 'haiku'
- generateMissingIngredients() → action: 'generate_ingredients', model: 'sonnet'
- generateMealPlan() → action: 'generate_meal_plan', model: 'sonnet'
- mergeShoppingList() → action: 'merge_shopping_list', model: 'haiku'
- checkImageForWatermarks() → action: 'check_watermark', model: 'haiku'
- scanRecipe() → action: 'import_scan', model: 'sonnet'
- speakRecipe() → action: 'import_speak', model: 'sonnet'
- regenerateImage() → action: 'regenerate_image', model: 'flux-schnell' or 'flux-dev'

For Replicate calls (no token counts):
```typescript
await logAiCall({
  userId,
  action: 'generate_image',
  model: useFluxDev ? 'flux-dev' : 'flux-schnell',
  tokensIn: 0,
  tokensOut: 0,
  recipeId
})
```

---

## PART 2 — Throttle system (the actual logic)

Session 162 created the tables but NOT the throttle logic.

### 2a — checkAndUpdateThrottle() in packages/db

```typescript
export async function checkAndUpdateThrottle(userId: string): Promise<void> {
  // Get settings from system_settings
  const settings = await getThrottleSettings()
  if (!settings.enabled) return

  // Check admin whitelist
  const { data: throttle } = await supabaseAdmin
    .from('user_throttle')
    .select('admin_override, throttle_level')
    .eq('user_id', userId)
    .single()

  if (throttle?.admin_override) return

  // Get user plan + registration date
  const { data: profile } = await supabaseAdmin
    .from('user_profiles')
    .select('plan_tier, created_at')
    .eq('id', userId)
    .single()

  // Grace period
  const daysSinceJoined = (Date.now() - new Date(profile.created_at).getTime())
    / (1000 * 60 * 60 * 24)
  if (daysSinceJoined < settings.graceDays) return

  // Rolling window cost
  const windowStart = new Date(
    Date.now() - settings.windowDays * 24 * 60 * 60 * 1000
  ).toISOString()

  const { data: usage } = await supabaseAdmin
    .from('ai_usage_log')
    .select('cost_usd')
    .eq('user_id', userId)
    .gte('created_at', windowStart)

  const windowCost = (usage ?? []).reduce((s, r) => s + Number(r.cost_usd), 0)

  // Expected cost for window
  const expectedMonthly = settings.expectedCosts[profile.plan_tier] ?? 0.20
  const expectedWindow = expectedMonthly * (settings.windowDays / 30)
  const yellowThreshold = expectedWindow * (settings.yellowPct / 100)
  const redThreshold = expectedWindow * (settings.redPct / 100)

  let level: 'yellow' | 'red' | null = null
  if (windowCost >= redThreshold) level = 'red'
  else if (windowCost >= yellowThreshold) level = 'yellow'

  await supabaseAdmin.from('user_throttle').upsert({
    user_id: userId,
    is_throttled: level === 'red',
    throttle_level: level,
    throttled_at: level ? new Date().toISOString() : null,
    throttled_reason: level
      ? `${settings.windowDays}d cost $${windowCost.toFixed(4)} exceeds ${level} threshold`
      : null,
    monthly_cost_usd: windowCost,
    monthly_cost_updated_at: new Date().toISOString()
  }, { onConflict: 'user_id' })
}
```

### 2b — isUserThrottled() in packages/db

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

### 2c — Wire throttle check into expensive AI functions

Before generateRecipeImage(), translateRecipeToLanguage(),
generateMealPlan():

```typescript
if (userId && await isUserThrottled(userId)) {
  return {
    throttled: true,
    message: 'AI features are temporarily limited due to high demand.'
  }
}
```

### 2d — Wire checkAndUpdateThrottle() after every logAiCall()

In logAiCall(), after inserting the row:
```typescript
if (userId) {
  // Non-blocking — don't await
  checkAndUpdateThrottle(userId).catch(console.error)
}
```

---

## PART 3 — Throttle settings UI in admin

On /admin/settings (or add a Settings tab on /admin/costs), add:

```
Throttle Configuration
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

[● Enabled]  [○ Disabled]

Rolling window:        [7___] days
Grace period:          [30__] days
Yellow threshold:      [150_] % of expected plan cost
Red threshold:         [300_] % of expected plan cost

Expected monthly cost by plan:
  Free:   $[0.05]
  Chef:   $[0.20]
  Family: $[0.71]
  Pro:    $[0.44]

Effective red thresholds (calculated):
  Free: $0.035/7d  Chef: $0.14/7d
  Family: $0.50/7d  Pro: $0.31/7d

[Save changes]
```

All inputs save to system_settings via PATCH /api/admin.
Effective thresholds recalculate on input change.
Warning if red threshold < $0.10 (too aggressive).

---

## PART 4 — Per-user cost/revenue columns on /admin/users

Add to the users table BETWEEN Plan and Role columns:

**Cost MTD** — current month AI cost
Source: user_throttle.monthly_cost_usd
Format: "$0.14" in grey, "$2.50" in amber, "$5.00+" in red

**Revenue MTD** — estimated monthly revenue
Calculate from plan_tier:
- free: $0
- chef: $4.99
- family: $9.99
- pro: $14.99

**Delta** — Revenue − Cost
Green if positive, red if negative
Format: "+$4.79" or "-$0.50"

**Throttle** — status pill
None (grey) / ⚠️ Yellow / 🔴 Red

These columns must be visible on the /admin/users table.
They should load from a JOIN on user_throttle.

---

## PART 5 — Admin overview: activity feed + system status

### 5a — Activity feed (last 20 events)

Below the KPI cards on /admin, add a live activity feed:

```
Recent Activity (auto-refreshes every 30s)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✅ 2m ago  Recipe imported: "Chocolate Chip Cookies" by @pilzner
🎨 5m ago  AI image generated for "Thai Satay"
🚩 12m ago Recipe flagged: copyright by @user2
🔴 1h ago  User @user3 throttled (red level)
👤 2h ago  New user: @user4 joined (Chef plan)
```

Pull from:
- ai_usage_log (recent imports + image gen)
- recipe_flags (recent flags)
- user_throttle (recent throttle events)
- user_profiles (new registrations, last 24h)

### 5b — System status row

```
🟢 Database  🟢 AI API  🟢 Replicate ($X.XX credit)
🟢 Storage   🟢 Tunnel  Last checked: Xm ago
```

For Replicate balance:
```typescript
const res = await fetch('https://api.replicate.com/v1/account', {
  headers: { Authorization: `Bearer ${process.env.REPLICATE_API_TOKEN}` }
})
// Returns account info — check if credits are available
```

---

## PART 6 — Auto-restore throttle at billing cycle

Add to the existing cron job (or create one):

```typescript
// Run on the 1st of each month
async function resetMonthlyThrottles() {
  await supabaseAdmin
    .from('user_throttle')
    .update({
      is_throttled: false,
      throttle_level: null,
      throttled_at: null,
      throttled_reason: null,
      monthly_cost_usd: 0,
      monthly_cost_updated_at: new Date().toISOString()
    })
    .eq('admin_override', false)
    .eq('is_throttled', true)

  console.log('Monthly throttle reset complete')
}
```

---

## DEPLOYMENT

```bash
ssh rasp@rpi5-eth
cd /mnt/chefsbook/repo
git pull
cd apps/web
rm -rf node_modules/react node_modules/react-dom .next
NODE_OPTIONS=--max-old-space-size=1536 npm run build 2>&1 | tail -20
pm2 restart chefsbook-web
```

---

## WRAPUP REQUIREMENT

Read docs/prompts/WRAPUP-STANDARD.md before running /wrapup.
Every DONE.md entry must start with [SESSION 166].
Every incomplete item must be listed as SKIPPED/FAILED/DEFERRED.
Paste every checklist item with ✓/✗ status.

---

## COMPLETION CHECKLIST

### Part 0 — Image generation fixes
- [ ] buildImagePrompt() always leads with dish name
- [ ] Source description supplementary only (never replaces dish)
- [ ] REGEN_PILLS modifiers strengthened
- [ ] Random seed added to Replicate calls
- [ ] Tested: correct dish shown for one recipe

### Part 1 — AI logging
- [ ] logAiCall() wired into ALL 15+ AI functions
- [ ] Every function listed above confirmed wired
- [ ] ai_usage_log populates after test import

### Part 2 — Throttle logic
- [ ] checkAndUpdateThrottle() implemented
- [ ] isUserThrottled() implemented
- [ ] Throttle check wired into generateRecipeImage()
- [ ] Throttle check wired into translateRecipeToLanguage()
- [ ] Throttle check wired into generateMealPlan()
- [ ] checkAndUpdateThrottle() called after every logAiCall()

### Part 3 — Throttle settings UI
- [ ] Throttle settings form in admin (all 9 settings editable)
- [ ] Effective thresholds calculated and shown
- [ ] Saves to system_settings via admin API
- [ ] Warning shown if threshold too aggressive

### Part 4 — Per-user cost columns
- [ ] Cost MTD column on /admin/users (from user_throttle)
- [ ] Revenue MTD column (calculated from plan_tier)
- [ ] Delta column (green/red)
- [ ] Throttle status pill column
- [ ] Columns visible between Plan and Role

### Part 5 — Admin overview
- [ ] Activity feed shows last 20 events
- [ ] Auto-refreshes every 30 seconds
- [ ] System status row (DB, AI API, Replicate balance, Storage, Tunnel)

### Part 6 — Auto-restore
- [ ] Monthly throttle reset in cron job

### General
- [ ] tsc --noEmit passes both apps
- [ ] Deployed to RPi5
- [ ] Run /wrapup per WRAPUP-STANDARD.md
- [ ] Every DONE.md entry starts with [SESSION 166]
- [ ] All incomplete items listed honestly
