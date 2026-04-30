# Prompt: PDF Print Template Rendering Fix — BBQ Step Icons + Multi-Page-Size Layout

## LAUNCH PROMPT (paste this into Claude Code to start the session)

```
Read and execute docs/prompts/pdf-template-rendering-fix.md fully and autonomously, from pre-flight through deployment and /wrapup. Do not stop for questions unless you hit a genuine blocker.
```

---

## TYPE: BUG FIX — WEB ONLY

## Overview

Two rendering failures in the Lulu print cookbook preview have been confirmed across multiple
page sizes. Both bugs have survived multiple rebuild attempts and must be resolved permanently.

Bug 1: The BBQ template step icons render as "ã" instead of the intended numbered badges.
This is a font-loading failure in @react-pdf/renderer. The fix replaces the broken icon
font character with a native SVG badge using renderer primitives — no external font required.

Bug 2: The 8×8 Square page size causes step text to overflow its container and bleed
visually into adjacent steps across all six templates. The fix removes fixed-height step
containers and ensures the correct page dimensions flow through from the page size selector
into each template's `<Page>` component.

This session is web-only. No mobile changes.

---

## Agent files to read — ALL of these, in order, before writing a single line of code

- `.claude/agents/wrapup.md`
- `.claude/agents/testing.md`
- `.claude/agents/feature-registry.md`
- `.claude/agents/publishing.md`
- `.claude/agents/pdf-design.md`
- `.claude/agents/ui-guardian.md`
- `.claude/agents/deployment.md`

`publishing.md` and `pdf-design.md` are both MANDATORY for this session.
They cover different layers — publishing.md owns the production pipeline and known
failure patterns; pdf-design.md owns rendering rules and design spec.
Read both in full. Run ALL pre-flight checklists before writing any code.

---

## Pre-flight: before writing any code

1. Read DONE.md — pay close attention to these sessions in order:
   - BOOK-PREVIEW-1 (FillZone + PageSize work — must not be regressed)
   - PRINT-QUALITY-3 (preview/print path separation — must not be merged)
   - PRINT-QUALITY-4 (CustomPage ordering — must remain after RecipeContentPage)
   - COOKBOOK-BUILDER-3 (BBQ template created, step timer overlap fixed inline)
2. Read `publishing.md` PATTERN 9 through PATTERN 14 before touching any template.
   These six patterns describe the exact categories of failure this session is fixing
   and the adjacent failures that must not be introduced while fixing them.
3. Open `apps/web/lib/pdf-templates/bbq.tsx` and locate the step list renderer.
   Identify exactly how the step icon/badge is currently being rendered (font character,
   Unicode glyph, component, etc.). Do not assume — read the actual code.
4. Open `apps/web/components/print/FlipbookPreview.tsx` and confirm:
   - The dynamic import with `ssr: false` is still present (publishing.md PATTERN 9)
   - How the `pageSize` prop is passed to the `<Page>` component in each template
   - Whether any template uses a hardcoded `size="LETTER"` string
5. Open each of the six templates and check for any `height`, `minHeight`, or `maxHeight`
   on step row `<View>` containers.
6. Confirm `@react-pdf/renderer` version in `apps/web/package.json` — the SVG primitives
   (`<Svg>`, `<Circle>`, `<Text>`) must be available in the installed version.
7. Confirm that `Svg`, `Circle`, and the SVG `Text` primitive are aliased as `SvgText`
   when imported — bbq.tsx already imports `Text` from @react-pdf/renderer for body copy.
   The SVG text must be aliased to avoid a naming collision:
   `import { Svg, Circle, Text as SvgText } from '@react-pdf/renderer'`
8. Confirm Inter font has no italic variants registered (publishing.md PATTERN 11) —
   do not introduce `fontStyle: 'italic'` on Inter while editing any template.
9. Run `npx tsc --noEmit` in `apps/web` and record the baseline error count.
   Do not deliver a session with more errors than you started with.

---

