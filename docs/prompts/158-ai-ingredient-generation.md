# ChefsBook — Session 158: AI Ingredient Generation for Incomplete Recipes
# Source: Refresh from source fails for JS-rendered sites, no fallback offered
# Target: packages/ai + apps/web + apps/mobile

---

## CONTEXT

Read CLAUDE.md, DONE.md, feature-registry.md, import-pipeline.md,
and import-quality.md before touching anything.

Problem: Some sites (halfbakedharvest.com and similar) use JavaScript
to render their ingredient lists. Server-side fetch gets the title,
description and steps but ingredients are empty. The extension PDF
capture works but only when the user is actively on the page.

"Refresh from source" re-runs the server import — same failure.

Solution: When a recipe is missing ingredients after a refresh attempt,
offer to generate them using AI based on all available information
(title, description, steps, and general culinary knowledge).

---

## PART 1 — generateMissingIngredients() in packages/ai

```typescript
// Uses SONNET — ~$0.003 per call (high quality needed for accuracy)
export async function generateMissingIngredients(recipe: {
  title: string
  description?: string
  steps: string[]
  servings?: number
  cuisine?: string
  tags?: string[]
}): Promise<RecipeIngredient[]>
```

Prompt:
```
You are an expert chef. Generate a complete, accurate ingredient list
for this recipe based on all available information.

Recipe: "${recipe.title}"
${recipe.cuisine ? `Cuisine: ${recipe.cuisine}` : ''}
${recipe.description ? `Description: ${recipe.description}` : ''}
Servings: ${recipe.servings ?? 4}

Steps (which reference the ingredients):
${recipe.steps.map((s, i) => `${i+1}. ${s}`).join('\n')}

Generate the complete ingredient list with exact quantities and units
as they would appear in the original recipe. Be precise — use standard
recipe measurements. Do not invent ingredients not referenced in the
steps or description.

Return ONLY valid JSON array:
[
  { "amount": 2, "unit": "cups", "name": "all-purpose flour" },
  { "amount": 1, "unit": "tsp", "name": "salt" },
  { "amount": null, "unit": null, "name": "fresh basil, for garnish" }
]
```

Add to ai-cost.md: generateMissingIngredients — SONNET — ~$0.003/call

---

## PART 1b — PDF fallback for ALL sites (not just hardcoded list)

### Current behaviour (wrong):
PDF fallback only triggers for domains in PDF_FALLBACK_SITES list
OR domains where rating ≤ 1 in import_site_tracker.

### Correct behaviour:
PDF fallback is the LAST RESORT for EVERY site when other methods fail.

The full waterfall for every import:
```
Step 1: Try JSON-LD extraction
  → Complete: done ✓
  → Incomplete: continue ↓

Step 2: Try Claude HTML extraction
  → Complete: done ✓
  → Incomplete or 403/429: continue ↓

Step 3: Signal needsBrowserExtraction (ALL sites, not just list)
  → Extension does PDF/HTML capture
  → Complete: done ✓
  → Still incomplete: offer AI generation ↓

Step 4: AI ingredient generation (user confirms)
```

Remove the domain whitelist check from PDF fallback trigger.
The trigger should be purely result-based:
- 403/429/460 → needsBrowserExtraction
- ingredients.length === 0 → needsBrowserExtraction
- steps.length === 0 → needsBrowserExtraction

Domain list only affects whether to SKIP server fetch entirely
(known-blocked sites go straight to Step 3). All other sites
still attempt Steps 1-2 first, then fall through to Step 3 if needed.

Update isIncompleteEnoughForPdfFallback() to be the single
decision point, applied universally after every import attempt.

### Verify halfbakedharvest.com now triggers correctly:

```bash
# Test fresh import
curl -X POST https://chefsbk.app/api/import/url   -H "Authorization: Bearer <token>"   -H "Content-Type: application/json"   -d '{"url":"https://www.halfbakedharvest.com/crispy-chicken-katsu-noodle-bowls/"}'   | jq '{needsBrowserExtraction, reason, ingredientCount: (.ingredients | length)}'
```

Expected: needsBrowserExtraction: true, reason: 'incomplete_extraction'

---

## PART 2 — Update "Refresh from source" flow

### 2a — Current flow (broken for JS sites):
```
Click "Refresh from source"
→ Re-run server import
→ If still incomplete: show same warning banner (no help)
```

### 2b — New flow (full waterfall on refresh):
```
Click "Refresh from source"
→ Step 1: Re-run server import (JSON-LD + Claude HTML)
→ If complete: success ✓
→ If incomplete: automatically signal needsBrowserExtraction
→ Step 2: If extension detected: silently trigger PDF/HTML capture
    → If complete: success ✓
    → If still incomplete: continue ↓
→ Step 3: Show options:
    "We couldn't retrieve the ingredients even with your browser.
    This site may require you to be logged in, or the content
    may not be machine-readable."

    [🤖 Generate with AI]   ← primary
    [✏️ Enter manually]
```

The extension PDF capture happens silently during refresh —
user just sees "Refreshing recipe..." spinner while both
server fetch AND extension capture are attempted.
If extension is not installed, skip Step 2 and go straight to Step 3.

