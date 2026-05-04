# Data Asset Audit and Strategy

## Executive Summary

ChefsBook has 50+ database tables collecting rich cooking behavior data. The core competitive advantage is the **cooking_action_timings knowledge graph** - a learning system that gets smarter with every cook. Currently seeded with 40 Wikipedia entries, this graph can compound to millions of timing data points as users cook. The missing piece is the **promotion pipeline** - automatically feeding step_actuals from cooking_sessions back into the knowledge graph.

## Complete Data Asset Register

### Core Recipe Data

| Table | Key Fields | Signal Quality | Insights Derived | What's Wasted |
|-------|------------|----------------|------------------|---------------|
| `recipes` | title, cuisine, course, prep_minutes, cook_minutes, nutrition JSONB | High | Cooking patterns, preferences | nutrition_source often null |
| `recipe_ingredients` | ingredient, quantity, unit, group_label | High | Shopping patterns, dietary analysis | preparation field underused |
| `recipe_steps` | instruction, duration_min/max, is_passive, uses_oven, phase | Medium | Timing predictions | timing_confidence often 'low' |
| `recipe_user_photos` | url, is_primary, sort_order | High | Visual engagement | storage_path redundant |
| `recipe_translations` | language, translated_title/ingredients/steps | High | Global reach | is_title_only creates partial records |

### Timing & Cooking Intelligence

| Table | Key Fields | Signal Quality | Insights Derived | What's Missing |
|-------|------------|----------------|------------------|----------------|
| `cooking_action_timings` | canonical_key, duration_min/max, is_passive, observed_count, observed_avg_minutes | Medium (40 entries) | Baseline timing predictions | **step_actuals not feeding back** |
| `cooking_sessions` | menu_id, plan JSONB, status, serve_time, version | Low (new) | Real cook behavior | **step_actuals table doesn't exist** |
| `techniques` | process_steps JSONB, difficulty, tips, mistakes, tools | High | Skill teaching | Underutilized in recommendations |

### Social & Engagement

| Table | Key Fields | Signal Quality | Insights Derived | What's Wasted |
|-------|------------|----------------|------------------|---------------|
| `user_follows` | follower_id, following_id | High | Social graph, influence | No follow strength scoring |
| `recipe_saves` | user_id, recipe_id | High | Preference signals | saved_at underused for recency |
| `recipe_likes` | user_id, recipe_id | High | Quality signals | No like source (discovery vs profile) |
| `recipe_comments` | content, parent_id, ai_verdict | High | Community sentiment | reply_count could drive engagement |
| `direct_messages` | content, sender_id, recipient_id | Medium | Relationship strength | No conversation threading |

### Planning & Shopping

| Table | Key Fields | Signal Quality | Insights Derived | What's Missing |
|-------|------------|----------------|------------------|----------------|
| `meal_plans` | plan_date, meal_slot, recipe_id | High | Weekly planning patterns | No actual cook confirmation |
| `menus` | title, course items, serve_time | High | Event planning | No guest count tracking |
| `shopping_lists` | store_name, items | High | Purchase patterns | **No purchase confirmation** |
| `shopping_list_items` | ingredient, is_checked, aisle | Medium | Store layout optimization | checked_at not analyzed |

### Import & Discovery

| Table | Key Fields | Signal Quality | Insights Derived | What's Missing |
|-------|------------|----------------|------------------|----------------|
| `import_site_tracker` | domain, success_count, fail_count, rating | High | Site reliability | No content quality scoring |
| `import_attempts` | url, status, extraction_method | High | Import pipeline health | No user satisfaction feedback |
| `import_completion_jobs` | recipe_id, status | Medium | Import completion rate | Job completion time not tracked |

### User & Subscription

| Table | Key Fields | Signal Quality | Insights Derived | What's Missing |
|-------|------------|----------------|------------------|----------------|
| `user_profiles` | plan_tier, login_count, last_seen_at | High | Engagement, churn risk | **No feature usage tracking** |
| `ai_usage_log` | user_id, operation, model, cost_cents | High | Cost per user, AI ROI | No quality scoring per call |
| `user_feedback` | type, message, tag, source | High | Product sentiment | Low volume |

## Gap Analysis: Missing Data

### Critical Gaps

1. **step_actuals table doesn't exist**
   - We have `cooking_sessions.plan` JSONB but no structured actual timing data
   - Cannot learn from real cooking behavior
   - **Required migration**: Create `step_actuals(session_id, step_id, actual_start, actual_end, skipped)`

2. **No purchase confirmation on shopping lists**
   - We know what users add to lists but not what they actually buy
   - Cannot optimize for waste reduction
   - **Required field**: `shopping_list_items.purchased_at`, `purchased_quantity`

