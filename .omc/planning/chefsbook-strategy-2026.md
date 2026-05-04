# ChefsBook Strategic Plan 2026

## Executive Summary

ChefsBook is positioned to become the dominant global cooking platform by doing what no competitor does: **actually helping people cook**. While competitors focus on recipe browsing (NYT Cooking), meal kit delivery (HelloFresh), or social sharing (Cookpad), ChefsBook combines all three with a unique technical advantage: an AI-powered cooking scheduler that coordinates multi-course dinner parties with timing precision no human could achieve.

The recipe app market is in flux. Yummly (Whirlpool) and AllRecipes (Dotdash Meredith) discontinued their mobile apps in 2024-2025, leaving a gap for a modern, AI-native platform. ChefsBook fills this gap with:

- **40+ AI functions** - more than any competitor
- **Pure TypeScript scheduler** with reverse-scheduling, oven conflict resolution, and multi-chef coordination
- **Knowledge graph** (cooking_action_timings) that learns from real cooking sessions
- **Personal recipe versions** with Ask Sous Chef
- **Print cookbook publishing** via Lulu integration

The path to dominance requires three phases:
1. **Foundation (Q1)**: Cook Mode UI + Stripe payments + social "Cooked it!" posts
2. **Intelligence (Q2-Q3)**: Personalized timing, skill assessment, challenges, family vaults
3. **Scale (Q4)**: Grocery affiliate, creator economy, voice cooking

**12-month revenue projection (10k users)**: $106,500
**36-month revenue projection (100k users)**: $1.35M

---

## Table of Contents

