# ChefsBook — Session 159: AI Cost Analysis Per Plan and Per Recipe Import
# Source: Need to understand true AI cost per user per plan
# Target: docs/ (report only — no code changes)

---

## CONTEXT

Read CLAUDE.md, DONE.md, ai-cost.md, and feature-registry.md.
Read packages/ai/src/ fully to find every AI function call.

This session produces a definitive cost report showing:
1. What AI calls happen per recipe import (by method)
2. What AI calls happen per user action
3. Total estimated cost per plan tier per month
4. Margin analysis against plan pricing

NO code changes. Report only.

---

## PART 1 — Map every AI call in the system

Read every file in packages/ai/src/ and list every function that
calls Claude API or Replicate API. For each function document:

| Function | Model | Est. tokens in | Est. tokens out | Cost/call | When triggered |
|----------|-------|----------------|-----------------|-----------|----------------|
| importFromUrl | ... | ... | ... | ... | Every URL import |
| detectLanguage | ... | ... | ... | ... | Every non-English import |
| translateRecipeToLanguage | ... | ... | ... | ... | When source ≠ user lang |
| describeSourceImage | ... | ... | ... | ... | When source image exists |
| rewriteRecipeSteps | ... | ... | ... | ... | Every URL import |
| isActuallyARecipe | ... | ... | ... | ... | Every import (completeness) |
| generateMissingIngredients | ... | ... | ... | ... | On demand |
| generateRecipeImage (Schnell) | ... | ... | ... | $0.003 | Free/Chef/Family |
| generateRecipeImage (Dev) | ... | ... | ... | $0.025 | Pro plan |
| checkImageForWatermarks | ... | ... | ... | ... | Every user image upload |
| rewriteRecipeSteps | ... | ... | ... | ... | Every import |
| scanRecipe (photo) | ... | ... | ... | ... | Photo scan import |
| speakRecipe | ... | ... | ... | ... | Voice import |
| moderateRecipe | ... | ... | ... | ... | Every recipe save |
| suggestTags | ... | ... | ... | ... | On import |
| suggestRecipes | ... | ... | ... | ... | Meal planning |
| generateMealPlan | ... | ... | ... | ... | Meal plan generation |
| mergeShoppingList | ... | ... | ... | ... | Shopping list generation |
| translateTitle (batch) | ... | ... | ... | ... | Per language per recipe |

Add any others found in the codebase.

---

## PART 2 — Cost per recipe import by method

Calculate the total AI cost for each import path:

### URL import (English site, complete JSON-LD)
- importFromUrl (Claude extraction if needed)
- isActuallyARecipe (Haiku completeness check)
- rewriteRecipeSteps (Haiku step rewrite)
- describeSourceImage (Haiku Vision, if image found)
- generateRecipeImage Schnell OR Dev (always)
- moderateRecipe (Haiku)
- suggestTags (Haiku, if needed)
**Total: $X.XXX**

### URL import (non-English site)
- All of the above PLUS:
- detectLanguage (Haiku, often free via heuristic)
- translateRecipeToLanguage (Sonnet)
**Total: $X.XXX**

### URL import (JS-rendered site, extension PDF fallback)
- Server attempt (partial)
- Extension HTML extraction → server re-processes
- All standard steps above
**Total: $X.XXX**

### Photo/scan import
- scanRecipe (Sonnet Vision)
- isActuallyARecipe
- rewriteRecipeSteps
- generateRecipeImage
- moderateRecipe
**Total: $X.XXX**

### Voice import (Speak a Recipe)
- Whisper or Claude transcription
- Standard pipeline
**Total: $X.XXX**

### User image upload (with watermark check)
- checkImageForWatermarks (Haiku Vision)
**Total: $X.XXX**

### AI ingredient generation (on demand)
- generateMissingIngredients (Sonnet)
**Total: $X.XXX**

### Image regeneration (1 per recipe)
- generateRecipeImage Schnell or Dev
**Total: $0.003 or $0.025**

---

## PART 3 — Monthly cost per user by plan

Assumptions (document these clearly):
- Average recipes imported per user per month: 10
- % from English sites: 70%
- % from non-English sites: 15%
- % from JS-rendered sites (PDF fallback): 15%
- % with source image available: 60%
- % of user uploads that trigger watermark check: 20% of imports
- % that request AI ingredient generation: 5% of imports
- % that use image regeneration: 10% of recipes
- Average meal plans generated per month: 2
- Average shopping lists generated per month: 4
- Average recipe translations viewed (batch title): 20 per month

### Free plan
Cost per recipe import: $X.XXX
10 recipes/month × $X.XXX = $X.XX
+ meal planning (2×): $X.XX
+ shopping lists (4×): $X.XX
+ translations (20 titles): $X.XX
**Total monthly AI cost per Free user: $X.XX**

### Chef plan ($4.99/mo)
Same as Free (Flux Schnell)
**Total monthly AI cost per Chef user: $X.XX**
**Gross margin: ($4.99 - $X.XX - infrastructure) / $4.99 = X%**

### Family plan ($9.99/mo)
Same model as Chef but up to 6 members
6 members × Chef cost = $X.XX
**Total monthly AI cost per Family plan: $X.XX**
**Gross margin: ($9.99 - $X.XX - infrastructure) / $9.99 = X%**

### Pro plan ($14.99/mo)
Same as Chef but Flux Dev for images
10 recipes × $0.025 (Dev) instead of $0.003 (Schnell) = +$0.22
**Total monthly AI cost per Pro user: $X.XX**
**Gross margin: ($14.99 - $X.XX - infrastructure) / $14.99 = X%**

---

## PART 4 — Lifetime cost per user

A user who imports 500 recipes total over their lifetime:
- 500 × average import cost = $X.XX total AI cost
- 500 × image generation = $X.XX
- Ongoing: meal plans, shopping lists (monthly)

Break-even point (months of subscription to cover lifetime AI cost):
X months of Chef plan = covers lifetime import AI cost

---

## PART 5 — Cost anomalies to flag

Identify any functions that are:
- Surprisingly expensive (cost > $0.01 per call)
- Called more often than necessary
- Using Sonnet where Haiku would suffice
- Missing from the current cost tracking in CLAUDE.md

Recommend model downgrades where quality allows.

---

## OUTPUT FORMAT

Save the report to: docs/AI-COST-REPORT-2026-04-16.md

Format as a clean markdown report with:
- Executive summary (3 bullet points)
- Full function cost table
- Per-import-method breakdown
- Per-plan monthly cost table
- Margin analysis
- Recommendations

Also update CLAUDE.md AI cost table with any missing functions found.

---

## COMPLETION CHECKLIST

- [ ] Every AI function in packages/ai/src/ inventoried
- [ ] Cost per call calculated for each function
- [ ] Cost per import method calculated (5 methods)
- [ ] Monthly cost per user calculated for all 4 plans
- [ ] Gross margin calculated for Chef, Family, Pro plans
- [ ] Lifetime cost per user estimated
- [ ] Cost anomalies identified with recommendations
- [ ] docs/AI-COST-REPORT-2026-04-16.md saved
- [ ] CLAUDE.md AI cost table updated with missing functions
- [ ] Run /wrapup
- [ ] At the end: give the 3 most important numbers from the report
      (e.g. "Chef plan costs $0.47/user/month to serve, 90% margin")
