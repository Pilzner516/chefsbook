# Prompt: Template StyleSheet Complete Migration — All 6 Templates

## LAUNCH PROMPT (paste this into Claude Code to start the session)

```
Read and execute docs/prompts/fix-template-stylesheets.md fully and autonomously, from pre-flight through deployment and /wrapup. Do not stop for questions unless you hit a genuine blocker.
```

---

## TYPE: CODE FIX — WEB ONLY

## The problem

The template migration sessions replaced layout values in JSX props but left the
`StyleSheet.create({})` blocks largely untouched. Every template still has 20–30+
hardcoded pixel values in its stylesheet that were calibrated for Letter (8.5×11).

Confirmed in trattoria.tsx:
```
fontSize: 48    fontSize: 36    fontSize: 22    fontSize: 14
fontSize: 13    fontSize: 11    fontSize: 9
paddingHorizontal: 48    paddingTop: 54    paddingBottom: 54
marginBottom: 24    marginBottom: 16    marginBottom: 12
height: '35%'    height: '45%'    height: 230
```

On 8×8 Square pages these values don't scale — the narrower column causes text
to overflow its container and bleed into adjacent steps. This is the direct cause
of the text overlap visible in the current preview.

`height: 1` (divider lines) and `0` values are exempt — do not change these.
Percentage strings like `'100%'` are also exempt — they are relative and scale correctly.

---

## Agent files to read — in order, before writing any code

- `.claude/agents/wrapup.md`
- `.claude/agents/publishing.md`
- `.claude/agents/pdf-design.md`
- `.claude/agents/deployment.md`

Read publishing.md LAYOUT rules 1–5 before touching any template.
Run ALL pre-flight checklists before writing any code.

---

## Pre-flight

1. Read `apps/web/lib/pdf-templates/engine/types.ts` — confirm the full
   ComputedLayout interface and every field available via `ctx.layout`
2. Read `apps/web/lib/pdf-templates/engine/layout.ts` — read the actual
   computed values for each field at each page size so you understand
   what the values will be at Square vs Letter
3. For EACH of the six templates, run this audit command and record the output:

```bash
grep -n "height:.*[0-9]\|fontSize:.*[0-9]\|padding.*[0-9]\|margin.*[0-9]" \
  apps/web/lib/pdf-templates/[template].tsx | grep -v "layout\.\|0\.5\| 0," | grep -v "height: 1,"
```

Templates to audit: `trattoria.tsx`, `bbq.tsx`, `garden.tsx`, `nordic.tsx`,
`studio.tsx`, `heritage.tsx`

Record every hardcoded value for every template before writing any fix.

4. Run `npx tsc --noEmit` in `apps/web` — record baseline error count.

---

## StyleSheet migration rules

### Values that MUST use layout references

| Hardcoded value type | Replace with |
|---------------------|--------------|
| `fontSize: 48` (title) | `layout.fontTitle` |
| `fontSize: 36` (subtitle) | `layout.fontSubtitle` |
| `fontSize: 22` (subtitle) | `layout.fontSubtitle` |
| `fontSize: 14` (body) | `layout.fontBody` |
| `fontSize: 13` (body) | `layout.fontBody` |
| `fontSize: 11` (body/step) | `layout.fontBody` |
| `fontSize: 9` (caption) | `layout.fontCaption` |
| `paddingTop: 54` (page margin) | `layout.marginTop` |
| `paddingBottom: 54` (page margin) | `layout.marginBottom` |
| `paddingHorizontal: 48` | `layout.marginOuter` |
| `paddingLeft/Right: 48` | `layout.marginInner` or `layout.marginOuter` |
| `height: '35%'` (image) | `layout.heroImageHeight` |
| `height: '45%'` (image) | `layout.heroImageHeight` |
| `height: 230` (image) | `layout.heroImageHeight` |
| `marginBottom: 24` (section gap) | `layout.sectionGap` |
| `marginBottom: 16` (section gap) | `layout.sectionGap` |
| `marginBottom: 12` (section gap) | `layout.sectionGap` |
| `marginBottom: 10` (step gap) | `layout.stepGap` |
| `marginBottom: 8` | `Math.round(layout.stepGap * 0.8)` |
| `marginBottom: 4` | `Math.round(layout.stepGap * 0.4)` |

### Values that are EXEMPT — do not change

- `height: 1` — divider lines, always 1pt
- `height: 0.5` — thin dividers, always 0.5pt  
- `borderWidth: 1` or similar border values
- `borderRadius` values for badges (use `layout.badgeSize / 2`)
- `width: 22` or `height: 22` for badges (use `layout.badgeSize`)
- `paddingLeft: 8` on step text wrapper — this is intentional fixed spacing
- `flex: 1`, `flexShrink: 0` — flex values, not sizes
- `opacity`, `letterSpacing`, `lineHeight` multipliers

### StyleSheet note

StyleSheet.create() in react-pdf does NOT accept dynamic values — it's called
once at module load time. The layout values must be passed at render time through
inline styles or through a style factory function, not through StyleSheet.create().

The correct pattern is a style factory:

