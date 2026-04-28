# Agent: PDF Cookbook Design Standards
# File: .claude/agents/pdf-design.md

## LAUNCH PROMPT — Save agent file (run this first, separately)

```
Copy the file docs/prompts/pdf-design-agent.md to .claude/agents/pdf-design.md and commit it with message "feat: add pdf-design agent". Do not build anything else in this step.
```

---

# READ THIS before touching any PDF generation, template, or Puppeteer rendering code.

---

## Purpose

This agent defines the visual design standards for all ChefsBook printed cookbook PDFs.
Every session that modifies `CookbookPdf`, `CookbookCoverPdf`, or any Puppeteer PDF
rendering pipeline MUST read this file before writing code.

The goal is award-winning cookbook design — not a Word document with bullet points.
Reference quality: Ottolenghi cookbooks, NYT Cooking print editions, Bon Appétit.

---

## Lulu Print Specifications (NEVER change these)

```
Page size:        8.5" × 11"  (612pt × 792pt at 72dpi)
Bleed:            0.125" (9pt) on all four sides
Safe margin:      0.75" (54pt) top/bottom, 0.875" (63pt) inner, 0.625" (45pt) outer
Inner margin:     Add 0.125" extra on binding side to account for spine
Colour space:     sRGB (Puppeteer default — do not convert)
Resolution:       Images must be fetched at source resolution; never upscale
PDF version:      1.4 minimum (Puppeteer default is fine)
```

---

## Typography

### Font stack (load via Google Fonts @import in Puppeteer HTML)

```css
@import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,600;0,700;1,400;1,600&family=Inter:wght@300;400;500;600&display=swap');
```

### Scale

| Element                  | Font                    | Size   | Weight | Style   |
|--------------------------|-------------------------|--------|--------|---------|
| Title page — book title  | Playfair Display        | 52pt   | 700    | normal  |
| Title page — subtitle    | Playfair Display        | 22pt   | 400    | italic  |
| Title page — author      | Inter                   | 14pt   | 300    | normal  |
| TOC — recipe name        | Playfair Display        | 13pt   | 400    | normal  |
| TOC — page number        | Inter                   | 11pt   | 300    | normal  |
| Chapter divider title    | Playfair Display        | 38pt   | 700    | normal  |
| Recipe title (h1)        | Playfair Display        | 30pt   | 700    | normal  |
| Recipe meta line         | Inter                   | 10pt   | 400    | normal  |
| Recipe description       | Inter                   | 11pt   | 300    | normal  |
| Section label (INGREDIENTS / STEPS / NOTES) | Inter | 9pt | 600 | normal — ALL CAPS, letter-spacing: 2px |
| Ingredient item          | Inter                   | 11pt   | 400    | normal  |
| Ingredient group header  | Inter                   | 11pt   | 600    | normal  |
| Step number              | Playfair Display        | 14pt   | 700    | normal  |
| Step text                | Inter                   | 11pt   | 400    | normal  |
| Timer text               | Inter                   | 10pt   | 300    | normal  |
| Notes text               | Inter                   | 10.5pt | 300    | normal  |
| Running footer           | Inter                   | 8pt    | 300    | normal  |
| Page number              | Inter                   | 9pt    | 400    | normal  |

---

## Colour Palette

```css
--cb-red:         #ce2b37;   /* pomodoro — recipe titles, step numbers, section labels, accents */
--cb-black:       #1a1a1a;   /* near-black — body text */
--cb-cream:       #faf7f0;   /* warm cream — page background, title page bg */
--cb-cream-dark:  #f0ece0;   /* slightly darker cream — TOC bg, ingredient boxes */
--cb-green:       #009246;   /* basil — timer indicators, fresh accent */
--cb-muted:       #7a6a5a;   /* warm brown-grey — meta lines, muted text */
--cb-border:      #ddd8cc;   /* warm light border — dividers, boxes */
--cb-white:       #ffffff;   /* pure white — cards, photo frames */
```

