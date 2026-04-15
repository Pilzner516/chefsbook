# ChefsBook — Session: Instagram Fix + Scan Button Layout + Dish Context
# Source: QA Report 2026-04-08 (device test) · Items 1, 2, 3
# Target: apps/mobile

---

## CONTEXT

Three fixes from real device testing of the latest APK. Read CLAUDE.md before starting.
Apply the mandatory Android safe area rule to any new UI elements.

---

## FIX 1 — Instagram paste URL routes to search instead of import (Item 1)

### Symptom
Pasting an Instagram post URL into the manual paste input on the Scan tab navigates to the
search page instead of triggering the Instagram import flow.

### Investigation
1. Find the manual Instagram URL paste handler in the Scan tab.
2. Check what happens when the user submits the pasted URL — is it being passed to a
   search function instead of `fetchInstagramPost()`?
3. Check if the URL validation is stripping or misidentifying the Instagram URL format.

### Fix
The paste input submit handler must:
1. Detect that the input is an Instagram URL using the same check as the share handler:
   ```ts
   const isInstagramUrl = (url: string) =>
     url.includes('instagram.com/p/') ||
     url.includes('instagram.com/reel/');
   ```
2. If it is an Instagram URL → call `fetchInstagramPost()` → route to
   `extractRecipeFromInstagram()` → show the recipe review or dish identification flow.
3. If it is NOT an Instagram URL → show a validation error: "Please paste an Instagram
   post or reel link."
4. Do NOT route Instagram URLs to the recipe search or any other flow.

Also verify the clipboard paste button works the same way — paste from clipboard should
go through the same `isInstagramUrl` check and routing logic.

**Verify:** Paste `https://www.instagram.com/p/ABC123/` → Instagram import flow starts,
not search page.

---

## FIX 2 — Scan page action buttons layout (Item 3)

### Symptom
The three scan action buttons ("Add page", "From gallery", "Done scanning") are displayed
in a single row that overflows — text wraps mid-word and "Done scanning" is cramped.
Visible in the screenshot.

### Fix
The three buttons must never overflow or wrap text mid-word. Two acceptable layouts:

**Option A — Two rows (preferred for readability):**
```
┌──────────────────┐  ┌──────────────────┐
│   📷 Add page    │  │  🖼 From gallery  │
└──────────────────┘  └──────────────────┘
┌─────────────────────────────────────────┐
│           ✅ Done scanning              │
└─────────────────────────────────────────┘
```
Row 1: "Add page" + "From gallery" side by side, each 50% width minus gap.
Row 2: "Done scanning" full width, red background + white text (primary action).

**Option B — Single column stack:**
All three buttons full width, stacked vertically. Simplest to implement if layout is complex.

Either option is acceptable. Choose whichever is cleaner given the current component
structure. The key rules:
- `numberOfLines={1}` is NOT sufficient if the button is too narrow — fix the width instead
- All button text must fit on one line without wrapping
- "Done scanning" should always be visually the most prominent (red, larger, or full-width)
- Apply `paddingBottom: insets.bottom + 16` to the button container (safe area rule)

**Also fix:** "Cancel scan" text link below the buttons — ensure it has adequate top margin
(at least 16px) and is not clipped.

---

## FIX 3 — Ask for additional context after dish confirmation (Item 2)

### Current behaviour
After the user confirms the dish name (e.g. "Yes, this is Rack of Lamb"), the app
immediately shows the action sheet ("Find matching recipes" / "Generate a recipe").

### Target behaviour
After dish confirmation, show one additional optional step before the action sheet:

```
┌─────────────────────────────────────────┐
│  Any details to add?           [Skip →] │
│─────────────────────────────────────────│
│  Add cooking notes, dietary needs,      │
│  or key ingredients to improve results  │
│                                         │
│  ┌───────────────────────────────────┐  │
│  │ e.g. "medium rare, no garlic,     │  │
│  │  gluten-free version"             │  │
│  └───────────────────────────────────┘  │
│                                         │
│              [Continue →]               │
└─────────────────────────────────────────┘
```

### Behaviour
- Free text input, placeholder text as shown above
- "Skip →" in the top right dismisses this step with empty context
- "Continue →" passes the text forward (even if empty)
- The entered text is appended to the Claude prompts in both paths:
  - **"Find matching recipes":** append to the search query
    e.g. search for `"Rack of Lamb medium rare gluten-free"`
  - **"Generate a recipe":** append to the Claude generation prompt:
    `"User notes: medium rare, no garlic, gluten-free version"`
- Max 200 characters. Show a character counter (e.g. `47/200`) in the bottom-right
  of the text input.
- Apply `insets.bottom` to the Continue button.

### Where to insert in the flow
```
Dish confirmed
      ↓
[NEW] Additional context step  ← insert here
      ↓
Action sheet (Find recipes / Generate)
```

This step appears in `DishIdentificationFlow` after the dish is confirmed and before
`onDishConfirmed()` is called. Pass the context string into `onDishConfirmed(dishName, userContext)`.

---

## COMPLETION CHECKLIST

- [ ] Instagram paste input routes to import flow, not search
- [ ] Clipboard paste button uses same routing logic
- [ ] Non-Instagram URLs show validation error
- [ ] Scan buttons layout fixed — no text wrapping, Done scanning prominent
- [ ] Safe area inset applied to scan button container
- [ ] Cancel scan has adequate margin and is not clipped
- [ ] Additional context step added after dish confirmation
- [ ] Context text passed to both recipe search and AI generation prompts
- [ ] Character counter shown (X/200)
- [ ] Skip works correctly (empty context, proceeds to action sheet)
- [ ] Safe area inset on Continue button
- [ ] No regressions in Instagram share flow, scan flow, or dish identification flow
- [ ] Run `/wrapup` to update DONE.md and CLAUDE.md