3. **No feature usage tracking**
   - We don't know which features drive retention
   - Cannot prioritize development
   - **Required table**: `feature_usage(user_id, feature_key, used_at, context)`

4. **No recipe cook confirmation**
   - `meal_plans` tracks intent, not execution
   - Cannot differentiate "saved" from "actually cooked"
   - **Required field**: `meal_plans.cooked_at`, `rating_after_cook`

### Secondary Gaps

5. **No ingredient inventory tracking** - "Use what I have" feature requires knowing pantry state
6. **No cost data on ingredients** - Cost estimation requires price database
7. **No equipment tracking** - Cannot recommend based on available appliances
8. **No dietary restriction profiles** - Repeated filtering per search

## Data Compounding Model

### At 10,000 Users
- ~50,000 recipes imported
- ~5,000 cooking sessions (if 50% use Cook Mode)
- cooking_action_timings: ~200 entries with observed data
- Knowledge graph still relies heavily on Wikipedia baseline

### At 100,000 Users
- ~500,000 recipes
- ~50,000 cooking sessions
- cooking_action_timings: ~2,000 entries with high confidence
- Chef can predict timing for most common technique:ingredient pairs
- Social graph enables meaningful "trending" and "following" features

### At 1,000,000 Users
- ~5,000,000 recipes
- ~500,000 cooking sessions
- cooking_action_timings: ~10,000+ entries, all high confidence
- Chef knows timing for every technique:ingredient combination
- Personalization becomes viable (user A takes 40% longer on pastry)
- B2B data licensing becomes valuable (anonymized cooking behavior)

## Promotion Pipeline: recipe_steps → cooking_action_timings

### Current State
```
recipe_steps (timing columns) ← AI inference via inferStepTimings()
cooking_action_timings (40 entries) ← Wikipedia seeding
```

### Target State
```
User cooks recipe → cooking_sessions.plan JSONB created
User completes step → step_actuals record created
step_actuals aggregated → cooking_action_timings.observed_avg_minutes updated
cooking_action_timings.observed_count incremented
Next inference for same technique:ingredient uses observed data
```

### Implementation Spec

**Migration 084: step_actuals table**
```sql
CREATE TABLE step_actuals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID REFERENCES cooking_sessions(id) ON DELETE CASCADE,
  step_id UUID REFERENCES recipe_steps(id) ON DELETE CASCADE,
  actual_start TIMESTAMPTZ NOT NULL,
  actual_end TIMESTAMPTZ,
  was_skipped BOOLEAN DEFAULT false,
  user_rating SMALLINT CHECK (rating BETWEEN 1 AND 5),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);
```

**Promotion Function (scheduled job)**
```typescript
async function promoteObservedTimings() {
  // 1. Find step_actuals with matching technique:ingredient
  // 2. Calculate new observed_avg_minutes
  // 3. Increment observed_count
  // 4. Update cooking_action_timings
  // 5. Set confidence = 'high' when observed_count >= 5
}
```

**Trigger Points**
- Cook Mode: "Done" button → insert step_actuals
- Cook Mode: "Skip" button → insert step_actuals with was_skipped=true
- Background job: Every 6 hours, run promoteObservedTimings()

## Instrumentation Roadmap

### Phase 1: Cook Mode Data (Week 1-2)
- [ ] Migration 084: step_actuals table
- [ ] Cook Mode UI: Record actual_start/actual_end on step transitions
- [ ] Cook Mode UI: Record skipped steps
- [ ] Background job: promoteObservedTimings()

### Phase 2: Shopping Data (Week 3-4)
- [ ] Migration 085: purchased_at, purchased_quantity on shopping_list_items
- [ ] Shopping list UI: "Bought" checkbox with quantity confirmation
- [ ] Analytics: Identify unused ingredients (added but never purchased)

### Phase 3: Feature Usage (Week 5-6)
- [ ] Migration 086: feature_usage table
- [ ] Track: scan, import, search, cook_mode, ask_sous_chef, share
- [ ] Dashboard: Feature usage by user cohort

### Phase 4: Cook Confirmation (Week 7-8)
- [ ] Migration 087: cooked_at, rating_after_cook on meal_plans
- [ ] Meal plan UI: "Cooked it!" button after planned date
- [ ] Analytics: Plan vs actual cook rate

## Success Metrics

| Metric | Current | Target (6 months) | Target (12 months) |
|--------|---------|-------------------|-------------------|
| cooking_action_timings entries | 40 | 500 | 2,000 |
| Entries with observed_count >= 3 | 0 | 100 | 500 |
| step_actuals records | 0 | 10,000 | 100,000 |
| shopping_list_items with purchased_at | 0% | 20% | 50% |
| meal_plans with cooked_at | 0% | 10% | 30% |
