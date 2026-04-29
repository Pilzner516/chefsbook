# Prompt: ChefsBook — Recipe Fill Zone + Multi-Size Preview + Preview Scaling

## LAUNCH PROMPT (paste this into Claude Code to start the session)

```
Read and execute docs/prompts/book-preview-1.md fully and autonomously, from pre-flight through deployment and /wrapup. Do not stop for questions unless you hit a genuine blocker.
```

---

## TYPE: FEATURE — WEB ONLY

## Overview

Three things this session:
1. Recipe content pages have blank space at the bottom when content is short. Give users four options to fill that space: custom text/image, a Chef's Notes ruled block, a decorative closing element, or leave blank (default).
2. The book preview always renders at 8.5×11 regardless of the page size the user selected in Book Settings. Fix it to preview at the correct selected size.
3. The preview renders too small on screen. Scale it up to fill the available modal/screen space at the correct aspect ratio.

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
2. Read DONE.md from the repo — current file, not cached. Understand current state of PDF templates, book_layout schema, and preview component.
3. Read `apps/web/lib/book-layout.ts` — understand pageSize field and all supported sizes
4. Find the RecipeContentPage component in all 6 templates — understand its current structure
5. Find the flipbook/preview component — understand how it currently renders pages and at what size
6. Run `\d printed_cookbooks` on RPi5 — confirm book_layout JSONB structure
7. Only then write any code

---

## TASK 1 — Recipe page fill zone

### The problem
Recipe content pages in the PDF have blank white space at the bottom when a recipe has few ingredients or short steps. This looks unfinished in a printed book.

### Implementation approach
In React-PDF, add a `fillZone` container at the bottom of each RecipeContentPage using `flexGrow: 1`. This naturally expands to fill whatever vertical space remains after the recipe content renders — no measuring needed. The fill zone renders its content (or nothing) inside that space.

### Fill zone options
The user selects one option per recipe in the canvas editor. Store the selection in `book_layout` JSONB under each recipe entry. Options:

**1. Blank (default)**
- Nothing rendered in the fill zone
- The page ends cleanly with white space
- No UI element shown in the PDF

**2. Chef's Notes**
- Renders a styled block in the fill zone:
  - "Chef's Notes:" in the recipe heading font, small size, with a horizontal rule below it
  - 4–6 ruled lines (thin horizontal lines, ~60% page width, evenly spaced)
  - Designed for readers to handwrite notes in the printed book
  - Small decorative element (e.g. a tiny pen icon or leaf) beside the heading

**3. Decorative close**
- A simple design element that closes the page gracefully
- A centred horizontal ornamental divider (e.g. "— ✦ —" or a simple line with a small diamond)
- Optionally the recipe name repeated in a light watermark style
- Keeps the template aesthetic — check each template's colour palette and use matching colours

**4. Pull quote**
- A single short quote or saying displayed with editorial styling
- Text input: up to 150 chars (enforced — this is a quote, not a paragraph)
- Optional attribution line: "— [Name]" in smaller italic text below the quote
- Rendered in the fill zone as:
  - Large decorative opening " in the template accent colour, oversized (48–60pt)
  - Quote text in a serif font, larger than body text (14–16pt), centered
  - Closing " mirrored at the end
  - Generous padding above and below the quote block
  - A thin horizontal rule above and below to frame it
- Could be a favourite food quote, a personal saying, a memory tied to the recipe
- Example: *"This is the dish that made my grandmother smile every time."*

**5. Custom text or image**
- Same upload/text fields as the existing Custom Page modal
- Text: up to 300 chars, renders in the fill zone
- Image: uploaded photo, scaled to fit the fill zone height
- Both together: image on left, text on right (or stacked if space is limited)
- Use the existing custom page upload route — do not create a new one

### Canvas editor UI
In each recipe card, below the page thumbnail strip, add a "Page fill" selector:
- A small segmented control or dropdown: Blank | Chef's Notes | Quote | Decorative | Custom
- Default: Blank
- Selecting "Custom" expands an inline mini-form (text field + optional image upload)
  — same pattern as the existing custom page modal but inline and smaller
