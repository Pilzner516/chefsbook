# AI and Chef Capability Roadmap

## Executive Summary

ChefsBook has 40+ AI functions - more than any competitor. The foundation is strong. The next step is evolving from **reactive AI** (user asks, AI responds) to **proactive AI** (Chef anticipates, suggests, learns). Chef is the AI sous chef persona - calm, authoritative, addresses users by name. Chef must become indispensable.

## Current AI Capabilities Inventory

### Import & Extraction (packages/ai/src/)
| Function | Model | Cost/Call | Purpose |
|----------|-------|-----------|---------|
| `scanRecipe` | Sonnet | ~$0.01 | OCR image to recipe |
| `scanRecipeMultiPage` | Sonnet | ~$0.02 | Multi-page cookbook scan |
| `importFromUrl` | Sonnet | ~$0.005 | URL recipe extraction |
| `importFromYouTube` | Sonnet | ~$0.01 | Video transcript to recipe |
| `importFromText` | Sonnet | ~$0.003 | Plain text to structured |
| `extractJsonLdRecipe` | None | $0 | JSON-LD parsing (no AI) |

### Timing & Scheduling
| Function | Model | Cost/Call | Purpose |
|----------|-------|-----------|---------|
| `inferStepTimings` | Haiku | ~$0.0003 | Step timing extraction |
| `generateChefBriefing` | Haiku | ~$0.001 | Pre-cook summary |
| `createCookingPlan` | None | $0 | Pure TS scheduler |

### Personalization & Suggestions
| Function | Model | Cost/Call | Purpose |
|----------|-------|-----------|---------|
| `askSousChef` | Sonnet | ~$0.005 | Personal recipe improvements |
| `suggestRecipes` | Sonnet | ~$0.003 | Ingredient-based suggestions |
| `generateVariation` | Sonnet | ~$0.005 | Recipe variations |
| `generateMealPlan` | Sonnet | ~$0.01 | AI meal planning |

### Content & Moderation
| Function | Model | Cost/Call | Purpose |
|----------|-------|-----------|---------|
| `moderateComment/Recipe/Message/Tag/Profile` | Haiku | ~$0.0002 | Content safety |
| `isActuallyARecipe` | Haiku | ~$0.0002 | Recipe validation |
| `generateNutrition` | Sonnet | ~$0.003 | Nutrition estimation |
| `translateRecipe` | Sonnet | ~$0.005 | Multilingual support |

### Dish Intelligence
| Function | Model | Cost/Call | Purpose |
|----------|-------|-----------|---------|
| `analyseScannedImage` | Sonnet | ~$0.01 | Identify dish from photo |
| `reanalyseDish` | Sonnet | ~$0.005 | Refine identification |
| `generateDishRecipe` | Sonnet | ~$0.01 | Create recipe from dish |
| `extractMenuDishes` | Sonnet | ~$0.01 | Restaurant menu parsing |

## Chef Capability Design

### Capability 1: Skill Assessment
**Question**: Can Chef identify that a user struggles with pastry or always nails Asian cuisine?

| Aspect | Detail |
|--------|--------|
| Data Required | cooking_sessions (completion rate by cuisine/technique), step_actuals (time vs expected), recipe difficulty distribution |
| Feasibility | 4/5 - Data structures exist, need step_actuals |
| Build Complexity | Medium (analytics + ML model) |
| User Value | 5/5 - Personalized learning is magical |
| Differentiation | High - No competitor does this |

**Implementation**: 
- Track completion rate per technique (from cooking_sessions)
- Compare actual vs expected timing (from step_actuals)
- Build user skill vector: `{sear: 0.8, braise: 0.6, pastry: 0.3}`
- Surface in profile: "Your strengths: grilling, stir-fry. Keep practicing: baking"

### Capability 2: Personalized Recommendations
**Question**: Can Chef recommend based on actual cooking history, not just saves?

| Aspect | Detail |
|--------|--------|
| Data Required | cooking_sessions (completed cooks), meal_plans.cooked_at, recipe attributes |
| Feasibility | 5/5 - Standard recommendation system |
| Build Complexity | Medium |
| User Value | 5/5 - Reduces decision fatigue |
| Differentiation | Medium - Others do this but poorly |

**Implementation**:
- Build user preference vector from completed cooks (not saves)
- Weight by recency and frequency
- Collaborative filtering: "Users who cooked this also cooked..."
- Surface as "Chef suggests for tonight"

### Capability 3: Predictive Scheduling
**Question**: Can Chef know this user takes 40% longer than average on prep?

| Aspect | Detail |
|--------|--------|
| Data Required | step_actuals per user, cooking_action_timings baseline |
| Feasibility | 5/5 - Simple ratio calculation |
| Build Complexity | Low |
| User Value | 4/5 - Reduces frustration |
| Differentiation | Very High - No one has this |

**Implementation**:
- Calculate user_timing_factor per phase: `user_avg / global_avg`
- Store in user_profiles: `timing_factors: {prep: 1.4, cook: 1.1}`
- Apply in createCookingPlan: multiply durations by user factor
- Message: "I've adjusted times based on your cooking style"

### Capability 4: Nutritional Intelligence
**Question**: Can Chef track actual meals cooked and provide weekly nutrition summaries?

| Aspect | Detail |
|--------|--------|
| Data Required | meal_plans.cooked_at, recipes.nutrition JSONB |
| Feasibility | 4/5 - Need cook confirmation |
| Build Complexity | Medium |
| User Value | 4/5 - Health-conscious users |
| Differentiation | Medium - MyFitnessPal does this for food, not recipes |

