# ChefsBook AI Cost Analysis Report
**Date:** 2026-04-16
**Author:** Claude Code (session 166)

---

## Executive Summary

1. **A Chef-plan user ($4.99/mo) importing 10 recipes/month costs ~$0.32 in AI — 94% gross margin before infrastructure.**
2. **Pro plan ($14.99/mo) costs ~$0.55/user/month (Flux Dev images) — 96% gross margin.**
3. **The single most expensive operation is Sonnet recipe extraction at ~$0.015/call, but it's one-time per import and cached.**

---

## Part 1 — Complete AI Function Inventory

### Claude Haiku Functions (~$0.0001–$0.005/call)

| Function | Model | Est. Input | Est. Output | Cost/call | Trigger | Cached? |
|----------|-------|-----------|------------|-----------|---------|---------|
| moderateComment() | haiku | 200 tok | 100 tok | $0.00016 | Every new comment | No |
| moderateMessage() | haiku | 200 tok | 100 tok | $0.00016 | Every new DM | No |
| moderateRecipe() | haiku | 300 tok | 150 tok | $0.00020 | Every recipe save | Yes (skip if unchanged) |
| isUsernameFamilyFriendly() | haiku | 100 tok | 50 tok | $0.00008 | Signup only | No |
| isActuallyARecipe() | haiku | 300 tok | 200 tok | $0.00020 | Every completed import | No |
| classifyContent() | haiku | 600 tok | 200 tok | $0.00016 | Every URL import | No |
| classifyPage() | haiku | 300 tok | 200 tok | $0.00016 | Every URL import | No |
| detectLanguage() | haiku | 200 tok | 10 tok | $0.0001 | Every import (often free via heuristic) | No |
| describeSourceImage() | haiku (vision) | 150 tok | 150 tok | $0.005 | Import when og:image found (~60%) | No |
| checkImageForWatermarks() | haiku (vision) | 200 tok | 300 tok | $0.005 | Every user image upload | No |
| rewriteRecipeSteps() | haiku | 800 tok | 1,500 tok | $0.0003 | Every URL import (fire-and-forget) | No |
| suggestPurchaseUnits() | haiku | 400 tok | 600 tok | $0.00040 | Every cart add | No |
| suggestRecipes() | haiku | 300 tok | 1,500 tok | $0.0006 | User-initiated | No |
| analyseScannedImage() | haiku | 300 tok | 800 tok | $0.00030 | Each dish scan | No |
| reanalyseDish() | haiku | 400 tok | 800 tok | $0.00030 | User clarification | No |
| socialShareText/Hashtags | haiku | 300 tok | 300 tok | $0.00020 | User-initiated | No |
| matchFolderToCategory() | haiku | 200 tok | 200 tok | $0.00016 | Per import folder | No |
| matchFoldersToCategories() | haiku | 500 tok | 500 tok | $0.0005 | Bookmark batch import | No |
| readBookCover() | haiku | 150 tok | 200 tok | $0.00020 | User-initiated | No |
| translateRecipeTitle() | haiku | 200 tok | 300 tok | $0.00020 | Per recipe per language | Yes (DB) |
| mergeShoppingList() | haiku | 2,000 tok | 2,500 tok | $0.0008 | User-initiated | No |

### Claude Sonnet Functions (~$0.003–$0.020/call)