## Architecture: what these files do

```
FlipbookPreview.tsx
  → dynamic import with ssr: false (NEVER remove — publishing.md PATTERN 9)
  → receives pageSize prop from the cookbook builder page reducer
  → calculates viewport scale factor based on selected page dimensions
  → renders a scaled preview of the PDF using @react-pdf/renderer PDFViewer
  → passes page dimensions into each template's <Page size={...}> prop

apps/web/lib/pdf-templates/
  bbq.tsx        ← BBQ theme (amber accent #D97706) — built separately from the others
  trattoria.tsx  ← Trattoria theme (red accent #CE2B37)
  studio.tsx     ← Studio theme (dark background #1A1A1A)
  garden.tsx     ← Garden theme (green accent #009246)
  heritage.tsx   ← Heritage theme (sage accent)
  nordic.tsx     ← Nordic theme (blue accent)

Each template receives: recipe data, pageSize, fillZone config
Each template renders: <Page>, header, ingredients, steps, fill zone

Page order within each recipe section (do not alter — publishing.md PATTERN 12):
  PhotoPage → AdditionalImagePage → RecipeContentPage → CustomPage
```

---

## Bug 1 — BBQ step icons rendering as "ã"

**Affected file:** `apps/web/lib/pdf-templates/bbq.tsx`

**publishing.md reference:** PATTERN 10 — Emoji/special characters render as ñ or ã.
This is the fourth recurrence of this class of bug across sessions COOKBOOK-BUILDER,
PDF-FIXES, PRINT-QUALITY-1, and now this session. The root cause is always the same.

**Symptom:** Step rows display as "1 ã", "2 ã", "3 ã". The step number is correct but
the icon character renders as "ã" (U+00E3 — Latin small letter a with tilde).

**Root cause:** The template uses a custom icon font to render a circular badge glyph.
When @react-pdf/renderer cannot embed or resolve that font at render time, it falls back
to the system font and the raw Unicode code point displays as "ã". This is a font-loading
failure, not a data issue.

**Fix:**

Remove the icon font character entirely. Replace with an inline SVG badge component
using @react-pdf/renderer's native `<Svg>`, `<Circle>`, and `<Text>` primitives. These
require no external font and will always render correctly in both preview and PDF export.

```tsx
import { Svg, Circle, Text as SvgText } from '@react-pdf/renderer';

const StepBadge = ({ number }: { number: number }) => (
  <Svg width={20} height={20} viewBox="0 0 20 20">
    <Circle cx="10" cy="10" r="10" fill="#D97706" />
    <SvgText
      x="10"
      y="14"
      textAnchor="middle"
      fontSize={11}
      fill="white"
      fontFamily="Helvetica-Bold"
    >
      {String(number)}
    </SvgText>
  </Svg>
);
```

- The fill color `#D97706` is the BBQ template's amber accent. Do not change it.
- Replace every occurrence of the broken icon font character in the step list with
  `<StepBadge number={index + 1} />`.
- The badge must be 20×20pt with the number at 11pt. Do not resize.
- This component must only exist in `bbq.tsx`. Do not add it to other templates —
  each template has its own accent color and handles step numbering differently.

---

## Bug 2 — 8×8 Square page size: text overlay and collapsed spacing

**Affected files:**
- `apps/web/lib/pdf-templates/bbq.tsx`
- `apps/web/lib/pdf-templates/trattoria.tsx`
- `apps/web/lib/pdf-templates/studio.tsx`
- `apps/web/lib/pdf-templates/garden.tsx`
- `apps/web/lib/pdf-templates/heritage.tsx`
- `apps/web/lib/pdf-templates/nordic.tsx`
- `apps/web/components/print/FlipbookPreview.tsx`

**publishing.md references:** PATTERN 13 (fixed-height step containers) and
PATTERN 14 (page size must be a prop). Both are listed as current active bugs
as of session BOOK-PREVIEW-1. This session resolves both.

