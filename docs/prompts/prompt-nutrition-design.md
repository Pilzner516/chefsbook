# Prompt: Nutrition Feature — Opus Design Document
# Run with: Opus. Output is a design document, NO code changes in this session.
# Launch: Read docs/prompts/prompt-nutrition-design.md and produce the deliverable below.

## YOUR ROLE IN THIS SESSION
You are the lead architect for ChefsBook. Your job is to produce a complete, 
authoritative design document for the Nutrition feature before any code is written.
This document will be handed to implementation agents — it must be complete enough
that they can build without ambiguity.

DO NOT write any code in this session.
DO NOT make any database changes.
DO NOT deploy anything.

Your deliverable is a markdown design document saved to:
  docs/nutrition-design.md

---

## CONTEXT — READ THESE FILES FIRST (MANDATORY)

Before writing anything, read:
1. CLAUDE.md — full project context, stack, RPi5 setup
2. docs/agents/feature-registry.md — existing features (avoid overlap)
3. docs/agents/import-pipeline.md — how recipes are imported and enriched
4. docs/agents/ai-cost.md — Claude model selection and cost model
5. packages/ai/src/client.ts — how callClaude() works, existing patterns
6. packages/ai/src/ — scan the directory for existing AI functions
7. apps/web/app/recipe/[id]/page.tsx — recipe detail page structure
8. apps/web/app/dashboard/search — search filter implementation
9. apps/web/app/api/meal-plan — meal plan generation

Then check the actual database schema:
```bash
ssh rasp@rpi5-eth "sudo docker exec supabase-db psql -U postgres -d postgres \
  -c '\d recipes'" 
```

This gives you the exact columns on the recipes table so you design the schema
correctly first time.

---

## FEATURE REQUIREMENTS

### Core requirement
Every recipe in ChefsBook should have a nutritional facts card at the bottom of
its detail page. The card shows:
- Calories
- Protein (g)
- Carbohydrates (g)
- Fat (g)  
- Fiber (g)
- Sugar (g)
- Sodium (mg)

### Per serving / Per 100g toggle
- Default view: per serving
- Toggle to: per 100g
- Toggle is only visible if per_100g data could be calculated
- Toggle state persists in localStorage (user preference)
- If Claude cannot estimate total recipe weight confidently, per_100g is null
  and toggle is hidden for that recipe

### Generation
- Claude Sonnet estimates nutrition from the structured ingredient list
- Generated at import time automatically (after ingredients are confirmed)
- Available as a manual "Generate Nutrition" button + regenerate pill on detail page
- Must work for all import paths: URL import, scan, extension, manual entry, speak
- Label clearly as "Estimated by Sous Chef" — never presented as clinically verified
- Disclaimer: "Nutritional values are estimates. Not a substitute for professional dietary advice."

### Search filters
- Add to the existing search filter system (category drill-down)
- Filters: calorie ranges, protein level, dietary fit presets (low carb, high protein, etc.)
- These must use JSONB queries against the stored nutrition data

### Meal plan integration  
- Meal plan generator (generateMealPlan) should accept optional nutritional goals
- User can optionally set: daily calorie target, macro split preference
- Generated plan should show a daily nutrition summary

---

## WHAT THE DESIGN DOCUMENT MUST COVER

### 1. Database Schema
- Exact SQL for the migration (ALTER TABLE or new table — justify your choice)
- The JSONB structure with all fields and types
- Indexes needed for the search filter queries
- How NULL is handled (recipe has no nutrition yet)

### 2. AI Function Design
- Function signature for generateNutrition()
- The Claude prompt — written in full, not summarized
  - Must instruct Claude to estimate total recipe weight for per_100g calculation
  - Must handle recipes where weight cannot be estimated (soups, sauces, drinks)
  - Must return structured JSON matching the schema exactly
  - Must include confidence field
- maxTokens recommendation with justification
- Model selection: Haiku vs Sonnet (justify based on task complexity)
- Error handling: what happens if Claude returns malformed JSON

### 3. Import Pipeline Integration
List every import path and exactly where generateNutrition() is called:
- importFromUrl / importUrlFull
- scanRecipe / scanRecipeMultiPage  
- Extension import
- Manual recipe creation
- Speak a recipe
- YouTube import
- Cookbook TOC import

For each: is nutrition generated immediately, deferred, or skipped? Why?
Consider: some import paths already have multiple Claude calls — adding another
affects cost. See ai-cost.md and make a recommendation.

### 4. Recipe Detail UI
- Where exactly in page.tsx the card is inserted (after steps? after notes?)
- Card component structure (props, data shape)
- Per serving vs per 100g toggle implementation
- Loading state (skeleton) while nutrition is being generated
- Empty state when nutrition hasn't been generated yet
- Generate / Regenerate button placement and visibility rules (owner only)
- Trattoria design system compliance (cream #faf7f0, red #ce2b37, green #009246)
- Mobile layout considerations (card must work in the mobile app too)

### 5. Search Filter Integration
- Exact filter options to add (labels, ranges, values)
- How the JSONB queries work (show the SQL)
- Where in the existing search UI the nutrition filters appear
- Any new RPC function needed or extension of existing one

### 6. Meal Plan Integration  
- What new inputs the meal plan UI needs
- How the generateMealPlan prompt changes
- What the daily nutrition summary row looks like in the plan output
- Whether nutrition targets affect recipe selection or just labeling

### 7. Implementation Order
A numbered build sequence that:
- Never leaves the app in a broken state
- Ships value at each step (e.g. card is visible before search filters exist)
- Identifies which steps can run in parallel

### 8. Prompt Split Recommendation
Recommend how to split this into implementation prompts (Nutrition-1, Nutrition-2, etc.)
Each prompt should be small enough to complete in one session without agent drift.
State which model (Opus vs Sonnet) for each.

### 9. Cost Analysis
Estimate the incremental Claude cost per user per month from nutrition generation.
Use the cost model in ai-cost.md.
Assume an average user imports 5 new recipes/month.
Is this material to the existing cost model?

### 10. Edge Cases
Document how the system handles:
- Recipe with no ingredients (manual entry stub)
- Recipe with very few ingredients (e.g. "salt and pepper to taste")
- Alcoholic recipes (flag for dietary compliance)
- Recipes serving 0 or null (missing serving count)
- Very large recipes (wedding cake, 50 servings)
- Already-imported recipes with no nutrition (retroactive generation)
  How does the admin trigger bulk generation for existing recipes?

---

## OUTPUT FORMAT

Save the complete design document to docs/nutrition-design.md.

The document should be structured with clear headings matching the 10 sections above.
Use tables where appropriate (e.g. import path matrix, cost analysis).
Include the full Claude prompt for generateNutrition() — do not abbreviate it.
Include the exact migration SQL.
Include the JSONB schema with example data.

End the document with a "OPEN QUESTIONS" section listing anything that requires
Bob's decision before implementation begins.

---

## WRAPUP REQUIREMENT
This session produces ONE file: docs/nutrition-design.md
No code changes. No deployments. No migrations.
DONE.md entry: "[SESSION NUTRITION-DESIGN] Design document produced at docs/nutrition-design.md. Ready for implementation."