| Function | Model | Est. Input | Est. Output | Cost/call | Trigger | Cached? |
|----------|-------|-----------|------------|-----------|---------|---------|
| importFromUrl() | sonnet | 12,500 tok | 2,500 tok | $0.015 | URL import (when JSON-LD incomplete) | Yes (one-time) |
| scanRecipe() | sonnet | 1,500 tok | 2,500 tok | $0.015 | Photo scan import | Yes (one-time) |
| scanRecipeMultiPage() | sonnet | 2,000 tok | 3,000 tok | $0.015 | Multi-page scan | Yes (one-time) |
| translateRecipeContent() | sonnet | 2,500 tok | 3,000 tok | $0.003 | Import when source != user language | No |
| translateRecipe() (full) | sonnet | 1,500 tok | 3,000 tok | $0.011 | User-initiated language switch | Yes (shared DB cache) |
| importFromYouTube() | sonnet | 8,200 tok | 2,500 tok | $0.015 | YouTube import | Yes (one-time) |
| importTechnique() | sonnet | 4,000 tok | 2,500 tok | $0.015 | Technique import | Yes (one-time) |
| importTechniqueFromYouTube() | sonnet | 4,200 tok | 2,500 tok | $0.015 | YouTube technique import | Yes (one-time) |
| generateMealPlan() | sonnet | 2,500 tok | 2,500 tok | $0.020 | User-initiated | No |
| generateDishRecipe() | sonnet | 1,200 tok | 3,000 tok | $0.015 | User-initiated dish→recipe | No |
| generateVariation() | sonnet | 1,200 tok | 2,000 tok | $0.015 | User-initiated variation | No |
| formatVoiceRecipe() | sonnet | 1,500 tok | 2,000 tok | $0.010 | Voice/speak import | No |
| generateAiChefSuggestion() | sonnet | 800 tok | 2,000 tok | $0.015 | User-initiated "finish recipe" | No |
| generateCookbookToc() | sonnet | 1,000 tok | 2,000 tok | $0.020 | Per cookbook add | No |

### Replicate Image Generation

| Function | Model | Cost/call | Trigger |
|----------|-------|-----------|---------|
| generateRecipeImage() — Schnell | flux-schnell | $0.003 | Free/Chef/Family plan |
| generateRecipeImage() — Dev | flux-dev | $0.025 | Pro plan (or admin override) |

---

## Part 2 — Cost Per Recipe Import by Method

### A. URL Import — English site, complete JSON-LD (best case)

| Step | Cost |
|------|------|
| classifyContent() | $0.00016 |
| JSON-LD extraction (no Claude needed) | $0.00 |
| isActuallyARecipe() | $0.00020 |
| rewriteRecipeSteps() | $0.0003 |
| describeSourceImage() (60% have image) | $0.003 avg |
| generateRecipeImage() — Schnell | $0.003 |
| moderateRecipe() | $0.00020 |
| **Total (Schnell)** | **$0.0069** |
| **Total (Dev/Pro)** | **$0.0289** |

### B. URL Import — English site, no JSON-LD (Claude extraction needed)

| Step | Cost |
|------|------|
| classifyContent() | $0.00016 |
| importFromUrl() — Sonnet extraction | $0.015 |
| isActuallyARecipe() | $0.00020 |
| rewriteRecipeSteps() | $0.0003 |
| describeSourceImage() (60%) | $0.003 avg |
| generateRecipeImage() — Schnell | $0.003 |
| moderateRecipe() | $0.00020 |
| **Total (Schnell)** | **$0.0219** |
| **Total (Dev/Pro)** | **$0.0439** |

### C. URL Import — Non-English site

| Step | Cost |
|------|------|
| All of B above | $0.0219 |
| detectLanguage() | $0.0001 |
| translateRecipeContent() — Sonnet | $0.003 |
| **Total (Schnell)** | **$0.0250** |
| **Total (Dev/Pro)** | **$0.0470** |

### D. Photo/Scan Import

| Step | Cost |
|------|------|
| scanRecipe() — Sonnet Vision | $0.015 |
| isActuallyARecipe() | $0.00020 |
| rewriteRecipeSteps() | $0.0003 |
| generateRecipeImage() — Schnell | $0.003 |
| moderateRecipe() | $0.00020 |
| **Total (Schnell)** | **$0.0187** |
| **Total (Dev/Pro)** | **$0.0407** |

### E. Voice Import (Speak a Recipe)

