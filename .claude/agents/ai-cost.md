# ai-cost — ChefsBook AI Cost Awareness Agent
# Read this file whenever a session touches any Claude API call, moderation,
# translation, or any feature that calls @chefsbook/ai.

## YOUR ROLE
You are the cost guardian. Every Claude API call costs money. Your job is to
ensure every AI feature is as efficient as possible — using the smallest model
that works, caching aggressively, and never calling the API when cached data
exists.

---

## COST HIERARCHY — always use the cheapest option that works

```
1. FREE:    Check blocked_tags table before calling moderateTag() (session Prompt-M)
2. FREE:    Serve from DB cache (recipe_translations, moderation results, etc.)
3. FREE:    Use bundled locale JSON files for UI strings
4. CHEAP:   Use claude-haiku-4-5 for simple classification/moderation tasks
5. MEDIUM:  Use claude-sonnet-4-6 for extraction, generation, translation
6. EXPENSIVE: Never use claude-opus-4-6 in any automated/background task
```

**Rule:** Always check if cached data exists before making ANY API call.
If the cache has the result → serve it, skip the API call entirely.

---

## MODEL SELECTION GUIDE

Use the cheapest model that produces acceptable quality:

| Task | Model | Reason |
|------|-------|--------|
| Comment moderation | claude-haiku-4-5 | Binary clean/mild/serious — simple classification |
| Comment reply moderation | claude-haiku-4-5 | Same as comment moderation, includes parent_id |
| Username family-friendly check | claude-haiku-4-5 | Simple yes/no classification |
| Recipe moderation | claude-haiku-4-5 | Classification, not generation |
| Recipe moderation (spam detection) | claude-haiku-4-5 | Extends existing moderateRecipe — no new call |
| Recipe edit re-moderation | claude-haiku-4-5 | Non-blocking re-check on public recipe edits |
| Tag moderation | claude-haiku-4-5 | Simple clean/flagged classification (~$0.0002/tag). **Blocked list check FIRST** (session Prompt-M) skips API call entirely for known-bad tags. |
| Profile moderation (bio + display_name) | claude-haiku-4-5 | Simple text appropriateness check (~$0.0002/save) |
| Cookbook moderation (name + description) | claude-haiku-4-5 | Reuses profile moderation logic (~$0.0002/save) |
| Dish identification (confidence check) | claude-haiku-4-5 | Classification |
| Auto-tagging | claude-haiku-4-5 | Short output, simple task |
| Recipe title translation | claude-haiku-4-5 | Title-only, all 4 languages in one call (~$0.0002/recipe) |
| Recipe full translation | claude-sonnet-4-6 | Quality matters for culinary terms (~$0.011/recipe/lang) |
| Recipe extraction (URL/scan) | claude-sonnet-4-6 | Complex structured extraction |
| AI meal plan generation | claude-sonnet-4-6 | Complex multi-step generation |
| Dish recipe generation | claude-sonnet-4-6 | Creative generation |
| Speak a Recipe formatting | claude-sonnet-4-6 | Structured extraction |
| Purchase unit suggestions | claude-haiku-4-5 | Simple lookup/suggestion |
| isActuallyARecipe verdict | claude-haiku-4-5 | Simple 3-way classification after completeness gate |
| Sous Chef suggest (incomplete recipes) | claude-haiku-4-5 | Structured gap-fill, user-reviewed before save (~$0.0003–$0.0006/call) |
| Template generation (admin) | claude-sonnet-4-6 | Code generation requires full Sonnet capability. Admin-only, rate limited to 5/day/admin. ~6000-8000 tokens/generation (~$0.10-$0.15/call) |
| Instagram food classify | claude-haiku-4-5 | Vision, binary YES/NO classification (~$0.001/image). Safe default false on error. |
| Instagram caption extract | claude-haiku-4-5 | Text only, structured JSON (~$0.0002/call). Always stores full caption in notes. |
| Instagram recipe complete | claude-sonnet-4-6 | Vision + structured JSON (~$0.015/recipe). Generates ingredients, steps, description from image + caption. Runs after Instagram export save. |
| Ask Sous Chef (personal versions) | claude-sonnet-4-6 | Structured recipe regeneration (~$0.003–$0.008/call). Takes user feedback + base recipe, returns corrected version. Chef+ plan required. |

**Never use Opus** for any automated background task. Opus is for one-off complex
reasoning that a human initiates and waits for.

---

## CACHING RULES — mandatory

### Recipe translations (recipe_translations table)
- Check cache FIRST before calling translateRecipe()
- Cache is shared across ALL users (one row per recipe+language)
- Invalidate only when ingredients or steps change
- Never translate to English (source language)
- Never re-translate if cache row exists and recipe hasn't changed

### Moderation results
- Store moderation verdict on the record itself (moderation_status column)
- Never re-moderate a comment/recipe that already has a verdict
- Only moderate NEW content or EDITED content

### Auto-tags
- Once tags are saved, never re-generate unless user explicitly requests
- The "Auto-tag" button is user-initiated — that's fine
- Never auto-tag on every save

