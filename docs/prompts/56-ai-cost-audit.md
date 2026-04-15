# ChefsBook — Session 56: Full AI Cost Audit + Optimisation
# Purpose: Audit every Claude API call in the codebase and optimise for cost
# Target: @chefsbook/ai + all callers in apps/mobile + apps/web

---

## CONTEXT

Every Claude API call costs money. This session audits the entire codebase,
identifies every AI call, and optimises each one for cost without sacrificing
quality.

Read .claude/agents/ai-cost.md, .claude/agents/testing.md, and
.claude/agents/deployment.md before starting.

---

## STEP 1 — Full audit: find every Claude API call

```bash
# Find every file in @chefsbook/ai that calls the Anthropic API:
grep -rn "anthropic\|claude\|callClaude\|fetch.*api.anthropic" \
  packages/ai/src --include="*.ts" -l

# Find every function exported from @chefsbook/ai:
grep -rn "^export async function\|^export function" \
  packages/ai/src --include="*.ts"

# Find every place @chefsbook/ai functions are called from:
grep -rn "from '@chefsbook/ai'\|from \"@chefsbook/ai\"" \
  apps/mobile apps/web --include="*.ts" --include="*.tsx" -l
```

Build a complete table in DONE.md:

| Function | Model used | Called from | Cached? | Trigger |
|----------|-----------|-------------|---------|---------|
| translateRecipe() | sonnet | recipe detail | ✅ DB | auto on view |
| moderateComment() | ? | postComment | ❌ | every post |
| moderateRecipe() | ? | addRecipe/editRecipe | ❌ | every save |
| autoTag() | ? | TagManager | ❌ | user button |
| ... | ... | ... | ... | ... |

Fill in the actual model for each function by reading the source.

---

## STEP 2 — Switch moderation functions to Haiku

Comment moderation, recipe moderation, and username checking are all simple
classification tasks. They do not need Sonnet.

In `@chefsbook/ai`, update these functions to use `claude-haiku-4-5`:

```ts
// moderateComment.ts, moderateRecipe.ts, isUsernameFamilyFriendly.ts:
model: 'claude-haiku-4-5-20251001'  // cheapest model, fine for classification
```

Haiku is ~4x cheaper than Sonnet for input and ~4x cheaper for output.
Classification quality is equivalent for simple clean/mild/serious verdicts.

---

## STEP 3 — Switch auto-tagging to Haiku

Auto-tagging generates 5-8 short tags from a recipe. This is a simple
extraction task, not creative generation. Switch to Haiku:

```ts
// autoTag.ts or wherever tag generation lives:
model: 'claude-haiku-4-5-20251001'
```

---

## STEP 4 — Switch purchase unit suggestions to Haiku

Suggesting purchase units (e.g. "2 cups flour" → "1 bag (5lb)") is a simple
lookup/suggestion task. Switch to Haiku.

---

## STEP 5 — Add caching to moderation results

Currently every comment and recipe is moderated on each save with no caching.
For recipes specifically, avoid re-moderating content that hasn't changed:

```ts
// In moderateRecipe() caller (recipeStore / web recipe save):
// Only moderate if title, description, ingredients, or steps changed:
const contentChanged = (
  newRecipe.title !== existingRecipe.title ||
  newRecipe.description !== existingRecipe.description ||
  JSON.stringify(newRecipe.ingredients) !== JSON.stringify(existingRecipe.ingredients) ||
  JSON.stringify(newRecipe.steps) !== JSON.stringify(existingRecipe.steps)
);

if (!contentChanged && existingRecipe.moderation_status === 'clean') {
  // Skip moderation — content unchanged and previously clean
  return;
}
```

For comments: every new comment must be moderated (no caching possible since
each comment is new content). But ensure moderation only runs ONCE per comment,
not on every render or re-fetch.

---

## STEP 6 — Optimise prompt lengths

For each function, strip unnecessary context from the prompts:

**moderateComment():** The prompt only needs the comment text. Remove any
recipe context or user context that may have been added.

