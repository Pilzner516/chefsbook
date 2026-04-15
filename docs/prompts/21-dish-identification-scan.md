# ChefsBook — Session: Dish Identification Scan Flow
# Source: QA Report 2026-04-08 · Items 2, 3, 4
# Target: apps/mobile + @chefsbook/ai

---

## CONTEXT

When a user scans a photo of a dish (not a recipe document), the app should intelligently
identify what the dish is, ask clarifying questions if needed, then offer to find matching
public recipes or generate a complete AI recipe. This is a new intelligent scan mode that
sits alongside the existing recipe document scan.

Read CLAUDE.md before starting. This is a significant new feature — build it cleanly as a
self-contained flow.

---

## OVERVIEW OF THE FLOW

```
User scans image
       ↓
Claude Vision analyses image
       ↓
   ┌─────────────────────────────────────┐
   │ Is this a recipe document?          │
   │ (text, ingredients list, steps)     │
   └─────────────────────────────────────┘
        ↓ YES                    ↓ NO
  Existing scan flow      DISH IDENTIFICATION FLOW
  (no change)             (this session)
                               ↓
                    Claude identifies dish
                    + confidence level
                               ↓
                  Confident?
                  ↓ YES              ↓ NO (up to 3 questions)
            Show result         Ask clarifying questions
                                (pill UI, max 3 questions)
                                       ↓
                               Still unsure?
                               Offer up to 3 dish options
                                       ↓
                    ┌──────────────────────────────┐
                    │ "Is this [Dish Name]?"        │
                    │ [Yes] [No, try again]         │
                    └──────────────────────────────┘
                                       ↓
                    ┌──────────────────────────────┐
                    │ What would you like to do?   │
                    │                              │
                    │ [Find matching recipes]      │
                    │ [Generate a recipe for this] │
                    │ [Cancel]                     │
                    └──────────────────────────────┘
```

---

## STEP 1 — Claude Vision: detect dish vs document

Update `scanRecipeMultiPage()` in `@chefsbook/ai` — or create a new function
`analyseScannedImage()` — that first classifies the image:

```ts
export type ScanImageAnalysis = {
  type: 'recipe_document' | 'dish_photo' | 'unclear';
  dish_name?: string;           // if type === 'dish_photo' and confident
  dish_confidence: 'high' | 'medium' | 'low';
  clarifying_questions?: ClarifyingQuestion[];  // up to 3, if confidence < high
  dish_options?: string[];      // up to 3 dish name options if still unsure
  cuisine_guess?: string;       // inferred cuisine if visible
}

export type ClarifyingQuestion = {
  question: string;             // e.g. "Is that lamb, pork, or beef?"
  options: string[];            // 2-4 pill options
}
```

Claude prompt for image analysis:
```
Analyse this image carefully.

First determine: is this a recipe document (printed or handwritten text with
ingredients and steps) or a photograph of a prepared dish/food?

If it is a recipe document, return: { "type": "recipe_document" }

If it is a dish photo:
- Identify the dish as specifically as possible
- Rate your confidence: high (very certain), medium (fairly sure), low (unsure)
- If confidence is medium or low, provide up to 3 simple clarifying questions
  with 2-4 pill answer options each. Example: "Is the protein lamb, pork, or beef?"
- If after questions you would still offer multiple possibilities, list up to 3
  dish name options
- Always include a cuisine guess if visible from the dish

Return JSON only:
{
  "type": "dish_photo",
  "dish_name": "Rack of Lamb with Herb Crust",
  "dish_confidence": "high",
  "cuisine_guess": "French",
  "clarifying_questions": [],
  "dish_options": []
}
```

---

## STEP 2 — Clarifying questions UI

When `dish_confidence` is `medium` or `low` and `clarifying_questions` is non-empty,
show a modal with pill-style answers. Max 3 questions shown one at a time (not all at once):

```
┌─────────────────────────────────────┐
│  Help us identify this dish         │
│                                     │
│  Is the protein lamb, pork or beef? │
│                                     │
│  ┌───────┐  ┌───────┐  ┌───────┐   │
│  │ Lamb  │  │ Pork  │  │ Beef  │   │
│  └───────┘  └───────┘  └───────┘   │
│                                     │
│         Question 1 of 2             │
└─────────────────────────────────────┘
```

- Pills use `colors.accentSoft` background, `colors.accent` text when unselected
- Selected pill: `colors.accent` background, white text
- Show one question at a time, progress indicator ("Question 1 of 2")
- After each answer, send the answer back to Claude with the next question context
- After all questions answered (or max 3 reached), re-analyse with the answers

