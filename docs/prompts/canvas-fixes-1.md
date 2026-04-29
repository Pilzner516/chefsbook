# Prompt: ChefsBook — Shopping Print Fix + Page Size Margins + Fill Zone Rebuild

## LAUNCH PROMPT (paste this into Claude Code to start the session)

```
Read and execute docs/prompts/canvas-fixes-1.md fully and autonomously, from pre-flight through deployment and /wrapup. Do not stop for questions unless you hit a genuine blocker.
```

---

## TYPE: BUG FIX — WEB ONLY

## Overview

Three issues introduced or left broken by the previous chained session need fixing:
1. Shopping list print view shows no ingredients or quantities
2. Non-letter book page sizes have wrong margins and broken page breaks
3. Fill zone UI is non-functional — buttons do nothing, no input fields, no save, wrong options

---

## Agent files to read — ALL of these, in order, before writing a single line of code

- `.claude/agents/wrapup.md`
- `.claude/agents/testing.md`
- `.claude/agents/feature-registry.md`
- `.claude/agents/ui-guardian.md`
- `.claude/agents/deployment.md`
- `.claude/agents/pdf-design.md`

Run ALL pre-flight checklists before writing any code.

---

## Pre-flight: before writing any code

1. Read CLAUDE.md fully
2. Read DONE.md from the repo — current file, not cached
3. Find the shopping list print component and its @media print stylesheet
4. Find all 6 PDF template files and the page size dimension constants
5. Find the fill zone component and modal in the canvas editor
6. Only then write any code

---

## FIX 1 — Shopping list print shows no ingredients or quantities

The print view shows department headers and checkboxes but ingredient names
and quantities are blank or missing.

Trace what data the print component renders. The ingredient name and quantity
columns are likely being hidden by the print CSS, or the data is not being
passed into the print-specific markup correctly.

Requirements — every printed row must show:
```
□   2 tablespoons   Butter   The Pear Pie
```
- Checkbox (□)
- Quantity + full unit word (never abbreviated)
- Full ingredient name — never truncated
- Recipe source — right aligned

Do not change the screen view. Print only.

---

## FIX 2 — Page size margins and page breaks

The book preview and PDF generator received page size support in the previous
session but non-letter sizes have incorrect margins and broken page breaks.

### Correct page dimensions and margins for each size

Verify these exact values are used in the PDF templates and preview:

| Size | Page (inches) | Page (pt) | Margins |
|------|--------------|-----------|---------|
| Letter | 8.5 × 11 | 612 × 792 | Top/Bottom: 54pt, Inner: 63pt, Outer: 45pt |
| Trade | 6 × 9 | 432 × 648 | Top/Bottom: 48pt, Inner: 54pt, Outer: 36pt |
| Large Trade | 7 × 10 | 504 × 720 | Top/Bottom: 54pt, Inner: 58pt, Outer: 40pt |
| Digest | 5.5 × 8.5 | 396 × 612 | Top/Bottom: 44pt, Inner: 50pt, Outer: 32pt |
| Square | 8 × 8 | 576 × 576 | Top/Bottom: 48pt, Inner: 54pt, Outer: 54pt |

All sizes include 0.125in (9pt) bleed on all sides for Lulu printing.

Page breaks must never fall outside the page boundary. Check that the
`@page` CSS rule and React-PDF page dimensions match the selected size.

Test each size in the preview — pages must display at the correct aspect ratio
with content inside the margins.

---

## FIX 3 — Fill zone UI complete rebuild

The fill zone was partially built in the previous session. It needs to be
rebuilt correctly. The existing implementation has:
- Buttons that do nothing when clicked
- No input fields for quote text or chef's notes text
- No image upload option
- No Save button
- A "Decorative" option that was not requested — REMOVE IT

### What the fill zone must have

The fill zone selector appears when the user clicks on a Content page thumbnail
in the recipe card. It is part of that page's edit modal.

**Four options only — remove Decorative entirely:**

**1. Blank (default)**
- No input needed
- Selecting this clears any existing fill content
- Save button closes the modal

**2. Chef's Notes**
- No text input needed — it renders a pre-styled block
- Shows a preview description: "Prints a 'Chef's Notes:' heading with ruled lines for handwriting"
- Save button saves the selection and closes

**3. Pull Quote**
- Text input: quote text (required, max 150 chars, show character count)
- Text input: attribution (optional, e.g. "— Grandma Rose", max 60 chars)
- Shows a styled preview of how it will look in the PDF
- Save button saves quote + attribution and closes

**4. Custom**
- Text area: up to 300 chars (optional)
- Image upload: click or drag-drop, uses existing upload route (optional)
- Either text or image or both must be provided — validate before save
- Shows preview of uploaded image if one is selected
- Save button saves content and closes

### Modal structure

```
[Page preview thumbnail — large]

Page fill zone
Fill the blank space at the bottom of this recipe page

○ Blank   ○ Chef's Notes   ○ Pull Quote   ○ Custom

[Input fields for selected option — appear below the radio buttons]

[Save]  [Cancel]
```

### Save behaviour
- On Save: persist the selection and content to book_layout JSONB via existing auto-save
- The fill zone data must flow through to the PDF generator
- After saving, the content page thumbnail in the canvas should show a small
  indicator of which fill type is set (e.g. a small " icon for quote, 📝 for chef's notes)

### PDF rendering
The FillZone component in the PDF templates must read and render the saved fill data:
- Blank: render nothing (empty flexGrow View)
- Chef's Notes: render heading + ruled lines
- Pull Quote: render large styled quote with decorative marks and attribution
- Custom: render text and/or image in the fill zone

Confirm the fill content appears in both Preview and generated PDF.

---

## Testing

### Shopping print
1. Open a shopping list, click print
2. Confirm every row shows: checkbox, quantity, unit (full word), ingredient name, recipe source
3. Print to PDF — confirm nothing is truncated or missing

### Page sizes
1. In Book Settings, select each page size in turn
2. Click Preview — confirm pages render at the correct aspect ratio
3. Generate PDF for at least Letter and Square — confirm margins look correct

### Fill zone
1. Click a Content page thumbnail in a recipe card
2. Confirm four options: Blank, Chef's Notes, Pull Quote, Custom
3. Select Pull Quote — confirm text input and attribution input appear
4. Enter a quote — click Save — confirm modal closes
5. Click Preview or Generate — confirm the pull quote appears in the PDF
6. Select Chef's Notes — click Save — confirm ruled lines appear in PDF
7. Select Custom — upload an image and enter text — confirm both appear in PDF
8. Select Blank — confirm fill zone is empty in PDF

---

## Deploy

Follow `deployment.md`. Deploy web to RPi5.
Run regression smoke test from `testing.md` before wrapup.

---

## Wrapup

Follow `wrapup.md` fully.
Update `feature-registry.md` and DONE.md:
- Shopping list print fixed — ingredients and quantities now show
- Page size margins corrected for all 5 sizes with Lulu specs
- Fill zone UI rebuilt — 4 options, inputs wired, saves to PDF
