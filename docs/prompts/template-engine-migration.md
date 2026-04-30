# Prompt: Template Engine Migration — Phase 1 Remediation

## LAUNCH PROMPT (paste this into Claude Code to start the session)

```
Read and execute docs/prompts/template-engine-migration.md fully and autonomously, from pre-flight through deployment and /wrapup. Do not stop for questions unless you hit a genuine blocker.
```

---

## TYPE: CODE FIX — WEB ONLY

## Overview

Session TEMPLATE-ENGINE-REBUILD created the engine infrastructure but did not
migrate the six template files to use it. All six templates still contain
hardcoded pixel values for font sizes, heights, padding, and margins calibrated
for Letter (8.5×11) pages only. This is the root cause of every multi-page-size
rendering bug and it was not fixed in Phase 1.

This session completes the migration. No new features. No new files. The engine
already exists — this session rewrites the six templates to use it.

Phase 2 (admin-template-dashboard.md) must NOT start until this session is
deployed and the 30 render test combinations are verified and logged in DONE.md.

---

## Agent files to read — ALL of these, in order, before writing a single line of code

- `.claude/agents/wrapup.md`
- `.claude/agents/testing.md`
- `.claude/agents/publishing.md`
- `.claude/agents/pdf-design.md`
- `.claude/agents/deployment.md`

Read publishing.md PATTERN 9 through PATTERN 14 AND the LAYOUT rules 1–5 from
`docs/prompts/template-system-design.md` before touching any template.
Run ALL pre-flight checklists before writing any code.

---

## Pre-flight: before writing any code

1. Read `docs/prompts/template-system-design.md` in full — mandatory.
2. Read the DONE.md entry for TEMPLATE-ENGINE-REBUILD to understand exactly what
   the engine provides.
3. Read ALL of these engine files in full before touching any template:
   - `apps/web/lib/pdf-templates/engine/types.ts` — ComputedLayout interface
   - `apps/web/lib/pdf-templates/engine/layout.ts` — computeLayout() and PAGE_SIZES
   - `apps/web/lib/pdf-templates/engine/index.ts` — TemplateEngine class
   - `apps/web/lib/pdf-templates/engine/test-recipe.ts` — test data for render tests
4. Read ALL SIX current template files in full and catalogue every hardcoded value:
   font sizes, heights, padding values, margin values, image heights. Write down
   the full list before writing a single line of replacement code.
5. Run `npx tsc --noEmit` in `apps/web` — record baseline error count.

---

## What the engine provides — use these, nothing else

After reading the engine files, the ComputedLayout values available to every
template via `ctx.layout` are:

```typescript
ctx.layout.width              // page width
ctx.layout.height             // page height
ctx.layout.marginTop          // 54pt minimum (Lulu compliant)
ctx.layout.marginBottom       // 54pt minimum
ctx.layout.marginInner        // 63pt minimum
ctx.layout.marginOuter        // 45pt minimum
ctx.layout.contentWidth       // usable column width
ctx.layout.contentHeight      // usable page height
ctx.layout.fontTitle          // recipe title font size
ctx.layout.fontSubtitle       // section header font size
ctx.layout.fontBody           // ingredient/step body text
ctx.layout.fontCaption        // metadata, timers, captions
ctx.layout.fontStepNumber     // step badge number (11pt fixed)
ctx.layout.lineHeight         // body line height multiplier
ctx.layout.heroImageHeight    // full-width hero photo height
ctx.layout.thumbImageHeight   // secondary image height
ctx.layout.badgeSize          // step badge circle diameter (22pt fixed)
ctx.layout.badgeFontSize      // badge number font size (11pt fixed)
ctx.layout.stepGap            // vertical gap between steps (10pt fixed)
ctx.layout.sectionGap         // gap between major sections (16pt fixed)
```

And from `ctx.settings`:
```typescript
ctx.settings.palette.accent       // primary brand color
ctx.settings.palette.background   // page background
ctx.settings.palette.text         // primary text color
ctx.settings.palette.muted        // secondary text color
ctx.settings.palette.surface      // card/section background
ctx.settings.fonts.heading        // heading font family name
ctx.settings.fonts.body           // body font family name
```

