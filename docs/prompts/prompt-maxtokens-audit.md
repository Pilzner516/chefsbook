# Prompt: maxTokens Audit for callClaude() Callers
# Launch: Read docs/prompts/prompt-maxtokens-audit.md and execute it fully.

## OBJECTIVE
Audit every `callClaude()` call in `packages/ai/src/` and web/mobile API routes
for appropriate `maxTokens` values. Several heavy functions are currently under-provisioned
which causes silent truncation — the JSON gets cut off mid-structure, `jsonrepair` catches
some cases but not all.

## PRE-FLIGHT
1. Read `.claude/agents/ai-cost.md` — MANDATORY (contains the model selection guide and cost table)
2. Read `.claude/agents/feature-registry.md`
3. Read `.claude/agents/testing.md`
4. Read `.claude/agents/deployment.md`

## STEP 1 — INVENTORY
Find every `callClaude()` call across the codebase:
```bash
grep -rn "callClaude(" packages/ai apps/web apps/mobile --include="*.ts" --include="*.tsx" | grep -v "node_modules"
```

For each call, record:
- File + line number
- Current `maxTokens` value (or if omitted — what is the default?)
- What the function does (brief description)
- What the output structure looks like (simple string vs large JSON)

List this inventory before making any changes.

## STEP 2 — AUDIT THESE SPECIFICALLY (known risks)

These four were flagged after the browser extension truncation incident:

| Function | Expected output | Minimum safe maxTokens |
|----------|----------------|----------------------|
| `cookbookTOC` | Full table of contents — could be 50+ recipes | 4000 |
| `scanRecipeMultiPage` | Multi-page recipe with all ingredients + steps | 6000 |
| `generateMealPlan` | Full week plan — 7 days × 3 meals with recipe details | 6000 |
| `generateDishRecipe` | Complete recipe JSON with all fields | 4000 |

For each: read the actual prompt being sent, estimate the realistic output size,
and set `maxTokens` to the appropriate value.

## STEP 3 — AUDIT ALL OTHER CALLERS
For every other `callClaude()` call found in Step 1:
- If it returns a short string or classification → 1000–2000 is fine
- If it returns structured JSON with arrays (ingredients, steps, tags) → minimum 3000
- If it returns a complete recipe or large document → minimum 4000–6000

Flag any that look under-provisioned and fix them.

## STEP 4 — VERIFY ERROR HANDLING
For any caller that returns JSON, verify:
1. Is the response parsed with try/catch?
2. Is `jsonrepair` applied before `JSON.parse`?
3. Is there a `ClaudeTruncatedError` guard (check for `stop_reason === 'max_tokens'`)?

If any heavy JSON caller is missing these guards, add them.
Pattern to follow: see how the browser extension import route was fixed (raised to 6000,
added `jsonrepair`, added `ClaudeTruncatedError`/`ClaudeJsonParseError`).

## GUARDRAILS
- Never reduce a `maxTokens` value — only raise or leave unchanged
- Do not change model selection (Haiku vs Sonnet) — that is a separate decision
- Do not change prompt content — only token limits and error handling
- Update `ai-cost.md` if any cost estimates change materially

## VERIFICATION
1. `cd packages/ai && npx tsc --noEmit` — clean
2. `cd apps/web && npx tsc --noEmit` — clean
3. Test `generateMealPlan` with a real call and verify the output is complete (not truncated)
4. Test `cookbookTOC` on a cookbook with 10+ recipes and verify all entries appear

## DEPLOYMENT
Deploy per `deployment.md` after TypeScript is clean.

## WRAPUP REQUIREMENT
DONE.md entry must include:
- Full inventory table of every callClaude() caller with old vs new maxTokens
- Which callers had jsonrepair/error handling added
- tsc clean for both packages/ai and apps/web
- Deploy confirmed
