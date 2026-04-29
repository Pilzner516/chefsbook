# Prompt: ChefsBook Admin — API Costs Dashboard

## LAUNCH PROMPT (paste this into Claude Code to start the session)

```
Read and execute docs/prompts/admin-costs-1.md fully and autonomously, from pre-flight through deployment and /wrapup. Do not stop for questions unless you hit a genuine blocker.
```

---

## TYPE: FEATURE — WEB ONLY (ADMIN)

## Overview

Expand the existing admin Costs screen to show a live breakdown of API spending
by service, pulled from the existing `ai_usage_log` table plus live balance
queries where APIs support it. Admins need visibility into what each feature
is costing per month without leaving the ChefsBook admin panel.

---

## Agent files to read — ALL of these, in order, before writing a single line of code

- `.claude/agents/wrapup.md`
- `.claude/agents/testing.md`
- `.claude/agents/feature-registry.md`
- `.claude/agents/ui-guardian.md`
- `.claude/agents/deployment.md`
- `.claude/agents/ai-cost.md`

Run ALL pre-flight checklists before writing any code.

---

## Pre-flight: before writing any code

1. Read CLAUDE.md fully
2. Read DONE.md from the repo — current file, not cached. Understand what the
   existing Costs admin screen shows and what is already in ai_usage_log.
3. Run `\d ai_usage_log` on RPi5 — understand all columns (model, cost, action,
   user_id, cookbook_id, recipe_id, created_at etc.)
4. Check what API keys exist in `.env.local` on RPi5 — only build integrations
   for services that are actually configured
5. Check the existing admin Costs page route and component
6. Only then write any code

---

## TASK 1 — ai_usage_log spending breakdown

On the admin Costs screen, add a spending breakdown section pulled from `ai_usage_log`.

### API route

Create `GET /api/admin/costs/usage` that returns:

```typescript
{
  currentMonth: {
    total: number,           // total spend in dollars this month
    byService: [
      {
        service: string,     // e.g. "OpenAI", "Replicate", "Anthropic"
        model: string,       // e.g. "gpt-4o", "real-esrgan-4x"
        action: string,      // e.g. "recipe-import", "upscale"
        count: number,       // number of calls
        cost: number,        // total cost in dollars
      }
    ],
    byFeature: [
      {
        feature: string,     // e.g. "AI Recipe Import", "Print Upscaling", "Recipe Generation"
        cost: number,
        count: number,
      }
    ]
  },
  last30Days: {
    // same shape as currentMonth but rolling 30 days
  },
  allTime: {
    total: number,
    byService: [...],
  },
  dailySpend: [
    { date: string, cost: number }  // last 30 days for chart
  ]
}
```

Map model names to human-readable service names and feature names:
- `real-esrgan-4x` → service: "Replicate", feature: "Print Upscaling"
- `gpt-4o`, `gpt-4o-mini` → service: "OpenAI", feature: derive from `action` field
- `claude-*` → service: "Anthropic", feature: derive from `action` field

### UI

Replace or expand the existing Costs admin page with:

**Summary cards row (top):**
- This month total: `$X.XX`
- Last 30 days total: `$X.XX`
- All time total: `$X.XX`
- Most expensive feature this month: `[Feature name] $X.XX`

**Spending by service table:**
Columns: Service | Model | Feature | Calls this month | Cost this month | All time cost
Sortable by cost descending by default.

**Spending by feature table:**
Columns: Feature | Calls this month | Cost this month | Avg cost per call
Sorted by cost descending.

**Daily spend chart:**
Simple bar chart showing spend per day for the last 30 days.
Use recharts or the existing charting library in the project — check what is
already installed before adding a dependency.

---

## TASK 2 — Live OpenAI balance (if OPENAI_API_KEY is configured)

If `OPENAI_API_KEY` exists in `.env.local`, fetch the current credit balance
from OpenAI and display it on the Costs screen.

Endpoint: `GET https://api.openai.com/v1/dashboard/billing/credit_grants`
Headers: `Authorization: Bearer ${OPENAI_API_KEY}`

Display as a status card:
- "OpenAI Credits Remaining: $X.XX"
- Green if > $10, yellow if $1–$10, red if < $1
- "as of [timestamp]" — cache this for 1 hour, do not call on every page load
- If the API call fails, show "Balance unavailable" — do not crash the page

---

## TASK 3 — Live Stripe balance (if STRIPE_SECRET_KEY is configured)

If `STRIPE_SECRET_KEY` exists in `.env.local`, fetch the Stripe account balance.

Endpoint: `GET https://api.stripe.com/v1/balance`

Display as a status card:
- "Stripe Available Balance: $X.XX"
- Show currency
- Cache for 15 minutes
- If fails, show "Balance unavailable" — do not crash the page

---

## TASK 4 — Replicate (usage log only — no live API balance)

Replicate does not have a public billing API. Show Replicate costs from
`ai_usage_log` only (already covered in TASK 1). Add a note in the UI:
"Replicate balance: check replicate.com/account/billing"
with a direct link to https://replicate.com/account/billing

---

## What NOT to build

- Do not add new API keys or services not already configured on RPi5
- Do not store API balance data in the DB — fetch live and cache in memory only
- Do not show individual user spending (privacy) — aggregate totals only
- Do not build a billing management UI — read-only visibility only

---

## Testing

1. Open admin Costs page — confirm spending breakdown loads
2. Confirm current month totals match a manual `SELECT SUM(cost) FROM ai_usage_log WHERE created_at >= date_trunc('month', NOW())` query
3. If OpenAI key exists — confirm balance card shows
4. If Stripe key exists — confirm balance card shows
5. Confirm page loads without errors if any external API call fails

### psql verification
```sql
SELECT 
  DATE_TRUNC('month', created_at) as month,
  model,
  action,
  COUNT(*) as calls,
  SUM(cost) as total_cost
FROM ai_usage_log
GROUP BY 1, 2, 3
ORDER BY 1 DESC, 5 DESC;
```

---

## Deploy

Follow `deployment.md`. Deploy web to RPi5.
Run regression smoke test from `testing.md` before wrapup.

---

## Wrapup

Follow `wrapup.md` fully.
Update `feature-registry.md` — add API costs dashboard.
Note in DONE.md: admin Costs screen now shows ai_usage_log breakdown by
service/feature plus live OpenAI and Stripe balances where keys are configured.
