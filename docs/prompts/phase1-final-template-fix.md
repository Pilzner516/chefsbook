# Prompt: Phase 1 Final — Complete Template Fix (No More Hotfixes)

## LAUNCH PROMPT (paste this into Claude Code to start the session)

```
Read and execute docs/prompts/phase1-final-template-fix.md fully and autonomously, from pre-flight through deployment and /wrapup. Do not stop for questions unless you hit a genuine blocker.
```

---

## TYPE: CODE FIX — WEB ONLY — PHASE 1 COMPLETION

## Context for the agent

Read this section completely before touching any file.

This project has spent 24 hours on Phase 1 of a template system rebuild. Multiple
sessions have claimed to fix template rendering and failed. The templates are still
broken at non-Letter page sizes. This session ends that loop permanently.

**What previous sessions got wrong — read every item:**

1. `StyleSheet.create()` is called ONCE at module load time. It cannot contain
   dynamic values like `layout.fontTitle`. Any `layout.*` reference inside
   `StyleSheet.create({})` evaluates to `undefined` because `layout` does not
   exist at module load time. This is why the "migration" that added 18-27
   `layout.*` references per template did not fix the rendering — those references
   were inside StyleSheet.create() and resolved to undefined.

2. `wrap={false}` on a View that wraps ALL steps prevents the entire steps section
   from paginating. Only individual step row Views should have `wrap={false}`.
   The steps CONTAINER must NOT have `wrap={false}`.

3. Previous "render tests" were TypeScript compilation checks, not visual render
   tests. TypeScript compiling with 0 errors does not mean the PDF renders correctly.
   A template can pass TypeScript and produce a completely broken PDF.

4. Sessions wrapped without visual proof. Every session that said "manual verification
   required" was incomplete. This session does NOT wrap without a screenshot
   confirming Square (8×8) renders correctly.

---

## Agent files to read — in order, before writing any code

- `.claude/agents/wrapup.md`
- `.claude/agents/publishing.md` — read ALL patterns including LAYOUT-1 through LAYOUT-6
- `.claude/agents/pdf-design.md`
- `.claude/agents/deployment.md`

---

## Pre-flight — mandatory audit before writing any code

You must complete this audit and document the results before writing a single
line of code. Do not skip any step.

### Audit Step 1 — Find every StyleSheet.create() call

```bash
grep -n "StyleSheet.create\|const styles" apps/web/lib/pdf-templates/trattoria.tsx
grep -n "StyleSheet.create\|const styles" apps/web/lib/pdf-templates/bbq.tsx
grep -n "StyleSheet.create\|const styles" apps/web/lib/pdf-templates/garden.tsx
grep -n "StyleSheet.create\|const styles" apps/web/lib/pdf-templates/nordic.tsx
grep -n "StyleSheet.create\|const styles" apps/web/lib/pdf-templates/studio.tsx
grep -n "StyleSheet.create\|const styles" apps/web/lib/pdf-templates/heritage.tsx
```

For every template that uses `StyleSheet.create()`: the styles object is computed
once at module load. Any `layout.*` value inside it is `undefined`. These must be
converted to inline styles or a style factory function.

### Audit Step 2 — Find every wrap={false} on a section container

```bash
grep -n "wrap={false}" apps/web/lib/pdf-templates/trattoria.tsx
grep -n "wrap={false}" apps/web/lib/pdf-templates/bbq.tsx
grep -n "wrap={false}" apps/web/lib/pdf-templates/garden.tsx
grep -n "wrap={false}" apps/web/lib/pdf-templates/nordic.tsx
grep -n "wrap={false}" apps/web/lib/pdf-templates/studio.tsx
grep -n "wrap={false}" apps/web/lib/pdf-templates/heritage.tsx
```

For every `wrap={false}` found: look at the surrounding context (5 lines before
and after). Determine whether it wraps:
- An individual step row — CORRECT, keep it
- A notes box — CORRECT, keep it
- A small header/divider element — CORRECT, keep it
- The entire steps section container — WRONG, remove it
- The entire ingredients section — WRONG, remove it

Document every wrong one before fixing.

### Audit Step 3 — Find remaining hardcoded pixel values

```bash
grep -n "fontSize:.*[0-9]\|paddingTop:.*[0-9]\|paddingBottom:.*[0-9]\|paddingHorizontal:.*[0-9]\|paddingLeft:.*[0-9]\|paddingRight:.*[0-9]\|marginBottom:.*[0-9]\|marginTop:.*[0-9]\|height:.*[0-9]" \
  apps/web/lib/pdf-templates/trattoria.tsx | grep -v "layout\.\|height: 1\|height: 0\|0\.5\|' 0'\|borderWidth\|borderRadius\|paddingLeft: 8\|flex:"
```

Run this for all six templates. Record every hardcoded value found.

### Audit Step 4 — Read the engine layout values

```bash
cat apps/web/lib/pdf-templates/engine/layout.ts
```