| Step | Cost |
|------|------|
| formatVoiceRecipe() — Sonnet | $0.010 |
| isActuallyARecipe() | $0.00020 |
| generateRecipeImage() — Schnell | $0.003 |
| moderateRecipe() | $0.00020 |
| **Total (Schnell)** | **$0.0134** |
| **Total (Dev/Pro)** | **$0.0354** |

### F. User Image Upload (watermark check only)

| Step | Cost |
|------|------|
| checkImageForWatermarks() — Haiku Vision | $0.005 |
| **Total** | **$0.005** |

### G. Image Regeneration (1 per recipe)

| Plan | Cost |
|------|------|
| Free/Chef/Family (Schnell) | $0.003 |
| Pro (Dev) | $0.025 |

---

## Part 3 — Monthly Cost Per User by Plan

### Assumptions

| Parameter | Value | Rationale |
|-----------|-------|-----------|
| Recipes imported per user/month | 10 | Active user |
| % English sites (JSON-LD available) | 50% | Half have structured data |
| % English sites (Claude needed) | 20% | No JSON-LD |
| % Non-English sites | 15% | International users |
| % Photo scans | 10% | Mobile users |
| % Voice imports | 5% | Speak feature |
| % with source image | 60% | og:image availability |
| % user image uploads | 20% of imports (2/mo) | Some manual uploads |
| % using image regeneration | 10% of recipes (1/mo) | Occasional regen |
| Meal plans generated/month | 2 | Active planner |
| Shopping lists merged/month | 4 | Weekly shopping |
| Recipe title translations/month | 20 | Multilingual browsing |
| Comments posted/month | 5 | Social engagement |

### Weighted Average Import Cost

| Method | Weight | Cost (Schnell) | Weighted |
|--------|--------|---------------|----------|
| URL + JSON-LD | 50% | $0.0069 | $0.00345 |
| URL + Claude | 20% | $0.0219 | $0.00438 |
| URL non-English | 15% | $0.0250 | $0.00375 |
| Photo scan | 10% | $0.0187 | $0.00187 |
| Voice | 5% | $0.0134 | $0.00067 |
| **Weighted avg (Schnell)** | | | **$0.01412** |
| **Weighted avg (Dev/Pro)** | | | **$0.03612** |

### Free Plan ($0/mo) — 0 own recipes, no import

Free users cannot import/scan/AI. AI cost = $0.00/month.

### Chef Plan ($4.99/mo)

| Category | Calculation | Cost |
|----------|-------------|------|
| 10 recipe imports | 10 x $0.01412 | $0.141 |
| 2 user image uploads | 2 x $0.005 | $0.010 |
| 1 image regeneration | 1 x $0.003 | $0.003 |
| 2 meal plans | 2 x $0.020 | $0.040 |
| 4 shopping list merges | 4 x $0.0008 | $0.003 |
| 20 title translations | 20 x $0.0002 | $0.004 |
| 5 comments (moderation) | 5 x $0.00016 | $0.001 |
| **Total monthly AI cost** | | **$0.202** |
| **Infrastructure (RPi5 amortized)** | | ~$0.10 |
| **Revenue** | | $4.99 |
| **Gross margin** | ($4.99 - $0.30) / $4.99 | **94%** |

### Family Plan ($9.99/mo) — up to 6 members

Assumption: 3 active members average (not all 6 active every month).

| Category | Calculation | Cost |
|----------|-------------|------|
| 3 active members x Chef cost | 3 x $0.202 | $0.606 |
| Infrastructure | | ~$0.10 |
| **Total monthly cost** | | **$0.71** |
| **Revenue** | | $9.99 |
| **Gross margin** | ($9.99 - $0.71) / $9.99 | **93%** |

### Pro Plan ($14.99/mo) — Flux Dev images

