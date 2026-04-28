# Prompt: Cookbook PDF — Fix Timer Bug, TOC Leaders, Cover Styles

## LAUNCH PROMPT (paste this into Claude Code to start the session)

```
Read and execute docs/prompts/cookbook-pdf-fixes.md fully and autonomously, from pre-flight through deployment and /wrapup. Do not stop for questions unless you hit a genuine blocker.
```

---

## TYPE: CODE FIX

## Context

The PDF redesign (session PDF-REDESIGN) produced a much better layout overall but
three specific issues remain, confirmed by visual inspection of the generated PDF.

---

## Agent files to read before writing any code

- `.claude/agents/wrapup.md`
- `.claude/agents/testing.md`
- `.claude/agents/pdf-design.md`  ← primary reference for this session
- `.claude/agents/deployment.md`

---

## Fix 1 — Timer "ñ" character (CRITICAL — marked done but NOT fixed)

**Evidence:** The PDF shows `ñ1h 30min`, `ñ3min`, `ñ5min`, `ñ15min` throughout.
The previous session claimed this was fixed. It was not.

**Find the root cause:**

Search the entire codebase for where timer values are rendered:
```bash
grep -r "ñ" apps/web/components/ apps/web/lib/ apps/web/app/api/cookbooks/
grep -r "timer\|duration\|cookTime\|cook_time" apps/web/components/CookbookPdf.tsx
```

The `ñ` is likely coming from:
- The recipe data itself having `ñ` baked in as a prefix character in the steps text
- OR the PDF template rendering a Unicode character that Puppeteer is not handling correctly
- OR a font issue where a specific Unicode clock character falls back to a glyph that looks like `ñ`

**Fix options in priority order:**
1. If `ñ` is in the raw recipe data (steps text): add a data sanitisation step that strips
   `ñ` from all step text before rendering — replace `ñ` with nothing (the timer value
   itself will remain)
2. If the template is inserting a Unicode character that Puppeteer can't render:
   replace with the text `⏱` and ensure the font supports it, OR simply use plain text
   `(` + time value + `)` in italic green — no emoji needed
3. If all else fails: remove the timer indicator entirely from step text — a clean step
   without a broken character is better than a broken one

**After fixing:** search the DB for any stored `ñ` characters in recipe steps:
```sql
SELECT id, title FROM recipes WHERE steps::text LIKE '%ñ%' LIMIT 5;
```
If found in DB, note it in DONE.md as a data cleanup task for AGENDA.md.

---

## Fix 2 — TOC dotted leaders broken

**Evidence:** The TOC shows dots wrapping to multiple lines per recipe entry instead
of a single clean horizontal leader line from recipe name to page number.

**Current broken output (example):**
```
Beautiful Burger Buns
 . . . . . . . . . . . . . . . . . . . . . . . . . . -
 . . . . . . . . . . . . . . . . . . . . . . . . . . . -
 . . . . . . . . . . . . . . . . . . . . . . . . . . . 4
```

**Required output:**
```
Beautiful Burger Buns .......................... 4
```

**The fix:** Replace the current CSS dotted leader approach with a table-based layout
which Puppeteer handles reliably. CSS `content: "."` repeating leaders are notoriously
broken in Puppeteer/Chrome PDF rendering.

Use this HTML/CSS pattern instead:

```html
<table class="toc-table">
  <tr>
    <td class="toc-name">Beautiful Burger Buns</td>
    <td class="toc-dots"></td>
    <td class="toc-page">4</td>
  </tr>
</table>
```

```css
.toc-table {
  width: 100%;
  border-collapse: collapse;
}
.toc-name {
  font-family: 'Playfair Display', serif;
  font-size: 13pt;
  color: #1a1a1a;
  white-space: nowrap;
  padding-right: 8pt;
}
.toc-dots {
  width: 100%;
  border-bottom: 1pt dotted #ddd8cc;
  /* This creates a single clean dotted line */
}
.toc-page {
  font-family: 'Inter', sans-serif;
  font-size: 11pt;
  font-weight: 300;
  color: #7a6a5a;
  white-space: nowrap;
  padding-left: 8pt;
  text-align: right;
}
```

This approach renders reliably in Puppeteer because it uses a table cell border
rather than CSS content generation.

---

## Fix 3 — Three cover styles look identical

**Evidence:** Classic, Modern, and Minimal cover styles generate the same visual output.

**Find the cover template:**
```bash
grep -r "cover_style\|coverStyle\|classic\|modern\|minimal" apps/web/components/ apps/web/lib/
```

**Required differentiation:**

### Classic (default)
- Background: `#faf7f0` (warm cream)
- Inset border frame: 1.5pt solid `#ce2b37`, inset 24pt from all edges
- Title: Playfair Display Bold, `#1a1a1a`
- Subtitle: Playfair Display Italic, `#1a1a1a`
- Author: Inter Light, `#7a6a5a`

### Modern
- Background: `#1a1a1a` (near black)
- No border frame
- Horizontal red accent bar: 8pt tall, full width, positioned 40% down the page
- Title: Playfair Display Bold, `#ffffff` (white)
- Subtitle: Inter Light, `#ce2b37` (red)
- Author: Inter Light, `rgba(255,255,255,0.6)`
- Hat icon: filter to invert/white version if possible, or omit

### Minimal
- Background: `#ffffff` (pure white)
- Red accent bar: 6pt tall, full width, at very top of page only
- Title: Inter Bold (NOT Playfair — this is the key differentiator), `#1a1a1a`
- Subtitle: Inter Light Italic, `#7a6a5a`
- Author: Inter Light, `#9a8a7a`
- No hat icon — replace with a small red horizontal rule (2pt, 40pt wide, centred)

The cover template must use an `if/else` or `switch` on `cover_style` to apply
the correct CSS class or inline styles. Verify this logic exists and is actually
branching correctly.

---

## Testing

Generate a test PDF for each cover style and visually confirm:

1. Timer text shows clean time values with NO `ñ` character anywhere in the PDF
2. TOC shows single-line entries with dotted leader on one line per recipe
3. Classic cover: cream background with red border frame
4. Modern cover: dark background with red accent bar and white text
5. Minimal cover: white background, red top bar, Inter font (not Playfair)

Save test PDFs:
```
/tmp/test-classic.pdf
/tmp/test-modern.pdf
/tmp/test-minimal.pdf
```

---

## Deploy

Follow `deployment.md`. Deploy web to RPi5.
Run regression smoke test from `testing.md` before wrapup.

---

## Wrapup

Follow `wrapup.md` fully.
Confirm all three issues fixed with specific evidence:
- Timer: quote a step from the PDF showing clean time value
- TOC: describe the new single-line format
- Cover styles: describe visual difference between all three