If `dish_options` is non-empty after questions, show a selection screen:
```
┌─────────────────────────────────────┐
│  Which dish is this?                │
│                                     │
│  ○ Rack of Lamb Provençal           │
│  ○ Lamb Chops with Herb Crust       │
│  ○ Roasted Rack of Lamb             │
│                                     │
│  [Confirm]   [None of these]        │
└─────────────────────────────────────┘
```

---

## STEP 3 — Cuisine question at scan start (Item 3)

Before even sending the image to Claude, show one optional quick question to help narrow
down the dish. This runs only in dish photo mode (after Claude confirms it's not a document):

```
┌─────────────────────────────────────┐
│  What type of cuisine is this?      │
│  (optional — tap Skip to continue)  │
│                                     │
│  Italian  French  Asian  Mexican    │
│  Indian   Greek   American  Other   │
│                                     │
│         [Skip]                      │
└─────────────────────────────────────┘
```

Pass the selected cuisine (or skip) as additional context in the Claude analysis prompt:
`"The user indicates this is ${cuisine} cuisine."`

---

## STEP 4 — Post-identification action sheet

After the dish is confidently identified (or the user selects from options), show:

```
┌─────────────────────────────────────┐
│  🍽  Rack of Lamb with Herb Crust   │
│       French cuisine                │
│                                     │
│  What would you like to do?         │
│                                     │
│  ┌─────────────────────────────┐    │
│  │ 🔍 Find matching recipes    │    │
│  │    Browse public recipes    │    │
│  └─────────────────────────────┘    │
│                                     │
│  ┌─────────────────────────────┐    │
│  │ ✨ Generate a recipe        │    │
│  │    AI creates a full recipe │    │
│  └─────────────────────────────┘    │
│                                     │
│              [Cancel]               │
└─────────────────────────────────────┘
```

### "Find matching recipes" path

- Search ChefsBook public recipes (existing `discover` / public recipe feed) using the
  dish name as the search query.
- Show results in a bottom sheet or navigate to the search screen pre-filtered.
- User can tap any result to view it, save it to their collection, or go back.

### "Generate a recipe" path

- Call Claude to generate a complete recipe for the identified dish, using:
  - The dish name and cuisine as the primary prompt
  - The scanned image as visual context (re-send the image)
  - Any user answers from the clarifying questions
  - The same recipe JSON structure as all other imports
- The scanned dish photo is automatically used as the recipe's primary image
  (uploaded to `recipe_user_photos` on save)
- Show the standard recipe review screen before saving

---

## STEP 5 — Insufficient information handling (Item 4)

If Claude returns `type: 'unclear'` (can't determine if it's a recipe or a dish):

Show a friendly message:
```
┌─────────────────────────────────────┐
│  We couldn't identify this image    │
│                                     │
│  Try scanning a clearer photo, or   │
│  choose what this is:               │
│                                     │
│  [📄 It's a recipe to scan]         │
│  [🍽  It's a dish I want a recipe for] │
│  [Cancel]                           │
└─────────────────────────────────────┘
```

---

## IMPORTANT CONSTRAINTS

- Max 3 clarifying questions total across the entire identification flow
- Max 3 dish options if still unsure after questions
- All question UI uses pill buttons — never free text input
- The existing recipe document scan flow is NOT changed by this session
- This entire flow only triggers when the scanned image is classified as `dish_photo`
  or `unclear` — never for recipe documents

---

## COMPLETION CHECKLIST

- [ ] `analyseScannedImage()` in `@chefsbook/ai` classifies image as document/dish/unclear
- [ ] Dish confidence level returned with optional clarifying questions
- [ ] Clarifying question pill UI — one question at a time, max 3 total
- [ ] Cuisine quick-select shown after dish confirmed (before deep analysis)
- [ ] Post-identification action sheet: Find recipes / Generate recipe / Cancel
- [ ] "Find matching recipes" searches public ChefsBook recipes by dish name
- [ ] "Generate a recipe" calls Claude with dish name + image + user answers
- [ ] Generated recipe uses scanned dish photo as primary image
- [ ] Dish options selector shown when still unsure after questions (max 3 options)
- [ ] Unclear image shows manual classification prompt
- [ ] Existing recipe document scan flow completely unchanged
- [ ] Safe area insets applied to all new modals and bottom sheets
- [ ] Run `/wrapup` to update DONE.md and CLAUDE.md