Page background: `--cb-cream` (#faf7f0) — NOT white. This gives a warm, printed-book feel.

---

## Page Structure: Title Page

Full-page design. No header/footer on this page.

```
┌─────────────────────────────────────────────┐
│                                             │
│   [full bleed decorative element — see      │
│    cover design section]                    │
│                                             │
│                                             │
│         ┌─────────────────────────┐         │
│         │                         │         │
│         │   [Chefsbook hat icon]  │         │
│         │                         │         │
│         │   BOOK TITLE            │         │  ← Playfair Display Bold 52pt
│         │   Subtitle here         │         │  ← Playfair Display Italic 22pt
│         │                         │         │
│         │   ───────────────────   │         │  ← thin red line 1px #ce2b37
│         │                         │         │
│         │   by Author Name        │         │  ← Inter Light 14pt
│         │                         │         │
│         └─────────────────────────┘         │
│                                             │
│   Created with Chefsbook                    │  ← bottom, small, muted
│   chefsbk.app                              │
└─────────────────────────────────────────────┘
```

Background: use a large full-bleed subtle food illustration or a solid deep
cream/linen texture. Do NOT use a white background on the title page.

If the chosen cover style is:
- **Classic**: cream (#faf7f0) background with a thin red border frame inset 24pt from edges
- **Modern**: dark background (#1a1a1a) with all text in white and cream
- **Minimal**: white background, red accent bar 12pt tall across the top

---

## Page Structure: Table of Contents

Background: `--cb-cream-dark` (#f0ece0)
No running header on this page.

```
┌─────────────────────────────────────────────┐
│                                             │
│  Contents                                   │  ← Playfair Display Bold 38pt, red
│  ──────────────────────────────────────     │  ← 1pt red divider
│                                             │
│  Beautiful Burger Buns ............... 4    │
│  Chimichurri Sauce ................... 6    │
│  [etc]                                      │
│                                             │
│  [each row: recipe name left, dotted        │
│   leader, page number right]                │
│                                             │
└─────────────────────────────────────────────┘
```

Recipe names: Playfair Display 13pt
Dotted leader: Inter 300 10pt, letter-spacing: 2px, colour: --cb-border
Page numbers: Inter 300 11pt, right-aligned, colour: --cb-muted

---

## Page Structure: Recipe Page

### Layout (two-column variant — preferred when recipe has a photo)

```
┌─────────────────────────────────────────────────────┐
│  [Recipe photo — full width, height 280pt max]       │
├─────────────────────────────────────────────────────┤
│                                                      │
│  Recipe Title                          [cuisine tag] │  ← title row
│  cuisine · course · time · N servings                │  ← meta row, muted
│                                                      │
│  Description paragraph in Inter Light 11pt...        │
│                                                      │
│  ──────────────────────────────────────              │  ← 0.5pt border
│                                                      │
│  INGREDIENTS                                         │  ← red label, caps
│                                                      │
│  Group heading (if any)                              │  ← Inter SemiBold
│  • Ingredient 1                                      │
│  • Ingredient 2                                      │
│                                                      │
│  ──────────────────────────────────────              │
│                                                      │
│  STEPS                                               │  ← red label, caps
│                                                      │
│  1  Step text here...                                │
│     ⏱ 30 min                                        │  ← green, italic, small
│                                                      │
│  2  Step text here...                                │
│                                                      │
│  ──────────────────────────────────────              │
│                                                      │
│  NOTES                                               │  ← red label, caps
│  Notes text in italic...                             │
│                                                      │
├─────────────────────────────────────────────────────┤
│  Chefsbook           Recipe Title          Page N   │  ← running footer
└─────────────────────────────────────────────────────┘
```

### Photo treatment
- Full width, constrained to 280pt height max
- `object-fit: cover` — never stretch or squish
- If no photo: use a cream placeholder with a subtle food category icon centered
- Slight drop shadow on photo bottom edge: `box-shadow: 0 2px 8px rgba(0,0,0,0.08)`

### Ingredients layout
- If recipe has ingredient groups (e.g. "For the dough", "For the glaze"):
  render each group with its header in Inter SemiBold 11pt, then its items
- If no groups: simple bullet list
- Use a real bullet `•` character, NOT a dash

### Steps layout
- Step number: Playfair Display Bold 14pt, colour: --cb-red, float left, min-width 24pt
- Step text: Inter Regular 11pt, inline after number
- Timer line: new line, indented 24pt, Inter Italic 10pt, colour: --cb-green
  Format: `⏱ 30 min` — use the ⏱ emoji, NOT the "ñ" character that was previously
  appearing as a rendering bug. Fix this wherever it appears.

### Running footer
- Left: "Chefsbook" — Inter Light 8pt, colour: --cb-muted
- Centre: recipe title — Inter Light 8pt, colour: --cb-muted (truncate if > 40 chars)
- Right: page number — Inter Regular 9pt, colour: --cb-black
- Separated from content by a 0.5pt border-top in --cb-border

---

## Page Structure: Chapter Divider (optional, between cuisine groups)

If recipes are grouped by cuisine or course, insert a chapter divider page:

```
┌─────────────────────────────────────────────┐
│                                             │
│                                             │
│                                             │
│     [Full-bleed colour block — left half]   │
│     Colour: --cb-red for first chapter,     │
│     --cb-black for alternating chapters     │
│                                             │
│         Chapter Name                        │  ← Playfair Display Bold 38pt white
│         N Recipes                           │  ← Inter Light 14pt white
│                                             │
│                                             │
└─────────────────────────────────────────────┘
```

Only insert chapter dividers if the cookbook has 20+ recipes across 3+ cuisines.
For smaller books, skip chapter dividers.

---

## Page Structure: Back Page (last page)

```
┌─────────────────────────────────────────────┐
│                                             │
│   [Centred, vertically centred]             │
│                                             │
│   [Chefsbook hat icon — large, 80pt]        │
│                                             │
│   Chefsbook                                 │  ← wordmark, Playfair Bold 32pt
│                                             │
│   Your recipes, beautifully collected.      │  ← Inter Light 14pt, --cb-muted
│                                             │
│   chefsbk.app                               │  ← Inter Regular 12pt, --cb-red
│                                             │
└─────────────────────────────────────────────┘
```

---

## Known Bugs to Always Fix

1. **Timer character bug**: The "ñ" character appearing before timer durations is a
   rendering artifact. The correct output is `⏱ X min` with a space-hair separator.
   Fix in the data pipeline: wherever `ñ` appears before a time value, replace with `⏱ `.

2. **Bullet inconsistency**: Some ingredients use `•` and others use `-`.
   Always normalise to `•` in the HTML template.

3. **Excessive whitespace**: The current template has large empty `<br>` gaps between
   sections. Remove all `<br>` spacers and use CSS `margin-bottom` on each section
   instead. Sections should breathe but not gape.

4. **White page background**: The current template uses white. Change to `#faf7f0`.

5. **Missing running footer**: Current template has only a page number.
   Add the full three-column running footer per spec above.

---

## What NOT to do

- Do NOT use white as the page background
- Do NOT use dashes as bullet points in ingredients
- Do NOT use `<br>` tags for spacing — use CSS margins
- Do NOT use the system sans-serif font — always import Playfair Display + Inter
- Do NOT render timers as "ñ Xmin" — fix the source data pipeline
- Do NOT make the title page a plain white page with centred text
- Do NOT omit the running footer
- Do NOT skip the back page
- Do NOT use gradients or drop shadows heavier than `0 2px 8px rgba(0,0,0,0.08)`
- Do NOT use more than 2 font families (Playfair Display + Inter only)
- Do NOT use font sizes smaller than 8pt or larger than 52pt

---

## Output Quality Checklist (verify before wrapup)

Every PDF generation session must confirm:

- [ ] Page background is warm cream (#faf7f0), not white
- [ ] Playfair Display loaded and rendering correctly on titles
- [ ] Inter loaded and rendering correctly on body text
- [ ] Title page has visual design (not plain centred text on white)
- [ ] TOC has dotted leaders and correct page numbers
- [ ] Recipe photos render at full width with object-fit: cover
- [ ] No "ñ" timer characters — all replaced with ⏱
- [ ] All bullets are • not -
- [ ] Section labels (INGREDIENTS/STEPS/NOTES) are Inter 9pt ALL CAPS red
- [ ] Step numbers are Playfair Display Bold red
- [ ] Running footer present on all recipe pages
- [ ] Back page present with Chefsbook branding
- [ ] No excessive blank whitespace between sections
- [ ] PDF opens cleanly in Adobe Acrobat or Preview
- [ ] File size reasonable (< 50MB for a 100-page book)
