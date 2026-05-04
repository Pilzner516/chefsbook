# Implementation Roadmap

## Executive Summary

This roadmap synthesizes findings from competitive analysis, data audit, AI roadmap, monetisation strategy, and social platform design into a unified execution plan. The single most important thing to build next is **Cook Mode UI + step_actuals tracking** - it unlocks the knowledge graph learning loop, enables personalized timing, and creates the foundation for "Cooked it!" social posts.

## 90-Day Sprint Plan

### Sprint 1: Cook Mode Foundation (Weeks 1-4)

**Goal**: Complete Cook Mode UI and begin collecting step_actuals data.

| Task | Owner | Effort | Dependencies | Priority |
|------|-------|--------|--------------|----------|
| Migration 084: step_actuals table | Backend | 1 day | None | P0 |
| Cook Mode UI: Step timer with actual tracking | Mobile | 2 weeks | Migration 084 | P0 |
| Cook Mode UI: Mark step complete/skip | Mobile | 3 days | Migration 084 | P0 |
| Web Cook Mode: Match mobile functionality | Web | 1 week | Migration 084 | P1 |
| Background job: promoteObservedTimings() | Backend | 3 days | step_actuals | P0 |
| Chef Briefing: Pre-cook summary screen | Mobile/Web | 4 days | generateChefBriefing | P1 |

**Deliverable**: Working Cook Mode that records actual timings and feeds the knowledge graph.

**Success Metrics**:
- 100+ step_actuals records in first week
- cooking_action_timings has 5+ entries with observed_count > 0

### Sprint 2: Stripe + Cooked It! (Weeks 5-8)

**Goal**: Enable payments and launch social "Cooked it!" feature.

| Task | Owner | Effort | Dependencies | Priority |
|------|-------|--------|--------------|----------|
| Stripe integration: Checkout flow | Backend/Web | 1 week | Stripe account | P0 |
| Stripe integration: Subscription management | Backend/Web | 1 week | Checkout | P0 |
| Stripe webhooks: Subscription events | Backend | 3 days | Integration | P0 |
| Migration 085: cook_posts table | Backend | 1 day | None | P0 |
| "Cooked it!" post-cook prompt | Mobile | 3 days | cook_posts | P0 |
| "Cooked it!" photo upload flow | Mobile | 4 days | Storage | P0 |
| Recipe detail: cook_posts gallery | Mobile/Web | 3 days | cook_posts | P1 |
| Discover feed: Include cook_posts | Mobile/Web | 2 days | cook_posts | P1 |

**Deliverable**: Working payments + social "Cooked it!" sharing.

**Success Metrics**:
- First paid subscription processed
- 50+ "Cooked it!" posts in first week
- 10% of Cook Mode completions result in posts

### Sprint 3: Streaks + Recommendations (Weeks 9-12)

**Goal**: Gamification and personalization.

| Task | Owner | Effort | Dependencies | Priority |
|------|-------|--------|--------------|----------|
| Cooking streaks: Schema + tracking | Backend | 2 days | cook_posts | P0 |
| Cooking streaks: Profile display | Mobile/Web | 2 days | Schema | P0 |
| Streak notifications: "Don't break it!" | Backend/Mobile | 3 days | Streaks | P1 |
| Predictive scheduling: User timing factors | Backend | 3 days | step_actuals volume | P0 |
| Personalized recommendations: "Chef suggests" | AI/Backend | 1 week | Cook history | P1 |
| Seasonal intelligence: Calendar integration | Backend | 3 days | None | P2 |
| Recipe detail: "X people cooked this" | Mobile/Web | 2 days | cook_posts | P1 |

**Deliverable**: Gamified streaks + personalized timing + recommendations.

**Success Metrics**:
- 20% of active users have 7+ day streak
- User timing factors calculated for 100+ users
- "Chef suggests" CTR > 5%

## 12-Month Roadmap

### Q1 (Months 1-3): Foundation
**Theme**: Make cooking actually work better.

| Month | Focus | Key Deliverables |
|-------|-------|------------------|
| Month 1 | Cook Mode | step_actuals, timer UI, knowledge graph loop |
| Month 2 | Payments | Stripe, subscriptions, annual pricing |
| Month 3 | Social v1 | "Cooked it!", streaks, notifications |

**Milestone**: First 1,000 paying subscribers.

### Q2 (Months 4-6): Intelligence
**Theme**: Chef becomes smart.

| Month | Focus | Key Deliverables |
|-------|-------|------------------|
| Month 4 | Personalization | User timing factors, skill assessment |
| Month 5 | Recommendations | "Chef suggests", waste reduction alerts |
| Month 6 | Nutrition | Weekly nutrition summaries, goal tracking |