---

## Migration rules — apply to every template without exception

**LAYOUT-1:** All sizing must come from `ctx.layout.*` — never use raw numbers
for margins, font sizes, or image heights. The only permitted hardcoded values
are: `1` (divider line thickness), `0` (no spacing), border radius for small
decorative elements (≤4pt), and the step badge dimensions (`ctx.layout.badgeSize`
is already the correct value — use it, don't hardcode 22).

**LAYOUT-2:** Step row structure — this exact pattern, no variations:
```tsx
<View style={{ flexDirection: 'row', alignItems: 'flex-start', marginBottom: ctx.layout.stepGap, }} wrap={false}>
  {/* Badge — fixed size, never shrinks */}
  <View style={{
    width: ctx.layout.badgeSize,
    height: ctx.layout.badgeSize,
    borderRadius: ctx.layout.badgeSize / 2,
    backgroundColor: ctx.settings.palette.accent,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  }}>
    <Text style={{ color: 'white', fontSize: ctx.layout.fontStepNumber, fontFamily: 'Helvetica-Bold' }}>
      {String(index + 1)}
    </Text>
  </View>
  {/* Text — fills remaining row width, wraps naturally */}
  <View style={{ flex: 1, paddingLeft: 8 }}>
    <Text style={{ fontSize: ctx.layout.fontBody, lineHeight: ctx.layout.lineHeight }}>
      {step.instruction}
    </Text>
  </View>
</View>
```

**LAYOUT-3:** Badge color comes from `ctx.settings.palette.accent` — never hardcoded.
For templates where the accent color is too light for white text (check the manifest),
use a dark variant defined as a constant at the top of the template file, not inline.

**LAYOUT-4:** No conditional logic based on page size key. No `if (pageSize === 'square')`.
The `computeLayout()` function already handles all size variation — trust its output.

**LAYOUT-5:** Page component must use dimensions from layout, not a hardcoded string:
```tsx
<Page size={{ width: ctx.layout.width, height: ctx.layout.height }} style={pageStyle}>
```

---

## Template migration order — do one at a time, test before moving on

### 1. trattoria.tsx

Confirmed hardcoded values from pre-flight grep (representative — find all of them):
- `height: '35%'` → `ctx.layout.heroImageHeight`
- `paddingHorizontal: 48` → `ctx.layout.marginOuter`
- `height: 80` (recipe header block) → remove fixed height, auto-height only
- `fontSize: 48` (title) → `ctx.layout.fontTitle`
- `fontSize: 22` (subtitle) → `ctx.layout.fontSubtitle`
- `fontSize: 14` (body) → `ctx.layout.fontBody`
- `fontSize: 9` (caption) → `ctx.layout.fontCaption`
- `paddingTop: 54, paddingBottom: 54, paddingHorizontal: 54` → layout margin values
- `marginBottom: 10` on step rows → `ctx.layout.stepGap`
- All `height: 1` divider lines → keep as 1 (dividers are exempt)

After migration: render test at all 5 page sizes with test-recipe.ts. Record results.
Confirm visually: Letter and Square both render without text overflow.
Only then move to the next template.

### 2. garden.tsx
### 3. nordic.tsx
### 4. studio.tsx
### 5. heritage.tsx
### 6. bbq.tsx

Apply the same process to each. Read the full file first, catalogue all hardcoded
values, replace them all with layout references, then run the render test.

For BBQ specifically:
- The step badge was recently fixed (session BBQ-STEP-BADGE-REGRESSION-FIX)
- The badge color must remain dark/charcoal — read the actual color from the current
  file and preserve it as the template's accent color in its settings
- The LAYOUT-2 step row structure replaces whatever the current badge implementation is
- Confirm text wraps correctly at Square (8×8) after migration

---

## Render test — 30 combinations, all mandatory

For EACH template, at EACH page size, render using `engine/test-recipe.ts`
and confirm no errors are thrown and output is visually correct.

The test recipe must include a step with 30+ words to verify wrapping at Square.
If `engine/test-recipe.ts` doesn't include such a step, add one before testing.

Record results in this exact format for DONE.md:

```
trattoria:   letter ✓  trade ✓  large-trade ✓  digest ✓  square ✓
garden:      letter ✓  trade ✓  large-trade ✓  digest ✓  square ✓
nordic:      letter ✓  trade ✓  large-trade ✓  digest ✓  square ✓
studio:      letter ✓  trade ✓  large-trade ✓  digest ✓  square ✓
heritage:    letter ✓  trade ✓  large-trade ✓  digest ✓  square ✓
bbq:         letter ✓  trade ✓  large-trade ✓  digest ✓  square ✓
```

Do not wrap the session if any of these 30 combinations fails or is untested.

---

## Manual visual verification

After all 30 render tests pass:

1. Open the cookbook canvas editor in the browser
2. BBQ template — open FlipbookPreview at Letter size
   - Confirm step badges are dark circles with white numbers
   - Confirm step text wraps correctly
3. Switch to Square (8×8)
   - Confirm preview rescales
   - Confirm NO text overflow between steps
   - Confirm step text wraps within the column
4. Switch to Trade (6×9)
   - Confirm layout adapts — fonts should be slightly smaller than Letter
5. Switch to Trattoria template
   - Repeat the page size switching test
6. Confirm FillZone (Chef's Notes) still renders at Letter size

---

## Constraints

- Do NOT create any new files — the engine already exists
- Do NOT change any template's visual design, color palette, or typography
- Do NOT change FillZone, CustomPage, or AdditionalImagePage behavior
- Do NOT change the generate route or FlipbookPreview — Phase 1 already updated these
- Do NOT touch any mobile files
- Do NOT introduce new npm dependencies

---

## Checklist — do not deploy until all pass

- [ ] trattoria.tsx: all hardcoded sizing replaced with layout references
- [ ] garden.tsx: all hardcoded sizing replaced with layout references
- [ ] nordic.tsx: all hardcoded sizing replaced with layout references
- [ ] studio.tsx: all hardcoded sizing replaced with layout references
- [ ] heritage.tsx: all hardcoded sizing replaced with layout references
- [ ] bbq.tsx: all hardcoded sizing replaced with layout references
- [ ] All 30 render test combinations logged and passing
- [ ] `grep -n "layout\." trattoria.tsx` returns results (verify engine is actually used)
- [ ] Manual visual: BBQ at Square — step text wraps, no overflow
- [ ] Manual visual: page size switching works in FlipbookPreview
- [ ] Manual visual: FillZone renders correctly
- [ ] `npx tsc --noEmit` passes with 0 errors
- [ ] Deployed to RPi5 — HTTP 200 on chefsbk.app
- [ ] PM2 logs show no startup errors

---

## Deploy

```bash
ssh rasp@rpi5-eth
/mnt/chefsbook/deploy-staging.sh
```

```bash
curl -I https://chefsbk.app/dashboard/print-cookbook
# Expect: HTTP 200 or redirect to login

pm2 logs chefsbook-web --lines 30
# Expect: no startup errors
```

---

## Wrapup

Follow `wrapup.md` fully.

In DONE.md, record this session as TEMPLATE-ENGINE-MIGRATION and include:
- Confirmation that all 6 templates were migrated to use ctx.layout.*
- The 30 render test results table in full
- A note that `grep -n "layout\." trattoria.tsx` now returns results
- That Phase 2 (admin-template-dashboard.md) is now ready to run

In `.claude/agents/publishing.md`, add the LAYOUT-1 through LAYOUT-5 rules
to the known failure patterns section, noting they were established in this session.

In `docs/prompts/template-system-design.md`, update Phase 1 status to COMPLETE
(note: infrastructure was TEMPLATE-ENGINE-REBUILD, migration was this session).