- The selection persists to `book_layout` JSONB via the existing auto-save

### PDF template changes
Apply to all 6 templates (trattoria, studio, garden, heritage, nordic, bbq):
- Add `fillZone` View with `style={{ flexGrow: 1 }}` at the bottom of RecipeContentPage
- Read the `fillType` and `fillContent` from the recipe's book_layout entry
- Render the appropriate fill component inside the zone
- If `fillType` is blank or undefined, render nothing (empty View)

---

## TASK 2 — Preview respects selected page size

### The problem
The book preview always renders at 8.5×11 even when the user has selected a different page size in Book Settings (6×9, 7×10, 5.5×8.5, 8×8 square).

### Page size dimensions
Map `pageSize` from book_layout to actual dimensions:

```typescript
const PAGE_SIZES = {
  'letter':      { width: 816, height: 1056 },  // 8.5 × 11 in at 96dpi
  'trade':       { width: 576, height: 864  },  // 6 × 9 in
  'large-trade': { width: 672, height: 960  },  // 7 × 10 in
  'digest':      { width: 528, height: 816  },  // 5.5 × 8.5 in
  'square':      { width: 768, height: 768  },  // 8 × 8 in
}
```

### Fix
Read `book_layout.pageSize` in the preview component. Pass the correct width/height to the page renderer. If pageSize is undefined, default to `letter`.

Also pass the pageSize to the PDF generator so the generated PDF uses the correct dimensions — check if this is already wired and fix if not.

---

## TASK 3 — Preview scales to fill the screen

### The problem
The preview modal renders pages at their actual pixel dimensions which is small on screen. Users can't properly review their book layout.

### Fix
The preview component should scale pages to fill the available modal space while maintaining the correct aspect ratio.

Calculate scale factor:
```typescript
const availableWidth = modalWidth - 48   // padding
const availableHeight = modalHeight - 120 // controls + padding
const scaleX = availableWidth / (pageWidth * 2)   // * 2 for two-page spread
const scaleY = availableHeight / pageHeight
const scale = Math.min(scaleX, scaleY, 1.5)       // cap at 1.5x upscale
```

Apply `transform: scale(scale)` with `transform-origin: top center` to the page spread container.

The preview controls (page navigation, thumbnail strip) must remain at normal size — only the page spread itself scales.

On window resize, recalculate and re-apply scale.

---

## Testing

### Fill zone
1. Open a recipe card in canvas editor — confirm "Page fill" selector appears
2. Select "Chef's Notes" — generate PDF — confirm ruled lines appear at bottom of that recipe's content page
3. Select "Quote" — enter a short quote and attribution — generate PDF — confirm large styled quote with decorative marks appears in fill zone
4. Select "Decorative" — generate PDF — confirm ornament appears
4. Select "Custom" — enter text — generate PDF — confirm text appears in fill zone
5. Select "Blank" — confirm fill zone is empty in PDF
6. Confirm fill zone only appears when there is actual space (long recipes that overflow should not show a tiny squished fill zone — if content fills the page, the flexGrow zone will be zero height and nothing renders)

### Preview size
1. Change page size in Book Settings to "6 × 9 in"
2. Click Preview — confirm pages render at portrait 6×9 ratio not 8.5×11 ratio
3. Change to "Square 8 × 8" — confirm square pages in preview

### Preview scaling
1. Open Preview in a large browser window — confirm pages fill most of the modal
2. Resize the window — confirm pages rescale responsively
3. Confirm navigation controls remain normal size

---

## Deploy

Follow `deployment.md`. Deploy web to RPi5.
Run regression smoke test from `testing.md` before wrapup.

---

## Wrapup

Follow `wrapup.md` fully.
Update `feature-registry.md`:
- Recipe page fill zone (4 options)
- Multi-size preview
- Preview scaling

Note in DONE.md:
- book_layout now stores fillType and fillContent per recipe
- Preview respects pageSize from book_layout
- Preview scales to fill modal on all screen sizes