**Milestone**: 50% of users say "Chef helped me cook better" in survey.

### Q3 (Months 7-9): Community
**Theme**: Cooking becomes social.

| Month | Focus | Key Deliverables |
|-------|-------|------------------|
| Month 7 | Challenges | Platform challenges, badge system |
| Month 8 | Family vaults | Private family cookbooks, invite system |
| Month 9 | Collaborative menus | Dinner party planning, shared shopping |

**Milestone**: 10% of users in active challenge; 100 family vaults created.

### Q4 (Months 10-12): Scale
**Theme**: Revenue diversification.

| Month | Focus | Key Deliverables |
|-------|-------|------------------|
| Month 10 | Grocery affiliate | Instacart integration, shopping list buy button |
| Month 11 | Creator economy | Premium collections, creator payouts |
| Month 12 | Voice Cook Mode | TTS step reading, basic voice commands |

**Milestone**: Non-subscription revenue > 20% of total.

## OMC Agent File Structure

Create specialized agents for each major feature area:

```
.claude/agents/
├── cook-mode.md          # Cook Mode UI, step_actuals, timers
├── knowledge-graph.md    # cooking_action_timings, promotion pipeline
├── payments.md           # Stripe integration, subscriptions
├── social-features.md    # cook_posts, streaks, challenges
├── recommendations.md    # Chef suggests, personalization
├── family-vaults.md      # Family cookbook sharing
├── creator-economy.md    # Premium content, payouts
├── voice-cooking.md      # TTS, voice commands
└── grocery-affiliate.md  # Instacart, shopping integration
```

Each agent should include:
- Feature overview
- Database tables involved
- API routes
- UI components
- Known pitfalls
- Testing checklist

## Resource Requirements

### Team Capacity (Current)
- 1 full-stack developer (you)
- AI assistance (Claude)
- No dedicated mobile/design

### Recommended Additions

| Role | When | Why |
|------|------|-----|
| Mobile developer | Month 3 | Cook Mode mobile UX critical |
| Designer | Month 4 | Gamification needs polish |
| Backend engineer | Month 6 | Scale and reliability |
| Growth marketer | Month 7 | Community building |

### Cost Estimates (Monthly)

| Category | Current | Month 6 | Month 12 |
|----------|---------|---------|----------|
| Infrastructure (slux) | $50 | $100 | $200 |
| AI costs (Anthropic) | $100 | $300 | $1,000 |
| Stripe fees | $0 | $200 | $500 |
| External APIs | $50 | $100 | $200 |
| Total | $200 | $700 | $1,900 |

## Risk Register

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| **Stripe integration delays** | Medium | High | Start immediately, fallback to manual onboarding |
| **Low Cook Mode adoption** | Medium | High | Prominent UI placement, tutorial, incentives |
| **Knowledge graph data quality** | Medium | Medium | Manual review of first 100 entries, confidence thresholds |
| **Social features feel empty** | High | Medium | Seed with team content, invite beta testers early |
| **AI costs exceed budget** | Medium | Medium | Aggressive Haiku usage, caching, rate limits |
| **Mobile app review delays** | Low | High | Follow guidelines strictly, no last-minute changes |
| **Grocery API partnership** | Medium | Low | Multiple options (Instacart, Amazon, direct affiliate) |
| **Creator payment compliance** | Low | High | Use Stripe Connect, legal review |

## Success Metrics Dashboard

### Weekly Metrics
- New signups
- Cook Mode sessions started/completed
- step_actuals records created
- "Cooked it!" posts
- Subscription conversions

### Monthly Metrics
- MAU / DAU ratio
- Average cooking streak length
- cooking_action_timings entries with observed data
- Revenue by tier
- NPS score

### Quarterly Metrics
- Total paying subscribers
- Revenue growth rate
- User retention (30/60/90 day)
- Feature adoption rates
- AI cost per active user

## The Single Most Important Thing

**Build Cook Mode UI with step_actuals tracking THIS WEEK.**

Why:
1. It's 90% backend-ready (scheduler.ts, cooking_sessions table exist)
2. It unlocks the knowledge graph learning loop (competitive moat)
3. It enables personalized timing (differentiation)
4. It creates the foundation for "Cooked it!" social posts
5. It proves the core value proposition: ChefsBook helps you actually cook

Everything else depends on users actually cooking with the app. Cook Mode is the wedge.

## Next Steps (Immediate)

1. **Today**: Review this strategy document
2. **This week**: Migration 084 (step_actuals) + Cook Mode timer UI
3. **Next week**: Complete Cook Mode flow end-to-end
4. **Week 3**: Begin Stripe integration in parallel
5. **Week 4**: Ship Cook Mode to production, begin collecting data