**Implementation**:
- Sum nutrition from cooked recipes per week
- Compare to dietary goals (if set)
- Weekly digest: "This week: 1,800 avg calories, 85g protein daily"
- Suggest: "You're low on fiber - try these recipes"

### Capability 5: Waste Reduction
**Question**: Can Chef identify unused ingredients from shopping patterns?

| Aspect | Detail |
|--------|--------|
| Data Required | shopping_list_items (added), purchased_at (bought), recipes cooked |
| Feasibility | 3/5 - Need purchase tracking |
| Build Complexity | Medium |
| User Value | 4/5 - Saves money, reduces guilt |
| Differentiation | High - BigOven's "Use Up Leftovers" is manual |

**Implementation**:
- Track: added to list → purchased → used in cooked recipe
- Flag ingredients purchased but never used in cook
- Suggest recipes using expiring/unused ingredients
- Message: "You bought cilantro last week - here are 3 recipes before it goes bad"

### Capability 6: Skill Progression
**Question**: Can Chef provide structured learning paths from beginner to advanced?

| Aspect | Detail |
|--------|--------|
| Data Required | techniques table, user skill assessment, recipe difficulty |
| Feasibility | 4/5 - techniques table exists |
| Build Complexity | Medium |
| User Value | 5/5 - Gamification drives engagement |
| Differentiation | Very High - No one has this |

**Implementation**:
- Define technique trees: Sauté → Stir-fry → Wok techniques
- Track mastery via completed cooks + ratings
- Unlock badges: "Pastry Apprentice → Pastry Chef → Pâtissier"
- Suggest: "Ready to level up? Try this croissant recipe"

### Capability 7: Social Intelligence
**Question**: Who influences who in the ChefsBook network?

| Aspect | Detail |
|--------|--------|
| Data Required | user_follows, recipe_saves (who saved whose), cooking conversion |
| Feasibility | 4/5 - Data exists |
| Build Complexity | Medium |
| User Value | 3/5 - Creator-facing |
| Differentiation | Medium - Strava has this |

**Implementation**:
- Calculate influence score: follows × save rate × cook rate
- Surface top creators per cuisine/technique
- "Rising chefs" section in Discover
- Creator analytics: "Your followers cooked 234 of your recipes"

### Capability 8: Seasonal Intelligence
**Question**: Can Chef expand horizons proactively based on season and culture?

| Aspect | Detail |
|--------|--------|
| Data Required | Calendar, user location, cuisine exposure history |
| Feasibility | 5/5 - Simple rules + API |
| Build Complexity | Low |
| User Value | 4/5 - Delightful surprise |
| Differentiation | Medium |

**Implementation**:
- Seasonal calendar: asparagus (spring), pumpkin (fall)
- Cultural calendar: Lunar New Year, Diwali, Thanksgiving
- Exposure tracking: user has never cooked Thai
- "It's asparagus season! Here are 5 recipes you've never tried"

### Capability 9: Voice & Ambient Cooking
**Question**: Can Chef work hands-free in Cook Mode?

| Aspect | Detail |
|--------|--------|
| Data Required | Step text, user voice input |
| Feasibility | 3/5 - Voice API complexity |
| Build Complexity | High |
| User Value | 5/5 - True sous chef experience |
| Differentiation | Very High |

**Implementation**:
- Phase 1: Read steps aloud (TTS)
- Phase 2: "Hey Chef, next step" / "Hey Chef, set timer"
- Phase 3: Wake word activation
- Phase 4: Conversational: "Chef, my sauce is too thin"

### Capability 10: Restaurant Recreation
**Question**: Can Chef help recreate a restaurant dish from a photo?

| Aspect | Detail |
|--------|--------|
| Data Required | Dish photo, analyseScannedImage, reanalyseDish, generateDishRecipe |
| Feasibility | 5/5 - Already built |
| Build Complexity | Low (UI only) |
| User Value | 4/5 - "Make this at home" is powerful |
| Differentiation | High |

**Implementation**:
- Already have the AI functions
- Add UI flow: "Recreate this dish" in scan screen
- Connect to extractMenuDishes for restaurant menus
- "Snap a photo of your meal, Chef will recreate it"

## Phased Roadmap

### v1 (0-3 months): Foundation
| Capability | Priority | Effort | Dependencies |
|------------|----------|--------|--------------|
| Predictive Scheduling | P0 | Low | step_actuals table |
| Seasonal Intelligence | P1 | Low | None |
| Restaurant Recreation UI | P1 | Low | None (AI exists) |
| Personalized Recommendations | P2 | Medium | meal_plans.cooked_at |

### v2 (3-6 months): Learning
| Capability | Priority | Effort | Dependencies |
|------------|----------|--------|--------------|
| Skill Assessment | P0 | Medium | step_actuals volume |
| Nutritional Intelligence | P1 | Medium | cook confirmation |
| Skill Progression | P1 | Medium | skill assessment |
| Waste Reduction | P2 | Medium | purchase tracking |

### v3 (6-12 months): Magic
| Capability | Priority | Effort | Dependencies |
|------------|----------|--------|--------------|
| Voice Cook Mode | P0 | High | Mobile SDK |
| Social Intelligence | P1 | Medium | User scale |
| Proactive Chef (push suggestions) | P1 | Medium | All signals |
| Equipment-aware recommendations | P2 | Medium | Equipment profile |

## Success Metrics

| Metric | v1 Target | v2 Target | v3 Target |
|--------|-----------|-----------|-----------|
| Chef suggestions clicked | 5% | 15% | 30% |
| User timing factors calculated | 100 | 5,000 | 50,000 |
| Skills assessed | 0 | 1,000 | 20,000 |
| Voice commands processed | 0 | 0 | 10,000/day |
| "Chef helped me cook" NPS mentions | 10 | 50 | 200 |