1. [Competitive Landscape](#1-competitive-landscape)
2. [Data Strategy](#2-data-strategy)
3. [AI Roadmap](#3-ai-roadmap)
4. [Monetisation](#4-monetisation)
5. [Social Platform](#5-social-platform)
6. [Implementation Roadmap](#6-implementation-roadmap)

---

## 1. Competitive Landscape

### Market Status

| Competitor | Status | Key Insight |
|------------|--------|-------------|
| Yummly | **DEAD** (Dec 2024) | Whirlpool killed it to pivot to AI |
| AllRecipes | App **DEAD** | Moved to ad-heavy web-only |
| NYT Cooking | Active | $5/month paywall, no AI |
| Samsung Food | Active | $6.99/mo, locked to Samsung ecosystem |
| Paprika | Active | One-time purchase beloved, but dated |
| Cookpad | Active | 100M users, social-first |
| SideChef | Active | Step-by-step video, 6.5x retention with GenAI |

### Competitive Advantages

| ChefsBook Has | Competitors Don't |
|---------------|-------------------|
| Cooking scheduler with oven conflict resolution | Static timers only |
| Knowledge graph that learns from real cooks | Fixed timing estimates |
| Personal recipe versions | No modification tracking |
| Multi-course dinner party coordination | Single recipe focus |
| Print cookbook publishing | Separate services required |

### Top 10 Unmet Market Needs

1. AI that learns my cooking style (ChefsBook: 70% built)
2. "What can I make with what I have?" (60% built)
3. Real cook mode with timing coordination (90% built)
4. Family recipe inheritance (tables exist, UI pending)
5. Video recipe import from TikTok/IG (YouTube done)
6. Cost estimation per recipe (not built)
7. Grocery delivery integration (not built)
8. Live cook-alongs (not built)
9. Skill progression/learning paths (techniques table exists)
10. Restaurant dish recreation (reanalyseDish exists)

---

## 2. Data Strategy

### Data Assets (50+ Tables)

**Core Competitive Asset**: `cooking_action_timings` - a knowledge graph with 40 Wikipedia-seeded entries that can compound to millions of timing data points as users cook.

| Category | Tables | Signal Quality |
|----------|--------|----------------|
| Recipe data | recipes, recipe_ingredients, recipe_steps | High |
| Timing intelligence | cooking_action_timings, cooking_sessions | Medium (needs step_actuals) |
| Social | user_follows, recipe_saves, recipe_likes, recipe_comments | High |
| Planning | meal_plans, menus, shopping_lists | High |
| Import | import_site_tracker, import_attempts | High |
| AI costs | ai_usage_log, ai_usage_daily | High |

### Critical Gap: step_actuals

The knowledge graph cannot learn without actual cooking data. **Migration 084** must create:

```sql
CREATE TABLE step_actuals (
  session_id UUID REFERENCES cooking_sessions,
  step_id UUID REFERENCES recipe_steps,
  actual_start TIMESTAMPTZ,
  actual_end TIMESTAMPTZ,
  was_skipped BOOLEAN DEFAULT false
);
```

### Data Compounding Model

| Users | cooking_action_timings entries | Confidence Level |
|-------|-------------------------------|------------------|
| 10k | 200 | Relies on Wikipedia baseline |
| 100k | 2,000 | Chef predicts most common pairs |
| 1M | 10,000+ | Every technique:ingredient known |

---

## 3. AI Roadmap

### Current Capabilities (40+ Functions)

| Category | Functions | Status |
|----------|-----------|--------|
| Import | scanRecipe, importFromUrl, importFromYouTube | Production |
| Timing | inferStepTimings, generateChefBriefing | Production |
| Personalization | askSousChef, suggestRecipes, generateVariation | Production |
| Moderation | moderateComment/Recipe/Message/Tag/Profile | Production |
| Nutrition | generateNutrition | Production |
| Translation | translateRecipe | Production |

### Chef Capability Roadmap

**v1 (0-3 months)**:
- Predictive scheduling (user timing factors)
- Seasonal intelligence
- Restaurant recreation UI

**v2 (3-6 months)**:
- Skill assessment
- Nutritional intelligence
- Waste reduction alerts

**v3 (6-12 months)**:
- Voice Cook Mode
- Proactive Chef suggestions
- Social intelligence

### Key Insight

ChefsBook's `inferStepTimings()` already checks the knowledge graph BEFORE calling Haiku. As the graph grows, AI costs decrease and accuracy increases. This is a compounding advantage.

---

## 4. Monetisation

### Current Tiers

| Tier | Price | Key Features |
|------|-------|--------------|
| Free | $0 | Browse public recipes |
| Chef | $4.99/mo | 75 recipes, import/scan/AI |
| Family | $9.99/mo | 200 recipes, 3 family members |
| Pro | $14.99/mo | Unlimited, PDF export |

**Blocker**: Stripe not integrated.

### Revenue Vectors

| Vector | 12-Month (10k users) | 36-Month (100k users) |
|--------|---------------------|----------------------|
| Subscriptions | $53,500 | $535,000 |
| Grocery affiliate | $20,000 | $200,000 |
| Creator economy | $10,000 | $180,000 |
| Print cookbooks | $18,000 | $100,000 |
| Data licensing | $0 | $90,000 |
| Brand partnerships | $0 | $150,000 |
| **Total** | **$106,500** | **$1,350,000** |

### Priority Actions

1. Complete Stripe integration (Week 1-2)
2. Add annual pricing with 20% discount
3. Grocery affiliate integration (Month 3)
4. Creator payout system (Month 4)

---

## 5. Social Platform

### The Identity Layer

**Insight**: Strava users open the app 35+ times/month because it validates athletic identity. ChefsBook must validate cooking identity.

**Solution**: "Cooked it!" posts - social proof that a recipe was actually made.

### Social Features Roadmap

| Feature | Impact | Build Effort | Status |
|---------|--------|--------------|--------|
| "Cooked it!" posts | Very High | Low | Not built |
| Cooking streaks | Very High | Low | Not built |
| Challenges | High | Medium | Not built |
| Family vaults | High | Medium | Not built |
| Reputation/badges | Medium | Medium | Not built |
| Collaborative menus | Medium | Low | Menu tables exist |

### Viral Mechanics

| Strava | ChefsBook Equivalent |
|--------|---------------------|
| Kudos | "Looks delicious!" reaction |
| Segments | Recipe ratings/leaderboards |
| Clubs | Cuisine communities |
| Year in Review | "Your Year in Cooking" |

---

## 6. Implementation Roadmap

### 90-Day Sprint Plan

**Sprint 1 (Weeks 1-4): Cook Mode Foundation**
- Migration 084: step_actuals table
- Cook Mode timer UI (mobile + web)
- Background job: promoteObservedTimings()

**Sprint 2 (Weeks 5-8): Stripe + Social**
- Stripe checkout + subscription management
- "Cooked it!" post-cook prompt
- Photo upload flow

**Sprint 3 (Weeks 9-12): Gamification**
- Cooking streaks
- Predictive scheduling
- "Chef suggests" recommendations

### 12-Month Milestones

| Quarter | Theme | Milestone |
|---------|-------|-----------|
| Q1 | Foundation | First 1,000 paying subscribers |
| Q2 | Intelligence | 50% say "Chef helped me cook better" |
| Q3 | Community | 10% in active challenge |
| Q4 | Scale | Non-subscription revenue > 20% |

### Risk Register

| Risk | Mitigation |
|------|------------|
| Stripe delays | Start immediately, manual fallback |
| Low Cook Mode adoption | Prominent UI, tutorial, incentives |
| Social feels empty | Seed content, invite beta testers |
| AI costs exceed budget | Haiku usage, caching, rate limits |

---

## The Single Most Important Thing

**Build Cook Mode UI with step_actuals tracking THIS WEEK.**

Why:
1. 90% backend-ready (scheduler.ts, cooking_sessions exist)
2. Unlocks knowledge graph learning loop (competitive moat)
3. Enables personalized timing (differentiation)
4. Creates foundation for "Cooked it!" social posts
5. Proves core value: ChefsBook helps you actually cook

Everything else depends on users actually cooking with the app.

---

## Appendix: Key Tables Reference

### Core Tables
- `recipes` - 30+ columns including nutrition JSONB
- `recipe_steps` - timing columns (duration_min/max, is_passive, phase)
- `cooking_sessions` - JSONB plan storage
- `cooking_action_timings` - 40 entries, learning loop ready

### Social Tables
- `user_follows` - follower_id, following_id
- `recipe_saves`, `recipe_likes`, `recipe_comments`
- `notifications` - cross-platform notifications

### Planning Tables
- `meal_plans` - date + meal_slot planning
- `menus`, `menu_items` - multi-course organization
- `shopping_lists`, `shopping_list_items`

### AI Tables
- `ai_usage_log` - per-call cost tracking
- `techniques` - JSONB process_steps, difficulty

---

## Document Information

- **Created**: 2026-05-04
- **Author**: ChefsBook Strategic Planning Session
- **Source Files**:
  - `.omc/planning/01-competitive-landscape.md`
  - `.omc/planning/02-data-strategy.md`
  - `.omc/planning/03-ai-roadmap.md`
  - `.omc/planning/04-monetisation.md`
  - `.omc/planning/05-social-platform.md`
  - `.omc/planning/06-implementation-roadmap.md`

---

*This document is specific to ChefsBook's actual codebase, tables, and capabilities. Every recommendation references real features in the repository. It is intended for investors, engineers, and marketing teams.*
