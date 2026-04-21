# Prompt B-FIX — Sous Chef Suggest: Wrong field suggested
## Scope: apps/web/app/api/recipes/[id]/sous-chef-suggest/route.ts only

---

## AGENTS TO READ FIRST
1. `.claude/agents/wrapup.md`
2. `CLAUDE.md`
3. `DONE.md`
4. `.claude/agents/testing.md`
5. `.claude/agents/deployment.md`
6. `.claude/agents/ai-cost.md`

---

## BUG

The route currently asks Haiku: "What is MISSING from this recipe?"
Haiku gets it wrong — it suggested steps when ingredients were missing.

Relying on AI judgment to determine what is missing is the bug.
The route already has all the data it needs to determine this deterministically before
calling the AI.

---

## FIX

### Step A — Determine what is missing SERVER-SIDE before calling Haiku

After loading the recipe from Supabase, compute the gaps explicitly:

```typescript
const needsIngredients = !ingredients || ingredients.length < 2;
const needsSteps = !steps || steps.length === 0;

if (!needsIngredients && !needsSteps) {
  return NextResponse.json({ suggestions: {} });
}
```

### Step B — Tell Haiku exactly what to generate

Replace the open-ended "What is MISSING?" instruction with an explicit directive
built from the server-side gap check:

```typescript
const tasks: string[] = [];

if (needsIngredients) {
  tasks.push(
    `Generate a complete and accurate ingredients list for this recipe. ` +
    `Include ALL ingredients needed — do not stop at 2. ` +
    `Return them under the "ingredients" key.`
  );
}

if (needsSteps) {
  tasks.push(
    `Generate complete step-by-step instructions for this recipe. ` +
    `Return them under the "steps" key.`
  );
}
```

Inject `tasks.join('\n')` into the user prompt in place of the open-ended question.

Also update the JSON schema instruction at the end of the prompt to only show the
relevant key(s). If only ingredients are needed, only show the ingredients schema.
If only steps are needed, only show the steps schema. This removes ambiguity entirely.

### Step C — Strip the unwanted key from the response

Even with the explicit prompt, add a post-processing guard:

```typescript
if (!needsIngredients) delete suggestions.ingredients;
if (!needsSteps) delete suggestions.steps;
```

This ensures the modal never shows a field that wasn't actually missing,
regardless of what the AI returns.

---

## TESTING REQUIREMENTS

Before marking done, verify with two curl calls:

1. Recipe with 0 ingredients, 1+ steps:
   - Response must contain `ingredients` key
   - Response must NOT contain `steps` key

2. Recipe with 2+ ingredients, 0 steps:
   - Response must contain `steps` key
   - Response must NOT contain `ingredients` key

Provide curl output as proof of both cases.

---

## WRAPUP REQUIREMENT

DONE.md entry must include:
- The old prompt text (what was removed)
- The new prompt text (what replaced it)
- Curl proof of both test cases above
- tsc clean confirmed
- Deploy confirmed
