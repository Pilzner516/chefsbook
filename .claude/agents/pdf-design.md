# Agent: PDF Cookbook Design Standards
# File: .claude/agents/pdf-design.md

---

# READ THIS before touching any PDF generation or template code.

---

## Purpose

This agent defines the visual design standards for all ChefsBook printed cookbook PDFs.
Every session that modifies PDF templates or the generate API route MUST read this file.

The goal is award-winning cookbook design — not a Word document with bullet points.
Reference quality: Ottolenghi cookbooks, NYT Cooking print editions, Bon Appétit.

---

## PDF Engine: @react-pdf/renderer

We use `@react-pdf/renderer` for server-side PDF generation. Key technical notes:

- **NOT Puppeteer** — react-pdf is a React component library, not browser-based
- All layout uses Flexbox (like React Native, not web CSS grid/floats)
- Text sizing is in points (pt), not px
- No CSS classes — all styles are inline via `StyleSheet.create()`
- Images must be fetched as base64 data URIs before rendering
- Fonts must be registered with `Font.register()` before use
- Use `renderToBuffer()` to generate the PDF buffer for storage upload

### Three Template Files

```
apps/web/lib/pdf-templates/trattoria.tsx  — Classic (warm, rustic, cream bg)
apps/web/lib/pdf-templates/studio.tsx     — Modern (dark, dramatic, black bg)
apps/web/lib/pdf-templates/garden.tsx     — Minimal (clean, airy, white bg, Inter only)
apps/web/lib/pdf-templates/types.ts       — Shared types and helper functions
```

The generate route at `apps/web/app/api/print-cookbooks/[id]/generate/route.ts` selects
the appropriate template based on `cookbook.cover_style`.

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

### Font Registration (react-pdf Font.register)

Register fonts via jsDelivr CDN (fontsource has reliable TTF files):

```typescript
import { Font } from '@react-pdf/renderer';

Font.register({
  family: 'Playfair Display',
  fonts: [
    { src: 'https://cdn.jsdelivr.net/fontsource/fonts/playfair-display@latest/latin-400-normal.ttf', fontWeight: 400 },
    { src: 'https://cdn.jsdelivr.net/fontsource/fonts/playfair-display@latest/latin-700-normal.ttf', fontWeight: 700 },
    { src: 'https://cdn.jsdelivr.net/fontsource/fonts/playfair-display@latest/latin-400-italic.ttf', fontWeight: 400, fontStyle: 'italic' },
  ],
});

Font.register({
  family: 'Inter',
  fonts: [
    { src: 'https://cdn.jsdelivr.net/fontsource/fonts/inter@latest/latin-300-normal.ttf', fontWeight: 300 },
    { src: 'https://cdn.jsdelivr.net/fontsource/fonts/inter@latest/latin-400-normal.ttf', fontWeight: 400 },
    { src: 'https://cdn.jsdelivr.net/fontsource/fonts/inter@latest/latin-600-normal.ttf', fontWeight: 600 },
    { src: 'https://cdn.jsdelivr.net/fontsource/fonts/inter@latest/latin-700-normal.ttf', fontWeight: 700 },
  ],
});
```

**Important**: Garden template uses Inter only (no Playfair Display) — this is the key differentiator.

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
   rendering artifact. Use `fixTimerCharacter()` from `types.ts` to replace with `⏱ `.

2. **Bullet style**: Trattoria uses `•`, Garden uses en-dash `–` in green. 
   Match the template's established style.

3. **Image loading**: All images must be fetched as base64 data URIs BEFORE rendering.
   The template receives `image_urls: string[]` which should already be base64.

4. **Background colors per template**:
   - Trattoria: warm cream `#faf7f0`
   - Studio: dark `#1a1a1a`
   - Garden: pure white `#ffffff`

5. **Running footer**: All content pages need the three-column footer:
   Left: "ChefsBook" | Centre: recipe title | Right: page number

---

## What NOT to do

- Do NOT use CSS — react-pdf uses StyleSheet.create() with inline styles
- Do NOT use external image URLs directly — fetch as base64 first
- Do NOT use gradients (not supported in react-pdf)
- Do NOT render timers as "ñ Xmin" — use fixTimerCharacter()
- Do NOT use more than 2 font families (Playfair Display + Inter for Trattoria/Studio, Inter-only for Garden)
- Do NOT use font sizes smaller than 8pt or larger than 52pt
- Do NOT omit the running footer on content pages
- Do NOT skip the back page branding
- Do NOT use Google Fonts URLs (use jsDelivr fontsource CDN for reliable TTF)
- Do NOT use shadows (react-pdf View has no box-shadow support)

---

## Output Quality Checklist (verify before wrapup)

Every PDF generation session must confirm:

- [ ] Correct template selected based on cover_style (classic→Trattoria, modern→Studio, minimal→Garden)
- [ ] Fonts loading via jsDelivr CDN (Playfair Display + Inter)
- [ ] Background colors match template (cream for Trattoria, dark for Studio, white for Garden)
- [ ] Cover/title page renders with template-specific design elements
- [ ] TOC has leader lines and correct page numbers
- [ ] Recipe images render (base64 conversion working)
- [ ] No "ñ" timer characters — fixTimerCharacter() applied
- [ ] Section labels (INGREDIENTS/STEPS/NOTES) styled correctly
- [ ] Running footer present on all recipe pages
- [ ] Back page present with ChefsBook branding
- [ ] PDF opens cleanly in viewer
- [ ] File size reasonable (< 50MB for a 100-page book)
- [ ] TypeScript compiles with no errors: `npx tsc --noEmit`