**Symptom:** On the 8×8 Square page size, step text from one step bleeds visually into
the next step. Spacing collapses. Content overlaps. Letter size renders cleanly.

**Root cause — two issues:**

Issue A (publishing.md PATTERN 13): Fixed-height step containers. Step row `<View>`
elements have a hardcoded `height` or `minHeight` that was calibrated for the wider
text column of an 8.5×11 page. On 8×8, the shorter line width causes text to wrap
to more lines, overflowing the fixed container and pushing content into the next step.

Issue B (publishing.md PATTERN 14): Page dimensions not correctly passed into `<Page>`.
If any template uses a hardcoded `size="LETTER"` (or no size at all) rather than the
selected page dimensions, the internal layout computes for 792pt height but the preview
is scaled as if the page is 576pt tall, causing content to overflow.

**Fix — in ALL SIX templates:**

1. Audit every step row `<View>`. Remove any `height`, `minHeight`, or `maxHeight`
   from step containers. Step rows must be auto-height, sized entirely by their content.

2. Add `wrap={false}` to every step `<View>` so a single step is never split mid-content
   across a page boundary:

```tsx
<View key={i} style={styles.stepRow} wrap={false}>
  {/* badge or number */}
  <Text style={styles.stepText}>{step.instruction}</Text>
</View>
```

3. Confirm each template's `<Page>` component receives and uses a `size` prop from
   outside rather than a hardcoded string. If any template has `<Page size="LETTER">`,
   replace it with `<Page size={pageSize}>` where `pageSize` is a prop passed in.

**Fix — in `FlipbookPreview.tsx`:**

Confirm the page size dimensions map is defined correctly for all five sizes and that
the correct numeric size object is passed to each template render:

```typescript
const PAGE_SIZES: Record<PageSizeKey, { width: number; height: number }> = {
  'letter':      { width: 612, height: 792 },
  'trade':       { width: 432, height: 648 },
  'large-trade': { width: 504, height: 720 },
  'digest':      { width: 396, height: 612 },
  'square':      { width: 576, height: 576 },
};
```

Confirm the preview viewport scaling calculation uses the SELECTED page dimensions
(not a hardcoded letter aspect ratio) when computing the scale factor. The scale factor
must recalculate correctly when the user switches page sizes in the UI.

While in FlipbookPreview.tsx, confirm the dynamic import with `ssr: false` is intact
(publishing.md PATTERN 9). Do not remove it under any circumstances.

---

## Constraints — do not violate these

- Do NOT change any template's visual design, color palette, typography, or FillZone behavior.
- Do NOT alter the page order within any recipe section: PhotoPage → AdditionalImagePage
  → RecipeContentPage → CustomPage. Fixed in PRINT-QUALITY-4, must not be regressed
  (publishing.md PATTERN 12).
- Do NOT remove the `ssr: false` flag on the FlipbookPreview dynamic import
  (publishing.md PATTERN 9).
- Do NOT use `fontStyle: 'italic'` on Inter fonts in any template — Inter has no
  italic variants registered and react-pdf will throw (publishing.md PATTERN 11).
- Do NOT introduce emoji or icon font characters into any template text content
  (publishing.md PATTERN 10).
- Do NOT touch any file outside the six templates and FlipbookPreview unless the fix
  requires a type adjustment in `apps/web/lib/book-layout.ts` or
  `apps/web/lib/pdf-templates/types.ts`.
- Do NOT introduce any new npm dependencies. Use only @react-pdf/renderer primitives
  already present in the project.
- Do NOT rewrite any template beyond what is required to fix the two bugs above.
- Do NOT touch any mobile files. This fix is web-only.

---

## Testing

### Automated checks

```bash
cd apps/web && npx tsc --noEmit
```

Must pass with 0 errors. Compare against the pre-flight baseline you recorded.

### Manual verification — complete ALL steps before deploying

These checks cannot be automated. They must be performed by navigating to the
live preview in the browser after the build is deployed locally or to staging.

