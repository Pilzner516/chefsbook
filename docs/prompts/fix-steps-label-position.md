# Prompt: Fix Orphaned STEPS Label — All Templates

## LAUNCH PROMPT (paste this into Claude Code to start the session)

```
Read and execute docs/prompts/fix-steps-label-position.md fully and autonomously, from pre-flight through deployment and /wrapup. Do not stop for questions unless you hit a genuine blocker.
```

---

## TYPE: CODE FIX — WEB ONLY

## The problem

When ingredients overflow to a second page, the STEPS label stays on the first
page at the bottom with nothing under it — orphaned. This happens because the
STEPS label is rendered as a sibling element before the steps container, not
inside it.

Current structure (wrong):
```tsx
{/* Ingredients section */}
<View>...</View>

{/* STEPS label — sits here, gets stranded on page 1 if ingredients overflow */}
<Text>STEPS</Text>

{/* Steps container — may start on page 2 */}
<View style={styles.stepsSection}>
  {recipe.steps.map(...)}
</View>
```

Correct structure:
```tsx
{/* Ingredients section */}
<View>...</View>

{/* Steps container — STEPS label is INSIDE, always travels with the steps */}
<View style={styles.stepsSection}>
  <Text>STEPS</Text>  {/* ← moved inside, always above first step */}
  {recipe.steps.map(...)}
</View>
```

---

## Agent files to read

- `.claude/agents/wrapup.md`
- `.claude/agents/deployment.md`

---

## Pre-flight

Find the STEPS label in all six templates:

```bash
grep -n "strings.steps\|STEPS\|steps.toUpper" \
  apps/web/lib/pdf-templates/trattoria.tsx \
  apps/web/lib/pdf-templates/bbq.tsx \
  apps/web/lib/pdf-templates/garden.tsx \
  apps/web/lib/pdf-templates/nordic.tsx \
  apps/web/lib/pdf-templates/studio.tsx \
  apps/web/lib/pdf-templates/heritage.tsx
```

For each result, look at the surrounding context (10 lines before and after)
to determine whether the STEPS label is inside or outside the steps container.
Record which templates need the fix before writing any code.

---

## The fix

For every template where the STEPS label is outside the steps container:

1. Cut the STEPS label `<Text>` element
2. Paste it as the FIRST child inside the steps container `<View>`
3. Ensure it keeps its existing style — do not change font, color, or spacing

The steps container must NOT have `wrap={false}` — confirmed in previous sessions.
The STEPS label inside it also must NOT have `wrap={false}`.

---

## Constraints

- Do NOT change any styling on the STEPS label
- Do NOT change the steps container structure
- Do NOT touch any other part of any template
- Do NOT touch engine, generate route, or FlipbookPreview

---

## Testing — mandatory before wrap

1. Open a cookbook with a recipe that has many ingredients (6+)
2. BBQ template, Square (8×8)
3. Find a page where ingredients overflow — confirm STEPS label appears
   at the TOP of the steps on whatever page the steps start on
4. Confirm there is NO orphaned STEPS label at the bottom of the ingredients page
5. Repeat for Trattoria template

---

## Checklist

- [ ] STEPS label is inside the steps container in all affected templates
- [ ] No orphaned STEPS label at bottom of ingredients page
- [ ] STEPS label appears correctly above first step on whatever page steps start
- [ ] `npx tsc --noEmit` 0 errors
- [ ] Committed, pushed, deployed — HTTP 200, PM2 online

---

## Deploy

```bash
ssh rasp@rpi5-eth
/mnt/chefsbook/deploy-staging.sh
```

---

## Wrapup

In DONE.md record as TEMPLATE-STEPS-LABEL-FIX:
- Moved STEPS label inside steps container in [list which templates needed it]
- STEPS label now always appears directly above first step regardless of page
- No more orphaned STEPS label at bottom of ingredients page
