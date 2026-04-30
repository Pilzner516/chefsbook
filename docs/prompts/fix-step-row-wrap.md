# Prompt: Fix Step Row wrap={false} — All 6 Templates

## LAUNCH PROMPT (paste this into Claude Code to start the session)

```
Read and execute docs/prompts/fix-step-row-wrap.md fully and autonomously, from pre-flight through deployment and /wrapup. Do not stop for questions unless you hit a genuine blocker.
```

---

## TYPE: CODE FIX — WEB ONLY

## The problem

In react-pdf, `wrap={false}` must be on the element that contains the actual
flex row layout — not just an outer wrapper. In the BBQ template (and likely
others), the step structure looks like this:

```tsx
{/* wrap={false} is here — outer container */}
<View key={si} wrap={false} minPresenceAhead={100} style={{ marginBottom: ... }}>
  {showGroupLabel && <Text>...</Text>}
  {/* BUT the actual flex row has NO wrap={false} */}
  <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
    <StepBadge ... />
    <View style={{ flex: 1, paddingLeft: 10 }}>
      <Text>{step.instruction}</Text>
    </View>
  </View>
</View>
```

Because `wrap={false}` is on the outer container but NOT on the inner flex row,
react-pdf can split the badge and text across pages during layout calculation.
The fix is to add `wrap={false}` to the inner `<View style={{ flexDirection: 'row' }}>`.

---

## Agent files to read

- `.claude/agents/wrapup.md`
- `.claude/agents/deployment.md`

---

## Pre-flight

Find every step flex row across all six templates:

```bash
grep -n "flexDirection.*row.*alignItems\|alignItems.*flex-start.*row\|flexDirection: 'row'" \
  apps/web/lib/pdf-templates/trattoria.tsx \
  apps/web/lib/pdf-templates/bbq.tsx \
  apps/web/lib/pdf-templates/garden.tsx \
  apps/web/lib/pdf-templates/nordic.tsx \
  apps/web/lib/pdf-templates/studio.tsx \
  apps/web/lib/pdf-templates/heritage.tsx | grep -v "wrap={false}"
```

Every result that does NOT already have `wrap={false}` on the step flex row
needs to be fixed. Record the line numbers.

Also run `npx tsc --noEmit` — record baseline.

---

## The fix

For every step flex row View across all six templates, add `wrap={false}`:

```tsx
{/* BEFORE */}
<View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>

{/* AFTER */}
<View wrap={false} style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
```

Do this for step rows only — not ingredient rows, not other flex rows.
Read the context around each line before changing it to confirm it is a step row.

---

## Constraints

- Only add `wrap={false}` to step flex rows — nothing else
- Do NOT change any other code in any template
- Do NOT touch engine, generate route, or FlipbookPreview

---

## Testing

### Manual — mandatory before deploy

1. Open a cookbook, BBQ template, Square (8×8)
2. Flip through ALL pages of a recipe with 9+ steps
3. Confirm NO step text bleeds into the next step on ANY page
4. Confirm steps that are too long for the remaining page space move to
   the next page cleanly
5. Repeat for Trattoria template at Square (8×8)

### Checklist

- [ ] All step flex rows have `wrap={false}` in all 6 templates
- [ ] BBQ at Square (8×8): no step text overlap on any page
- [ ] Trattoria at Square (8×8): no step text overlap on any page
- [ ] `npx tsc --noEmit` passes with 0 errors
- [ ] Deployed — HTTP 200, PM2 online

---

## Deploy

```bash
ssh rasp@rpi5-eth && /mnt/chefsbook/deploy-staging.sh
```

---

## Wrapup

In DONE.md record as TEMPLATE-STEP-ROW-WRAP:
- Added wrap={false} to step flex rows in all 6 templates
- Root cause: wrap={false} on outer container does not prevent react-pdf
  from splitting the inner flex row across pages
- Visual confirmation: Square (8×8) renders with no step text overlap

In `.claude/agents/publishing.md` update LAYOUT-8 to add:
- wrap={false} must be on the FLEX ROW itself (the View with flexDirection: 'row')
  not just on an outer wrapper container. react-pdf does not cascade wrap prevention
  to child elements.
