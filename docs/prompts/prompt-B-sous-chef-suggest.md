# Prompt B — Sous Chef Suggest: Fill Missing Recipe Data
## Scope: Web only (apps/web). Mobile carry-forward to a future session.

---

## AGENTS TO READ FIRST (in order)
1. `.claude/agents/wrapup.md`
2. `CLAUDE.md`
3. `DONE.md`
4. `.claude/agents/testing.md`
5. `.claude/agents/feature-registry.md`
6. `.claude/agents/deployment.md`
7. `.claude/agents/ui-guardian.md`
8. `.claude/agents/ai-cost.md` — MANDATORY (new AI call being added)
9. `.claude/agents/import-pipeline.md` (touches recipe completeness gate)

Run ALL pre-flight checklists before writing a single line of code.
Inspect the `recipes` table schema before writing any queries: `\d recipes`

---

## CONTEXT

The recipe detail page shows a warning banner when a recipe is missing required fields
(currently: minimum 2 ingredients). The banner already has two action buttons:
- "Refresh from source" — re-fetches the original URL
- "Paste ingredients" — manual entry

We are adding a third option: **"✨ Sous Chef"** — an AI-assisted fill that uses everything
already known about the recipe plus a fresh source re-fetch attempt to intelligently suggest
only what is missing, while preserving what already exists.

The Sous Chef rename from Prompt A is assumed to be complete before this prompt runs.

---

## FEATURE SPEC

### 1. New pill button in the warning banner

Add a third pill button to the existing missing-data warning banner:

```
⚠️  This recipe is missing ingredients (minimum 2)
    We can re-fetch it from the original source and fill in the gaps...

    [🔄 Refresh from source]  [📋 Paste ingredients]  [✨ Sous Chef]
```

Button label: `✨ Sous Chef`
Style: Match the existing pill button style in the banner. Use the Trattoria pomodoro red
(`#ce2b37`) as the accent, consistent with the "Refresh from source" button.

---

### 2. Loading state

When the user clicks "✨ Sous Chef":
1. Disable all three banner buttons immediately.
2. Replace the banner body text with:
   **"Your Sous Chef is preparing this recipe…"**
   with a spinner. Keep the banner visible and in-place — do not navigate away.
3. Do not show a modal yet. The modal opens only after the AI response is ready.

---

### 3. Backend: new API route

Create `apps/web/app/api/recipes/[id]/sous-chef-suggest/route.ts`

**Method**: POST  
**Auth**: Required (user must own the recipe)  
**Request body**: `{}` (empty — the route fetches everything it needs server-side)

**Logic (in order)**:

#### Step A — Load existing recipe data
Fetch the full recipe from Supabase using the service role client:
- `title`, `description`, `source_url`, `ingredients` (array), `steps` (array), `tags`,
  `cuisine`, `cook_time`, `prep_time`, `servings`

#### Step B — Attempt source re-fetch (best-effort, 8 second timeout)
If `source_url` is set:
- Make a GET request to `source_url` with a 8-second timeout using `AbortController`.
- If successful: extract up to 15,000 chars of text content from the response body.
  Strip HTML tags. This is the `sourceScrape` context.
- If it times out or errors: set `sourceScrape = null` and continue. Do NOT fail the request.

#### Step C — Build the Haiku prompt

Use `callClaude()` with `model: HAIKU` (not Sonnet — this is a structured fill task).

System prompt:
```
You are a culinary assistant. Your job is to complete a recipe that has incomplete data.
You have been given everything that is already known about the recipe.
Your task is to suggest ONLY what is missing — do not replace or re-state what already exists.
Maintain strict fidelity to THIS specific recipe. Do not invent a different recipe.
Use the recipe title, description, cuisine, and any scraped source content as your primary signals.
Respond ONLY with a valid JSON object — no markdown, no preamble, no explanation.
```

User prompt (build dynamically, include only fields that exist):
```
Recipe title: {title}
Description: {description}
Cuisine: {cuisine}
Tags: {tags joined by comma}
Cook time: {cook_time} min
Prep time: {prep_time} min
Servings: {servings}

Existing ingredients ({count} found, minimum 2 required):
{ingredients as JSON array, or "none" if empty}

Existing steps ({count} found):
{steps as JSON array, or "none" if empty}

{if sourceScrape} Source page content (scraped):
{sourceScrape, truncated to 12000 chars}
{end if}

What is MISSING from this recipe to make it complete and accurate?
Respond with a JSON object containing only the fields that need to be filled in.
Only include a field if it is genuinely missing or insufficient.
Schema:
{
  "ingredients": [   // only if fewer than 2 exist, or clearly incomplete given the title/source
    { "amount": "2", "unit": "cups", "name": "all-purpose flour", "notes": "" }
  ],
  "steps": [         // only if 0 steps exist
    { "order": 1, "instruction": "Mix the dry ingredients together." }
  ]
}
If ingredients already look complete, omit the "ingredients" key entirely.
If steps already exist, omit the "steps" key entirely.
```

**Max tokens**: 2000  
**Log the AI call** via `logAiCall` — action: `sous_chef_suggest`, model: `haiku`

#### Step D — Parse and return

Parse the JSON response. Return HTTP 200 with:
```json
{
  "suggestions": {
    "ingredients": [...],   // present only if AI suggested ingredients
    "steps": [...]          // present only if AI suggested steps
  },
  "hadSourceScrape": true/false
}
```

On any error (AI failure, parse error): return HTTP 500 with `{ "error": "..." }`.
The client will show a toast and re-enable the banner buttons.

---

### 4. Frontend: Review modal

When the API returns successfully, open a modal/drawer titled:
**"Your Sous Chef's Suggestions"**

