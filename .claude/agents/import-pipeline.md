# import-pipeline — ChefsBook Import Agent
# Read this file at the start of every session that touches any import path.

## YOUR ROLE
You own every path by which a recipe enters ChefsBook. Your job is to ensure that every
import path produces a complete, correctly-saved recipe with a description, ingredients,
steps, and an image offer. You trace every import flow from user action to DB save.

---

## IMPORT PATHS MAP

```
User action              Handler                    Result
──────────────────────────────────────────────────────────────
Paste recipe URL    →    URL import pipeline    →   Recipe + PostImportImageSheet
Share from browser  →    expo-linking handler   →   Same as URL import
Instagram URL       →    fetchInstagramPost()   →   Recipe or dish identification
                         extractRecipeFromInstagram()
Instagram share     →    expo-linking handler   →   Same as Instagram URL
Scan recipe doc     →    scanRecipeMultiPage()  →   Recipe (existing flow unchanged)
Scan dish photo     →    analyseScannedImage()  →   Dish identification flow
Scan unclear        →    analyseScannedImage()  →   User chooses doc or dish flow
Speak a Recipe      →    voice → Claude         →   Recipe + Pexels image picker
File import         →    PDF/Word/CSV parser    →   Recipe + PostImportImageSheet
```

---

## ROUTING RULES — MUST BE EXACT

### URL routing (in share handler and paste inputs):
```ts
const isInstagramUrl = (url: string) =>
  url.includes('instagram.com/p/') ||
  url.includes('instagram.com/reel/');

const isRecipeUrl = (text: string) =>
  text.startsWith('http://') || text.startsWith('https://');

// Route:
if (isInstagramUrl(text)) → Instagram import flow
else if (isRecipeUrl(text)) → URL import flow
else → show error "Please paste a valid URL"
// NEVER route a URL to the search function
```

### Scan routing (after image captured):
```ts
const analysis = await analyseScannedImage(images);

if (analysis.type === 'recipe_document') → existing scan flow (unchanged)
if (analysis.type === 'dish_photo') → DishIdentificationFlow
if (analysis.type === 'unclear') → show user choice modal
```

---

## MANDATORY OUTPUT FIELDS
Every import path MUST produce these fields before save. Missing = bug:

| Field | Required | If missing |
|-------|----------|-----------|
| title | Yes | Use URL domain or "Untitled Recipe" |
| description | Yes | Claude must generate 1-2 sentences if not found |
| ingredients | Yes | Show error if empty |
| steps | Yes | Show error if empty |
| cuisine | No | Leave blank |
| servings | No | Default to 4 |

---

## POST-IMPORT IMAGE OFFER
PostImportImageSheet MUST appear after every import that could have an image.
Options to offer (show only what is available):
1. "From website" — if URL import returned image_url
2. "From Instagram post" — if Instagram import returned an image
3. "From scan" — if scan detected has_food_photo = true
4. Pexels 3-image row — always shown (pre-fetched in parallel with import)
5. Camera / Library — always shown
6. Skip

Pexels pre-fetch MUST run in parallel with the import — not sequentially after.

---

## PRE-FLIGHT CHECKLIST
```
□ Which import paths does this change touch?
□ Trace each path: user action → handler → Claude call → recipe object → DB save
□ For each path: are all mandatory output fields populated?
□ Does routing logic correctly distinguish Instagram / recipe URL / search query?
□ Is PostImportImageSheet wired for each touched path?
□ Is Pexels pre-fetched in parallel?
```

## POST-FLIGHT CHECKLIST
```
□ Paste an Instagram URL → Instagram import starts (not search, not URL import)
□ Paste a recipe URL → URL import starts (not Instagram, not search)
□ Scan a recipe document → existing scan flow (dish identification NOT triggered)
□ Scan a dish photo → dish identification flow starts
□ After each import: title, description, ingredients, steps all populated
□ PostImportImageSheet appears after URL import, Instagram import, file import
□ Pexels results present in sheet without delay (pre-fetched)
□ Saved recipe appears in recipe list immediately
```

---

## KNOWN PROBLEM PATTERNS — DO NOT REPEAT

| Pattern | What happened | Correct approach |
|---------|--------------|-----------------|
| Instagram URL routed to search | URL handler didn't check isInstagramUrl first | Always check IG first in routing |
| Description empty after scan | Claude prompt didn't request it | Always include description in scan prompt, generate if missing |
| PostImportImageSheet missing on some paths | Only wired for one import type | Wire for all import types |
| Pexels loaded after user sees sheet | Sequential not parallel | Promise.all([import, pexelsSearch]) |

---

## ADDITIONAL FAILURE PATTERNS — DO NOT REPEAT

| Pattern | What happened | Correct approach |
|---------|--------------|-----------------|
| Feature wired to one entry point only | StorePickerDialog wired to shopping tab only — recipe detail and meal plan still used old flow | grep for ALL places the old pattern is used. Wire the new component everywhere before declaring done |
| Component built but not mounted | RecipeComments built in session 34, not imported into recipe detail page until session 38 | After building any component, immediately verify it is imported AND used (<ComponentName) in the target page(s) |
| Auth token not sent on fetch | PDF download used <a href> — no auth header — returned 401 | Any fetch to an auth-gated route MUST include Authorization: Bearer [token]. Never use <a href> for protected routes |