```typescript
// WRONG — StyleSheet.create() called once, cannot use dynamic layout values
const styles = StyleSheet.create({
  title: { fontSize: layout.fontTitle }  // layout not available here
});

// CORRECT — factory function called at render time with layout
function makeStyles(layout: ComputedLayout, settings: TemplateSettings) {
  return {
    title: { fontSize: layout.fontTitle, color: settings.palette.text },
    body: { fontSize: layout.fontBody, lineHeight: layout.lineHeight },
    pageMargins: {
      paddingTop: layout.marginTop,
      paddingBottom: layout.marginBottom,
      paddingLeft: layout.marginInner,
      paddingRight: layout.marginOuter,
    },
    heroImage: { height: layout.heroImageHeight, width: '100%' },
    sectionGap: { marginBottom: layout.sectionGap },
    stepGap: { marginBottom: layout.stepGap },
  };
}

// In the template function:
export default function TrattoriaDocument(ctx: TemplateContext) {
  const { layout, settings } = ctx;
  const s = makeStyles(layout, settings);
  // Use s.title, s.body, s.pageMargins etc.
}
```

If the templates currently use `StyleSheet.create()` with hardcoded values,
they must be converted to a style factory. If they already use inline styles
or a factory, extend the factory to cover the remaining hardcoded values.

---

## Migration order — do one template, test, then proceed

### 1. trattoria.tsx (Classic)

Confirmed hardcoded values from pre-flight:
- fontSize: 48, 36, 22, 14, 13, 11, 9
- paddingHorizontal: 48, paddingTop/Bottom: 54
- marginBottom: 24, 16, 12, 8, 4
- height: '35%', '45%', 230

After migrating: render test at Letter AND Square with test-recipe.ts.
Confirm no text overflow at Square before moving to next template.

### 2. garden.tsx
### 3. nordic.tsx
### 4. studio.tsx
### 5. heritage.tsx
### 6. bbq.tsx

For each: audit → migrate → render test at Letter + Square → proceed.

---

## Render test for each template

After migrating each template, verify at minimum Letter and Square:

```bash
# The test-recipe.ts file in engine/ should be used
# If a render test script doesn't exist, create a minimal one:
cd apps/web && npx ts-node -e "
  import { TemplateEngine } from './lib/pdf-templates/engine';
  import { testRecipe } from './lib/pdf-templates/engine/test-recipe';
  const ctx = TemplateEngine.buildContext({ recipes: [testRecipe] }, 'letter', 'classic');
  const Template = TemplateEngine.getTemplate('classic');
  console.log('Letter: OK');
  const ctxSq = TemplateEngine.buildContext({ recipes: [testRecipe] }, 'square', 'classic');
  console.log('Square: OK');
"
```

If ts-node isn't available, verify by deploying and testing in the browser.

---

## Constraints

- Do NOT change any template's color palette, font choices, or overall design
- Do NOT change the step row structure (LAYOUT-2) — it is correct
- Do NOT change FillZone, CustomPage, or AdditionalImagePage behavior
- Do NOT change the engine files
- Do NOT change the generate route
- Do NOT touch any mobile files
- `height: 1` divider lines must stay as `height: 1`
- StyleSheet.create() must NOT contain dynamic layout values

---

## Testing

### Manual visual verification — mandatory before deploy

1. Open a cookbook in the canvas editor
2. Select Classic (Trattoria) template — open FlipbookPreview
3. Switch through ALL FIVE page sizes: Letter → Trade → Large Trade → Digest → Square
4. At EACH size confirm:
   - Step text wraps within its container — no overflow into next step
   - Font sizes look proportional (smaller on Digest/Trade, normal on Letter)
   - Images are proportional — not too tall on Square, not too short on Letter
   - FillZone (Chef's Notes) renders correctly
5. Repeat steps 3–4 for BBQ template
6. Confirm step badges on BBQ are dark circles with white numbers at all sizes

### Full checklist — do not deploy without all passing

- [ ] All 6 templates: no hardcoded font sizes in StyleSheet or inline styles
- [ ] All 6 templates: no hardcoded padding/margin values (except exempt ones)
- [ ] All 6 templates: no hardcoded image heights
- [ ] Classic template: all 5 page sizes render without text overflow
- [ ] BBQ template: all 5 page sizes render without text overflow
- [ ] BBQ template: step badges dark circles at all sizes
- [ ] FillZone renders correctly at Letter size
- [ ] `npx tsc --noEmit` passes with 0 errors
- [ ] `grep -n "fontSize:.*[0-9]" trattoria.tsx | grep -v "layout\."` returns only exempt values
- [ ] Deployed to RPi5 — HTTP 200 on chefsbk.app
- [ ] PM2 online — no startup errors

---

## Deploy

```bash
ssh rasp@rpi5-eth
/mnt/chefsbook/deploy-staging.sh
```

```bash
curl -I https://chefsbk.app/dashboard/print-cookbook
pm2 logs chefsbook-web --lines 20 --nostream
```

---

## Wrapup

Follow `wrapup.md` fully.

In DONE.md, record this session as TEMPLATE-STYLESHEET-MIGRATION and include:
- How many hardcoded values were replaced per template
- That StyleSheet.create() was converted to a style factory (if applicable)
- The render test results: all 6 templates × Letter + Square at minimum
- Confirmation that text no longer overflows at Square (8×8)
- That Phase 2 (admin-template-dashboard.md) is now unblocked

In `.claude/agents/publishing.md`, add a new PATTERN:
- StyleSheet.create() cannot contain dynamic layout values in react-pdf —
  use a style factory function called at render time instead
- Any hardcoded font size, padding, margin, or image height is a Lulu compliance
  risk and a multi-page-size rendering bug waiting to happen
- After any template migration, run:
  `grep -n "fontSize:.*[0-9]\|height:.*[0-9]\|padding.*[0-9]" [template].tsx | grep -v "layout\."`
  to confirm no hardcoded values remain

In `docs/prompts/template-system-design.md`, note that StyleSheet.create()
must be replaced with a style factory in all templates, and add this to the
LAYOUT rules as LAYOUT-6.