#### Modal header
- Title: `Your Sous Chef's Suggestions`
- Subtitle (top-level disclaimer):
  > "Your Sous Chef has suggested the following based on the recipe title, description, and source.
  > Please review carefully before saving — you know this recipe better than anyone."
- If `hadSourceScrape === false`, add a secondary note:
  > "The original source couldn't be reached, so these are based on the recipe details only."

#### Modal body — Ingredients section (only if suggestions.ingredients exists)

Show a section header: **"Ingredients"**

Each ingredient row:
- Amount field (text input, small)
- Unit field (text input or select, small)
- Name field (text input, larger)
- Notes field (text input, optional)
- Delete button (×) on the right

Below the list: an **"+ Add ingredient"** button that appends a blank row.

Users can edit any field, delete rows, or add rows before saving.

#### Modal body — Steps section (only if suggestions.steps exists)

Show a section header: **"Steps"**

Each step row:
- Step number (auto-incrementing, not editable)
- Instruction text area (full width, 2 rows min)
- Delete button (×) on the right

Below the list: an **"+ Add step"** button that appends a blank row.

#### Modal footer

Two buttons:
- **"Save to recipe"** (primary, pomodoro red) — saves and closes modal
- **"Cancel"** (secondary, ghost) — discards suggestions, re-enables banner buttons

---

### 5. Save logic

On "Save to recipe":
1. Merge suggestions into existing recipe data:
   - **Ingredients**: if recipe already has some ingredients, APPEND the suggested ones.
     Do not replace. (User may delete suggested ones they don't want in the modal before saving.)
   - **Steps**: if recipe already has steps, do NOT overwrite. Only save if 0 steps existed.
     (The modal will only show steps if none existed, per the AI prompt spec above.)
2. Call the existing recipe update endpoint/mutation used elsewhere in the app.
3. On success: close modal, dismiss the warning banner, show success toast:
   **"Recipe updated by your Sous Chef ✨"**
4. Re-evaluate completeness gate:
   - If the recipe now has ≥2 ingredients with quantities AND ≥1 step AND is currently private:
     Show a follow-up dialog (use `ChefsDialog`) with:
     - Message: **"Your recipe is ready to share with the Chefsbook community. Would you like to publish it?"**
     - Two pill buttons: **"Yes, publish it"** (primary) and **"Keep it private"** (secondary/ghost)
     - "Yes, publish it" sets `visibility = 'public'` and shows toast: **"Your recipe is now public 🎉"**
     - "Keep it private" dismisses with no action
   - If the recipe does not meet completeness gate, or is already public: skip this dialog entirely.

---

## COMPLETENESS GATE DEFINITION

For the purposes of this feature, "meets completeness gate" means:
- `ingredients.length >= 2` AND at least one ingredient has a non-empty `amount`
- `steps.length >= 1`
- `title` is not null/empty
- `description` is not null/empty

Check this using existing gate logic if it already exists in the codebase. Do not duplicate it.

---

## AI COST

- Model: **Haiku** (not Sonnet)
- Estimated cost per call: ~$0.0003–$0.0006 (small context, structured output)
- Log via `logAiCall` — action name: `sous_chef_suggest`
- Update `.claude/agents/ai-cost.md` with the new row

---

## IMPLEMENTATION ORDER

1. Create the API route `sous-chef-suggest/route.ts`
2. Write the Haiku prompt and test it standalone (curl the route with a known incomplete recipe)
3. Add the "✨ Sous Chef" pill button to the warning banner component
4. Implement the loading state
5. Build the review modal (ingredients editor + steps editor)
6. Wire up save logic and ChefsDialog publish prompt
7. Update `ai-cost.md`
8. Update `feature-registry.md`
9. TypeScript check: `cd apps/web && npx tsc --noEmit` — must be clean
10. Deploy per `deployment.md`

---

## GUARDRAILS

- Do NOT replace existing ingredients — only append.
- Do NOT replace existing steps — only add if none exist.
- The AI must never be called without the recipe title in the prompt context.
- Source re-fetch failure MUST be silent — never surface to the user as an error.
- The review modal is NOT optional — never auto-save AI suggestions without user review.
- Use `ChefsDialog` for the publish prompt — do not use native browser confirm/alert.
- Use the service role client for the recipe fetch in the API route (RLS will block otherwise).
- Keep the API route server-side only. The Anthropic API key must never reach the browser.
- Do NOT add this feature to mobile in this session. Mobile is a future prompt.

---

## TESTING REQUIREMENTS

Before marking done, verify with curl/browser:

1. `POST /api/recipes/{id}/sous-chef-suggest` on a recipe with 0 ingredients returns
   a valid suggestions JSON with at least 2 ingredients.
2. `POST /api/recipes/{id}/sous-chef-suggest` on a recipe with 2+ existing ingredients
   returns `{}` or omits the `ingredients` key (AI correctly sees no gap).
3. The review modal opens after the API returns — editable fields work (edit, delete, add row).
4. Saving merges ingredients correctly — existing ones are not deleted.
5. The publish ChefsDialog appears after saving when recipe was private and now meets the gate.
6. Source re-fetch timeout (test with a dead URL) does not crash the route — falls back gracefully.

Provide curl output or browser console screenshots as proof.

---

## WRAPUP REQUIREMENT

DONE.md entry must include:
- New route file path
- Haiku prompt text used (full, as shipped)
- curl proof of the two API test cases above
- Screenshot or description of the review modal in the browser
- ai-cost.md updated row confirmed
- tsc clean confirmed
- Deploy confirmed (chefsbk.app recipe detail with incomplete recipe shows the new button)