| Category | Calculation | Cost |
|----------|-------------|------|
| 10 recipe imports (Dev) | 10 x $0.03612 | $0.361 |
| 2 user image uploads | 2 x $0.005 | $0.010 |
| 1 image regeneration (Dev) | 1 x $0.025 | $0.025 |
| 2 meal plans | 2 x $0.020 | $0.040 |
| 4 shopping list merges | 4 x $0.0008 | $0.003 |
| 20 title translations | 20 x $0.0002 | $0.004 |
| 5 comments (moderation) | 5 x $0.00016 | $0.001 |
| PDF export (no AI) | | $0.000 |
| **Total monthly AI cost** | | **$0.444** |
| **Infrastructure** | | ~$0.10 |
| **Revenue** | | $14.99 |
| **Gross margin** | ($14.99 - $0.54) / $14.99 | **96%** |

---

## Part 4 — Lifetime Cost Per User

Assuming a user imports 500 recipes over their lifetime:

| Category | Chef (Schnell) | Pro (Dev) |
|----------|---------------|-----------|
| 500 recipe imports | 500 x $0.01412 = $7.06 | 500 x $0.03612 = $18.06 |
| 100 image regens | 100 x $0.003 = $0.30 | 100 x $0.025 = $2.50 |
| 500 recipe moderations | 500 x $0.0002 = $0.10 | $0.10 |
| 100 meal plans (50 months) | 100 x $0.020 = $2.00 | $2.00 |
| 200 shopping merges | 200 x $0.0008 = $0.16 | $0.16 |
| 1,000 title translations | 1,000 x $0.0002 = $0.20 | $0.20 |
| **Total lifetime AI cost** | **$9.82** | **$23.02** |

**Break-even:**
- Chef plan: $9.82 / ($4.99 - $0.10 infra) = **2.0 months** of subscription covers lifetime AI cost
- Pro plan: $23.02 / ($14.99 - $0.10 infra) = **1.5 months** of subscription covers lifetime AI cost

---

## Part 5 — Cost Anomalies & Recommendations

### Functions Using Sonnet That Could Use Haiku

| Function | Current Model | Cost/call | Recommendation | Savings |
|----------|--------------|-----------|----------------|---------|
| rewriteRecipeSteps() | haiku | $0.0003 | Already optimal | — |
| mergeShoppingList() | haiku | $0.0008 | Already optimal (switched session 139) | — |
| suggestRecipes() | haiku | $0.0006 | Already optimal (switched session 139) | — |
| translateRecipeContent() | sonnet | $0.003 | Keep sonnet — culinary terms need quality | — |

**All classification/moderation functions already use Haiku.** No model downgrades recommended.

### Potential Optimizations

1. **describeSourceImage() adds $0.003 avg per import** ($0.005 x 60% probability). This is the newest cost center. Consider making it optional or only for Pro users to save ~$0.003/import for Chef users. Annual savings for 1,000 Chef users: ~$360/year.

2. **rewriteRecipeSteps() runs on every URL import** but is fire-and-forget. If it fails silently, the user still gets the original steps. This is a good trade-off — $0.0003/call is negligible.

3. **Image generation is the second biggest cost** after Sonnet extraction. The Schnell/Dev split is well-designed: $0.003 vs $0.025 maps cleanly to plan tiers.

4. **Sonnet recipe extraction ($0.015/call)** is by far the most expensive per-call function. But it only fires when JSON-LD is incomplete (~35% of imports). The JSON-LD-first pipeline (session 145) was the single most impactful cost optimization — it eliminated Sonnet calls for 50%+ of imports.

### Missing from CLAUDE.md Cost Table

All functions are already documented. No gaps found.

---

## Summary Table

| Plan | Monthly Revenue | Monthly AI Cost | Infrastructure | Gross Margin |
|------|----------------|----------------|----------------|-------------|
| Free | $0.00 | $0.00 | $0.00 | N/A |
| Chef | $4.99 | $0.20 | $0.10 | **94%** |
| Family | $9.99 | $0.71 | $0.10 | **93%** |
| Pro | $14.99 | $0.44 | $0.10 | **96%** |

The AI cost structure is healthy across all paid plans, with 93-96% gross margins. The JSON-LD-first pipeline and Haiku-for-classification strategy keep costs well below $1/user/month.