### Dish identification
- Cache the identified dish name on the scan result
- Don't re-identify if the user already confirmed the dish

### Import extraction
- Once a recipe is extracted and saved, never re-extract
- The "Re-import" button is user-initiated — that's fine

---

## PROMPT EFFICIENCY RULES

### Keep prompts short
Every token in the prompt costs money. Before writing any Claude prompt:
1. Is there any context that isn't needed for this specific task? Remove it.
2. Can the output format be simplified? Shorter JSON = lower cost.
3. Are you sending the full recipe when only the title is needed? Send only what's needed.

### Batch where possible
If multiple items need the same AI operation, batch them in one call:
```ts
// EXPENSIVE: 10 separate API calls
for (const recipe of recipes) {
  await autoTag(recipe);
}

// CHEAP: One API call with all recipes
await autoTagBatch(recipes); // returns tags for all at once
```

### Limit input size
- Recipe extraction: send max 25,000 chars (already implemented)
- Translation: send only the fields being translated, not the full recipe object
- Moderation: send only the text content, not metadata

---

## PRE-FLIGHT CHECKLIST — run before any session touching AI features

```
□ Does this feature make a Claude API call?
  → If yes: which model is being used? Can haiku replace sonnet for this task?

□ Is there a cache that should be checked first?
  → recipe_translations, moderation_status, existing tags, etc.
  → If cache exists and is valid: SKIP the API call entirely

□ Is this AI call triggered automatically (on load, on save, on every edit)?
  → Automatic calls must ALWAYS check cache first
  → User-initiated calls (button press) are more acceptable but still cache-check

□ What is the minimum context needed for this prompt?
  → Strip everything that isn't required for the task
  → Send only the fields the Claude prompt actually uses

□ Could this be batched with other pending AI work?
  → Group similar tasks into single API calls where possible

□ Is the output being cached after the call?
  → If not, add caching — never call the same prompt twice for the same input
```

---

## POST-FLIGHT CHECKLIST

```
□ Every new AI call uses the cheapest appropriate model (see guide above)
□ Every AI call checks cache before executing
□ Results are stored in DB after every successful AI call
□ No AI calls happen on page load without cache check
□ No AI calls happen on every keystroke or every save without debouncing
□ Prompt length reviewed — is any context unnecessary?
```

---

## KNOWN COST PROBLEMS — already fixed or to fix

| Problem | Status | Solution |
|---------|--------|---------|
| recipe_translations per-user | Fixed in session 55 | Shared across all users |
| translateRecipe() called on every view | Fixed in session 12 | Cached in DB |
| Comment moderation using sonnet | Should be haiku | Switch model |
| Recipe moderation using sonnet | Should be haiku | Switch model |
| Username check using sonnet | Should be haiku | Switch model |
| Auto-tagging on every save | Not implemented | Only on user request |
| Purchase unit suggestions | Check model used | Should be haiku |

---

## COST ESTIMATION GUIDE

Rough cost per 1,000 calls at current Anthropic pricing:

| Model | Input (per 1M tokens) | Output (per 1M tokens) |
|-------|--------------------|---------------------|
| Haiku | ~$0.80 | ~$4.00 |
| Sonnet | ~$3.00 | ~$15.00 |
| Opus | ~$15.00 | ~$75.00 |

A typical comment moderation call: ~200 tokens in, ~50 tokens out
- With Haiku: ~$0.00016 per call → $0.16 per 1,000 comments
- With Sonnet: ~$0.00075 per call → $0.75 per 1,000 comments

A typical recipe translation: ~800 tokens in, ~600 tokens out
- With Sonnet: ~$0.011 per recipe per language → $11 per 1,000 translations
- Shared cache means each recipe costs this ONCE EVER, not per user

---

## BULK AUDIT COSTS (Content Health Audit)

The admin Content Health Audit uses bulk moderation functions that process
many items per API call. This is 70-80% cheaper than per-item moderation.

| Content Type | Batch Size | Cost/Batch | Effective Cost/Item |
|--------------|------------|------------|---------------------|
| Tags | 100 | ~$0.003 | ~$0.00003 |
| Recipes | 20 | ~$0.004 | ~$0.0002 |
| Comments | 50 | ~$0.002 | ~$0.00004 |
| Profiles | 50 | ~$0.002 | ~$0.00004 |
| Cookbooks | 50 | ~$0.002 | ~$0.00004 |

**Example: Full platform scan (200 tags, 100 recipes, 50 comments, 20 profiles)**
- Bulk approach: ~$0.03 total (9 API calls, ~20 seconds)
- Per-item approach: ~$0.11 total (370 API calls, ~9 minutes)
- **Savings: 73% cost, 97% fewer calls, 27x faster**

The bulk functions (`bulkModerateTags`, `bulkModerateRecipes`, etc.) are
ONLY used by the admin audit tool. Real-time moderation on save still uses
per-item functions (`moderateTag`, `moderateRecipe`, etc.) for immediate
feedback.