The key difference from before: Refresh now runs the FULL waterfall
(server → extension PDF → AI offer) not just the server fetch.

### 2c — Wire generateMissingIngredients() to the AI button

When user clicks "Generate with AI":

1. Show loading: "Generating ingredients from recipe information..."
2. Call POST /api/recipes/[id]/generate-ingredients
3. Server calls generateMissingIngredients() with recipe data
4. Returns generated ingredient list
5. Show preview to user BEFORE saving:

```
Generated ingredients for Crispy Chicken Katsu Noodle Bowls:

• 2 lbs chicken breast, pounded thin
• 1 cup panko breadcrumbs
• 2 eggs, beaten
• 8 oz rice noodles
• 1 cup edamame, shelled
• ½ cup Japanese mayo
• 2 tbsp sriracha
... (full list)

[Save these ingredients]  [Edit before saving]  [Try again]
```

User confirms → ingredients saved → completeness re-checked →
if now complete + AI approval passes → recipe can be made public.

### 2d — New API route

Create apps/web/app/api/recipes/[id]/generate-ingredients/route.ts:

```typescript
export async function POST(req: NextRequest, { params }) {
  // Verify user owns this recipe
  // Get recipe data (title, description, steps, servings, cuisine, tags)
  // Call generateMissingIngredients()
  // Return generated ingredients for user preview
  // Do NOT save automatically — user must confirm
}
```

---

## PART 3 — Mobile: same flow

On mobile recipe detail, when is_complete = false due to missing
ingredients, show the same options in a ChefsDialog:

```
This recipe is missing ingredients.

[🤖 Generate with AI]
[✏️ Enter manually]
[📋 Open source in browser]
```

"Generate with AI" calls the same API endpoint.
Shows the generated list in a scrollable modal for review before saving.

---

## PART 4 — Apply to the specific broken recipe

After building the feature, immediately apply it to
"Crispy Chicken Katsu Noodle Bowls" — run generateMissingIngredients()
for this recipe directly via the API and save the result.

Verify:
- Ingredients generated and saved
- Completeness check passes
- Recipe can now be made public by the owner
- AI-generated ingredients are clearly derived from the steps

---

## PART 5 — Improve "Refresh from source" messaging

The current banner says:
"This recipe is missing ingredients (minimum 2)
We can re-fetch it from the original source and fill in the gaps
— your existing edits are preserved."

This is misleading — it implies re-fetch will always work.

Update the banner to be honest about JS-rendered sites:

After a failed refresh attempt, change the banner to:
```
⚠️ Ingredients couldn't be retrieved from this site

This site loads its content with JavaScript, which our
importer can't access directly.

[🤖 Generate with AI]    ← primary action
[✏️ Enter manually]
[🔌 Open in browser with extension]  ← if no extension
```

If the user has the extension installed, add:
"Or visit the original source with the ChefsBook extension active
and click 'Re-import' to capture the full page."

---

## DEPLOYMENT

```bash
ssh rasp@rpi5-eth
cd /mnt/chefsbook/repo
git pull
cd apps/web
rm -rf node_modules/react node_modules/react-dom .next
NODE_OPTIONS=--max-old-space-size=1536 npm run build 2>&1 | tail -20
pm2 restart chefsbook-web
```

---

## COMPLETION CHECKLIST

### Part 1 — AI generation
- [ ] generateMissingIngredients() in packages/ai using SONNET
- [ ] Prompt uses title + description + steps + servings + cuisine
- [ ] Returns structured ingredient array with amounts and units
- [ ] ai-cost.md updated

### Part 2 — Refresh from source improvements
- [ ] After failed refresh: show 3 options (AI / Manual / Extension)
- [ ] POST /api/recipes/[id]/generate-ingredients created
- [ ] Generated ingredients shown for preview before saving
- [ ] User can edit, save, or try again
- [ ] On save: re-runs completeness check + AI approval

### Part 3 — Mobile
- [ ] ChefsDialog with same 3 options on mobile
- [ ] Generates and shows preview before saving

### Part 4 — Fix specific recipe
- [ ] "Crispy Chicken Katsu Noodle Bowls" ingredients generated
- [ ] Ingredients saved and verified accurate
- [ ] Recipe completeness now passes

### Part 5 — Honest messaging
- [ ] Banner updated after failed refresh (no more false promise)
- [ ] Clear explanation of JS-rendered site limitation
- [ ] Extension path shown if available

### Universal PDF fallback (Part 1b)
- [ ] isIncompleteEnoughForPdfFallback() applied universally after every import
- [ ] Domain whitelist only used for skip-server-fetch optimization
- [ ] halfbakedharvest.com fresh import confirmed → needsBrowserExtraction: true
- [ ] Refresh from source runs full waterfall (server → PDF → AI offer)
- [ ] Extension capture triggered silently during refresh if extension present
- [ ] User sees single spinner throughout, no technical details exposed

### General
- [ ] feature-registry.md updated
- [ ] tsc --noEmit passes both apps
- [ ] Deployed to RPi5
- [ ] Run /wrapup
- [ ] At the end recap: which recipes had ingredients generated,
      quality of generated ingredients, what was left incomplete.