**moderateRecipe():** Send only the fields being checked (title, description,
first 3 ingredients, first 3 steps). Full recipe content is not needed for
moderation — a pattern match on key fields is sufficient.
```ts
// Instead of full recipe:
content: `Title: ${recipe.title}\nDescription: ${recipe.description?.slice(0, 200)}\nIngredients sample: ${recipe.ingredients?.slice(0, 5).map(i => i.name).join(', ')}`
```

**translateRecipe():** Send only the fields being translated. Do not send
`cuisine`, `course`, `tags`, `user_id`, `created_at` etc.

**autoTag():** Send only title, cuisine, and ingredient names. Steps are
not needed for tag generation.

---

## STEP 7 — Add max_tokens limits

Every API call should have an explicit `max_tokens` limit to prevent
runaway responses:

| Function | Suggested max_tokens |
|----------|---------------------|
| moderateComment() | 100 |
| moderateRecipe() | 150 |
| isUsernameFamilyFriendly() | 50 |
| autoTag() | 200 |
| translateRecipe() | 2000 |
| extractRecipeFromUrl() | 3000 |
| generateMealPlan() | 2000 |
| analyseScannedImage() | 300 |
| generateDishRecipe() | 3000 |

---

## STEP 8 — Dish identification: cache the result

When a user scans an image and Claude identifies the dish, cache the result
on the scan session so if the user changes their mind and comes back, Claude
isn't called again.

This is already partially handled by the flow design — just ensure no repeat
calls happen within the same scan session.

---

## STEP 9 — Document the optimised cost table

After all optimisations, update CLAUDE.md with a cost reference:

```markdown
## AI COST REFERENCE

| Function | Model | Est. cost/call | Cached? |
|----------|-------|---------------|---------|
| moderateComment() | haiku | ~$0.00016 | No (new content each time) |
| moderateRecipe() | haiku | ~$0.00020 | Yes (skip if content unchanged) |
| isUsernameFamilyFriendly() | haiku | ~$0.00008 | No (one-time at signup) |
| autoTag() | haiku | ~$0.00020 | Yes (user-initiated only) |
| translateRecipe() | sonnet | ~$0.011 | Yes (shared, one-time per recipe per lang) |
| extractRecipeFromUrl() | sonnet | ~$0.015 | Yes (one-time per import) |
| generateMealPlan() | sonnet | ~$0.020 | No (user-initiated) |
| analyseScannedImage() | haiku | ~$0.00030 | No (each scan is new) |
```

---

## TESTING

After all model switches:
1. Test comment moderation — post a clean comment, a mild comment, a serious comment
2. Test recipe moderation — import a recipe with and without violations
3. Test auto-tagging — confirm tags still generate correctly with Haiku
4. Test recipe translation — confirm French translation still works correctly
5. Confirm no regressions in any AI feature

```bash
# Verify moderation functions use haiku:
grep -n "claude-haiku\|claude-sonnet\|claude-opus" packages/ai/src/*.ts
```

Every moderation/classification function must show haiku.
Translation and generation functions should show sonnet.

---

## DEPLOYMENT

```bash
ssh rasp@rpi5-eth
cd /mnt/chefsbook/repo
git pull
cd apps/web
npm run build 2>&1 | tail -20
pm2 restart chefsbook-web
```

---

## COMPLETION CHECKLIST

- [ ] Full audit table in DONE.md — every AI function, model, trigger, cache status
- [ ] moderateComment() switched to haiku
- [ ] moderateRecipe() switched to haiku
- [ ] isUsernameFamilyFriendly() switched to haiku
- [ ] autoTag() switched to haiku
- [ ] Purchase unit suggestions switched to haiku
- [ ] Recipe moderation skipped when content unchanged
- [ ] Prompt lengths trimmed — no unnecessary context sent
- [ ] max_tokens added to every API call
- [ ] Translation still works correctly with shared cache
- [ ] All AI features tested and working after model switches
- [ ] Cost reference table added to CLAUDE.md
- [ ] Deployed to RPi5 and verified live
- [ ] Run /wrapup to update DONE.md and CLAUDE.md