Read `computeLayout()` completely. Write down the actual computed values for
Square (8×8, width=576, height=576) and Letter (width=612, height=792).
You need these to verify the style factory produces sensible values.

### Audit Step 5 — Read one full template before touching any

```bash
cat apps/web/lib/pdf-templates/trattoria.tsx
```

Read the entire file. Understand its complete structure before making any changes.

---

## The two fixes required in every template

### Fix 1 — Replace StyleSheet.create() with inline styles

**The rule:** All sizing that depends on `layout.*` must be inline styles
applied directly to the JSX element, not in StyleSheet.create().

Only truly static values (colors, fontFamily, fontWeight, flex values,
borderRadius for decorative elements, borderWidth) may stay in StyleSheet.create().

**Pattern — correct approach:**

```tsx
// WRONG — layout.fontTitle is undefined at StyleSheet.create() time:
const styles = StyleSheet.create({
  title: { fontSize: layout.fontTitle, color: '#1A1A1A' }
});

// CORRECT — inline styles at render time:
export default function TrattoriaDocument(ctx: TemplateContext) {
  const { layout, settings, cookbook, recipes } = ctx;
  
  // Static styles — colors, font families, flex only
  // These do NOT change with page size so StyleSheet.create() is fine
  const staticStyles = StyleSheet.create({
    page: { backgroundColor: CREAM },
    titleText: { fontFamily: 'Playfair Display', fontWeight: 700, color: DARK },
    bodyText: { fontFamily: 'Inter', fontWeight: 400, color: DARK },
  });

  return (
    <Document>
      <Page
        size={{ width: layout.width, height: layout.height }}
        style={staticStyles.page}
      >
        {/* Dynamic sizing via inline styles */}
        <Text style={[staticStyles.titleText, { fontSize: layout.fontTitle }]}>
          {cookbook.title}
        </Text>
        <View style={{
          paddingTop: layout.marginTop,
          paddingBottom: layout.marginBottom,
          paddingLeft: layout.marginInner,
          paddingRight: layout.marginOuter,
        }}>
          {/* content */}
        </View>
      </Page>
    </Document>
  );
}
```

### Fix 2 — Remove wrap={false} from section containers

**The rule:** `wrap={false}` must ONLY appear on:
- Individual step row Views (prevents a step from splitting mid-sentence)
- Notes boxes (keeps the notes label + text together)
- Small header elements (recipe title block, section labels)

`wrap={false}` must NEVER appear on:
- The View containing ALL steps (this prevents pagination of the steps section)
- The View containing ALL ingredients (same problem)
- Any container that holds more than ~3 lines of content on a small page

**Step row — correct structure:**
```tsx
{/* Steps CONTAINER — no wrap={false} here, allows pagination */}
<View style={{ marginTop: layout.sectionGap }}>
  {recipe.steps.map((step, index) => (
    {/* Individual step row — wrap={false} here is correct */}
    <View
      key={index}
      wrap={false}
      minPresenceAhead={40}
      style={{
        flexDirection: 'row',
        alignItems: 'flex-start',
        marginBottom: layout.stepGap,
      }}
    >
      {/* Badge — fixed size, never shrinks */}
      <View style={{
        width: layout.badgeSize,
        height: layout.badgeSize,
        borderRadius: layout.badgeSize / 2,
        backgroundColor: ACCENT_COLOR,
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
      }}>
        <Text style={{
          color: '#ffffff',
          fontSize: layout.badgeFontSize,
          fontFamily: 'Helvetica-Bold',
        }}>
          {String(step.step_number)}
        </Text>
      </View>
      {/* Text — fills remaining width, wraps naturally */}
      <View style={{ flex: 1, paddingLeft: 8 }}>
        <Text style={{
          fontSize: layout.fontBody,
          lineHeight: layout.lineHeight,
          fontFamily: 'Inter',
          fontWeight: 400,
          color: DARK,
        }}>
          {fixTimerCharacter(step.instruction)}
        </Text>
      </View>
    </View>
  ))}
</View>
```

---

## Template-specific accent colors — use these exactly

Do not guess or derive these from the template files. Use them as-is:

| Template | File | Accent color | Background | Text |
|----------|------|-------------|------------|------|
| Classic/Trattoria | trattoria.tsx | `#CE2B37` | `#FAF7F0` | `#1A1A1A` |
| Modern/Studio | studio.tsx | `#1A1A1A` | `#111111` | `#FFFFFF` |
| Minimal/Garden | garden.tsx | `#009246` | `#FFFFFF` | `#1A1A1A` |
| Heritage | heritage.tsx | `#8B7355` | `#F9F6EF` | `#2C2C2C` |
| Nordic | nordic.tsx | `#2E4057` | `#FAFAFA` | `#1A1A1A` |
| BBQ/Pitmaster | bbq.tsx | `#1C1C1C` | `#F5F0E8` | `#1C1C1C` |

---

## Fix order — one template at a time, verify before proceeding

### Template 1 — trattoria.tsx

Apply Fix 1 (inline styles for all layout.* values) and Fix 2 (remove wrap={false}
from steps container). After applying:

Run this verification:
```bash
# Confirm no layout.* inside StyleSheet.create()
grep -A 200 "StyleSheet.create" apps/web/lib/pdf-templates/trattoria.tsx | grep "layout\."
# Should return nothing
```

Deploy ONLY trattoria changes, generate a preview, verify Square (8×8) renders
with no step text overflow before continuing.

**DO NOT PROCEED to template 2 until you have visual confirmation trattoria works.**

### Templates 2-6

Apply the same fixes to: `studio.tsx`, `garden.tsx`, `nordic.tsx`, `heritage.tsx`,
`bbq.tsx` in that order. For each one:
1. Apply Fix 1 and Fix 2
2. Run the StyleSheet verification grep
3. Confirm the step row structure matches the correct pattern above
4. Deploy and visually verify

---

## Verification — this session does not wrap without these

### The grep that must return nothing for every template:

```bash
# Run for each template — must return EMPTY output
grep -A 200 "StyleSheet.create" apps/web/lib/pdf-templates/trattoria.tsx | grep "layout\."
grep -A 200 "StyleSheet.create" apps/web/lib/pdf-templates/bbq.tsx | grep "layout\."
grep -A 200 "StyleSheet.create" apps/web/lib/pdf-templates/garden.tsx | grep "layout\."
grep -A 200 "StyleSheet.create" apps/web/lib/pdf-templates/nordic.tsx | grep "layout\."
grep -A 200 "StyleSheet.create" apps/web/lib/pdf-templates/studio.tsx | grep "layout\."
grep -A 200 "StyleSheet.create" apps/web/lib/pdf-templates/heritage.tsx | grep "layout\."
```

### The grep that must return only step rows and notes boxes:

```bash
# Every wrap={false} must be on an individual step row or notes box
grep -n "wrap={false}" apps/web/lib/pdf-templates/trattoria.tsx
grep -n "wrap={false}" apps/web/lib/pdf-templates/bbq.tsx
grep -n "wrap={false}" apps/web/lib/pdf-templates/garden.tsx
grep -n "wrap={false}" apps/web/lib/pdf-templates/nordic.tsx
grep -n "wrap={false}" apps/web/lib/pdf-templates/studio.tsx
grep -n "wrap={false}" apps/web/lib/pdf-templates/heritage.tsx
# For each result: verify it is on a step row or notes box, NOT a section container
```

### Visual verification — mandatory, not optional

For EACH of the six templates, generate a preview at Square (8×8) and confirm:
- Step text wraps within its column — no text bleeds into next step
- Step badges are the correct color (see accent colors table above)
- Ingredients section renders cleanly
- Notes section renders cleanly

This session DOES NOT WRAP until Square (8×8) renders cleanly for all six templates.
TypeScript compiling is not sufficient. "Deployed successfully" is not sufficient.
You must generate a preview in the browser and verify visually.

### TypeScript

```bash
cd apps/web && npx tsc --noEmit
# Must pass with 0 errors
```

---

## Constraints

- Do NOT change any template's visual design, color palette, or typography
- Do NOT change the engine files
- Do NOT change the generate route
- Do NOT change FlipbookPreview
- Do NOT move any files
- Do NOT touch any mobile files
- The `height: 1` divider lines must stay as `height: 1`
- `paddingLeft: 8` on step text wrapper must stay as `8` (intentional fixed spacing)

---

## Deploy

```bash
ssh rasp@rpi5-eth
/mnt/chefsbook/deploy-staging.sh
```

Deploy after each template fix to verify visually before proceeding to the next.

---

## Wrapup

Follow `wrapup.md` fully.

This session DOES NOT wrap until:
1. All six templates pass the StyleSheet.create() grep (returns nothing)
2. All six templates pass the wrap={false} audit (only step rows and notes boxes)
3. Square (8×8) preview generates cleanly for all six templates
4. TypeScript passes with 0 errors

In DONE.md record this as PHASE1-COMPLETE and include:
- The audit results from pre-flight (what was found in each template)
- Confirmation that StyleSheet.create() no longer contains layout.* values
- Confirmation that wrap={false} is only on individual step rows and notes boxes
- Visual verification: Square (8×8) renders correctly for all 6 templates
- That Phase 2 (admin-template-dashboard.md) is now unblocked and ready to run

In `.claude/agents/publishing.md` add two permanent rules:
- LAYOUT-7: StyleSheet.create() must NEVER contain layout.* values.
  StyleSheet is computed at module load time. Use inline styles for all
  dynamic sizing. Only static values (colors, fontFamily, fontWeight, flex)
  may live in StyleSheet.create().
- LAYOUT-8: wrap={false} must NEVER appear on a container that holds multiple
  steps or an entire section. Only individual step rows and notes boxes.
  Before wrapping any session that touches templates, run:
  `grep -n "wrap={false}"` on every template and verify each result.

In `docs/prompts/template-system-design.md` update Phase 1 to COMPLETE
with the session name and date. Note that Phase 2 is ready to run.