**Step 1 — BBQ badge fix**
1. Open a cookbook in the canvas editor that uses the BBQ template
2. Open the FlipbookPreview
3. Confirm every step row shows a filled amber circle with a white number inside
4. Confirm no "ã" character appears anywhere in the step list
5. Check a recipe with 9 or more steps — badges must be consistent on all of them

**Step 2 — Page size switching**
1. In the canvas editor, open Book Settings and switch to Square (8×8)
2. Confirm the FlipbookPreview rescales the preview correctly for 8×8
3. Scroll through every recipe page and confirm no step text overlaps the next step
4. Find the recipe with the longest steps (most wrapped lines) — confirm it still
   does not overflow its container
5. Switch to Letter (8.5×11) and confirm it still renders correctly with no regression
6. Switch to Trade (6×9) and confirm it renders correctly
7. Switch back to Square (8×8) and confirm the scale factor updates without a reload

**Step 3 — Regression checks**
1. With any template at Letter size, confirm FillZone options (Chef's Notes, Quote,
   Decorative) still render correctly — do not regress BOOK-PREVIEW-1 work
2. Confirm CustomPage cards still appear after the RecipeContentPage, not before —
   do not regress PRINT-QUALITY-4 work (publishing.md PATTERN 12)
3. Confirm FlipbookPreview still loads without a DOMMatrix SSR error in the console

### Checklist — do not deploy until all pass

- [ ] BBQ template: step badges render as filled amber circles with white numbers
- [ ] BBQ template: no "ã" character visible at any page size
- [ ] BBQ template: badges consistent across steps 1–9
- [ ] All 6 templates: Letter (8.5×11) renders with no regression
- [ ] All 6 templates: Square (8×8) renders with no text overlap between steps
- [ ] All 6 templates: Trade (6×9) renders correctly
- [ ] All 6 templates: long steps (3+ wrapped lines) do not overflow at any page size
- [ ] FlipbookPreview: page size switching rescales correctly without reload
- [ ] FillZone: Chef's Notes, Quote, Decorative still render correctly
- [ ] CustomPage still renders after RecipeContentPage in all templates
- [ ] FlipbookPreview dynamic import still has `ssr: false`
- [ ] No emoji characters introduced into any template
- [ ] `npx tsc --noEmit` passes with 0 errors

### psql — no DB changes in this session

This session makes no database changes. Do not run any migrations.
Do not restart supabase-rest.

---

## Deploy

Follow `deployment.md` exactly.

```bash
ssh rasp@rpi5-eth
/mnt/chefsbook/deploy-staging.sh
```

Verify after deploy:

```bash
curl -I https://chefsbk.app/
# Expect: HTTP 200

curl -I https://chefsbk.app/dashboard/print-cookbook
# Expect: HTTP 200 (or redirect to login — not 500)

pm2 logs chefsbook-web --lines 30
# Expect: no startup errors
```

---

## Wrapup

Follow `wrapup.md` fully.

In DONE.md, record:
- Which templates were changed and exactly what was removed/added in each
- Whether the `<Page size>` fix was needed in all six templates or only some
  (record which ones had hardcoded sizes so this is not repeated)
- Confirmation that BOOK-PREVIEW-1 FillZone work was not regressed
- Confirmation that PRINT-QUALITY-4 CustomPage ordering was not regressed

In `.claude/agents/publishing.md`, update the following patterns to reflect resolution:
- PATTERN 10: add a note that SVG primitives (`<Svg>`, `<Circle>`, `<SvgText>`)
  are the established fix for badge-style step numbers in the BBQ template, and that
  `SvgText` must be aliased to avoid collision with the body copy `Text` import
- PATTERN 13: mark as resolved, record which templates had fixed heights removed
- PATTERN 14: mark as resolved, record which templates had hardcoded page sizes replaced

In AGENDA.md, add a note if any template still has layout issues at Digest (5.5×8.5)
that were not addressed in this session, so they can be picked up separately.
