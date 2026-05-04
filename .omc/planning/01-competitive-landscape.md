# Competitive Landscape Analysis

## Executive Summary

The recipe app market is in flux. Two major players (Yummly, AllRecipes) have discontinued their apps in 2024-2025. The remaining competitors fall into three categories: subscription content providers (NYT Cooking), utility-first tools (Paprika, BigOven), and social-first platforms (Cookpad). No competitor combines all three. ChefsBook is uniquely positioned to become the dominant platform by unifying content, utility, and community around the act of actually cooking.

## Competitive Matrix

| Competitor | Status | Pricing | AI Features | Social | Unique Strength | Fatal Weakness |
|------------|--------|---------|-------------|--------|-----------------|----------------|
| **Yummly** | DEAD (Dec 2024) | Was $0.99/mo | Taste Profile ML | Minimal | N/A - Discontinued | Whirlpool killed it |
| **AllRecipes** | App DEAD | Free (web only) | None | Comments | 1M+ recipes | Moved to web, ads everywhere |
| **NYT Cooking** | Active | $5/mo | None | Comments only | Editorial quality | Paywalled, no AI, no planning |
| **Samsung Food (Whisk)** | Active | $6.99/mo | Recipe suggestions | Health integration | Samsung ecosystem | Locked to Samsung |
| **Paprika** | Active | $4.99 one-time | Paprika 4: AI scanning | None | One-time purchase | No social, dated UI |
| **Mealime** | Active | Free / $5.99/mo | Diet filtering | None | Quick 30-min recipes | Dinner-only, no social |
| **Cookpad** | Active | Free | AI photo import | Strong (100M users) | Global community | Recipe quality varies |
| **BigOven** | Active | $2.99/mo | "Use Up Leftovers" | Community recipes | 1M recipes | Ads, no AI |
| **SideChef** | Active | Free / Premium | RecipeGen AI | Minimal | Step-by-step video | Appliance-focused B2B |
| **HelloFresh** | Active | Meal kit pricing | Video import | Minimal | Free cookbook feature | Tied to meal kit business |
| **Tasty** | Active | Free | Cost estimation | Creator connections | Video-first content | BuzzFeed declining |
| **Eat Your Books** | Active | $3/mo | None | None | Cookbook indexing | Niche audience |

## Gap Analysis: What's Missing

### 1. No One Has Cook Mode With Real Scheduling
Every app has timers. None have reverse-scheduling from serve time with oven conflict resolution and multi-chef coordination. **ChefsBook has this** in `packages/ui/src/scheduler.ts`.

### 2. No Learning Knowledge Graph
Competitors use static timing estimates or no timing at all. **ChefsBook has `cooking_action_timings`** - a knowledge graph that learns from actual cooking sessions via `observed_count` and `observed_avg_minutes`.

### 3. No Personal Recipe Versions
Users want to tweak recipes and keep their modifications. Most apps don't support this. **ChefsBook has personal versions** with `is_personal_version`, `personal_version_of`, and `recipe_modifiers` tables.

### 4. No Integrated Menu Planning for Dinner Parties
Meal planning apps plan weekly meals. None plan multi-course dinner parties with timing coordination. **ChefsBook has `menus` + `menu_items`** with course-based organization.

### 5. Print Cookbook Publishing is Fragmented
Users want to print family cookbooks. This requires going to a separate service. **ChefsBook has `printed_cookbooks`** with Lulu integration.

## Top 10 Unmet Needs (Ranked by Market Size x Feasibility)

| Rank | Need | Market Size | ChefsBook Position | Build Effort |
|------|------|------------|-------------------|--------------|
| 1 | **AI that learns my cooking style** | Massive (every cook) | 70% built (knowledge graph exists) | Medium |
| 2 | **"What can I make with what I have?"** | Massive | 60% built (suggestRecipes exists) | Low |
| 3 | **Real cook mode with timing coordination** | Large (serious cooks) | 90% built (scheduler done) | Low (UI) |
| 4 | **Family recipe inheritance/sharing** | Large (emotional value) | Tables exist, UI pending | Medium |
| 5 | **Video recipe import from TikTok/IG** | Large (Gen Z) | YouTube done, social pending | Medium |
| 6 | **Cost estimation per recipe** | Large (budget cooks) | Not built | Medium |
| 7 | **Grocery delivery integration** | Large | Not built | High (partnerships) |
| 8 | **Live cook-alongs** | Medium (community) | Not built | High |
| 9 | **Skill progression/learning paths** | Medium | Techniques table exists | Medium |
| 10 | **Restaurant dish recreation** | Medium | reanalyseDish exists | Low |

## User Sentiment Summary (Reddit/App Store)

### What Users Love (and ChefsBook must replicate)
- **Paprika**: "One-time purchase is a breath of fresh air"
- **Cookpad**: "Real people, real recipes, not influencer garbage"
- **Mealime**: "Just works, no fluff"
- **SideChef**: "Step-by-step videos changed everything"

### What Users Hate (and ChefsBook must avoid)
- **AllRecipes**: "ADS EVERYWHERE. Full-screen popups while cooking."
- **BigOven**: "Recipe quality is hit or miss"
- **NYT Cooking**: "$5/month just to see a recipe is ridiculous"
- **Mealime**: "Only does dinner, useless for breakfast/lunch"

## Strategic Implications

1. **The market is consolidating** - Yummly and AllRecipes dying creates opportunity
2. **Users are fatigued by subscriptions** - Paprika's one-time purchase model is beloved
3. **AI is table stakes but poorly implemented** - SideChef has 6.5x retention with GenAI
4. **Social is undervalued** - Cookpad's 100M users prove community matters
5. **Cook mode is the differentiator** - ChefsBook's scheduler is years ahead

## Recommended Competitive Positioning

**ChefsBook is the only platform that actually helps you COOK, not just browse recipes.**

- vs NYT Cooking: "We don't paywall recipes. We help you cook them."
- vs Paprika: "We have AI. And social. And a scheduler."
- vs Cookpad: "Community + intelligence, not just community."
- vs SideChef: "We schedule your entire dinner party, not just one recipe."
