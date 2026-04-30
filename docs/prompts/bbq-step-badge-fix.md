# Prompt: BBQ Step Badge Regression Fix — Text Wrapping + Circle Color

## LAUNCH PROMPT (paste this into Claude Code to start the session)

```
Read and execute docs/prompts/bbq-step-badge-fix.md fully and autonomously, from pre-flight through deployment and /wrapup. Do not stop for questions unless you hit a genuine blocker.
```

---

## TYPE: BUG FIX — WEB ONLY

## Overview

Session PDF-STEP-BADGE-FIX introduced two regressions in the BBQ template step badge
component. Both must be corrected.

Regression 1: Step text is not wrapping. Every step renders on a single line that runs
off the edge of the page. The `View` circle badge and step text are competing for width
in a flex row with no flex constraints, so the text has no room to wrap.

Regression 2: The step badge circles are amber (`#D97706`) but the original BBQ template
used dark/charcoal circles. The previous session used the wrong color based on an
incorrect assumption in the prompt.

This session is web-only. One file only: `apps/web/lib/pdf-templates/bbq.tsx`.

---

## Agent files to read — ALL of these, in order, before writing a single line of code

- `.claude/agents/wrapup.md`
- `.claude/agents/testing.md`
- `.claude/agents/feature-registry.md`
- `.claude/agents/publishing.md`
- `.claude/agents/pdf-design.md`
- `.claude/agents/deployment.md`

Run ALL pre-flight checklists before writing any code.

---

## Pre-flight: before writing any code

1. Read DONE.md entry for session PDF-STEP-BADGE-FIX. Understand exactly what was
   changed — specifically the StepBadge component structure that was introduced.
2. Open `apps/web/lib/pdf-templates/bbq.tsx` and read it fully before touching anything:
   - Find the StepBadge component introduced in the last session
   - Find the original charcoal/dark color used elsewhere in the BBQ template
     (check the template's style definitions — palette constants, header colors,
     step number styles from before the badge was introduced). Do not guess the color
     — read it from the actual code.
   - Find the step row layout: confirm whether the row `<View>` has correct flex
     constraints (`flexDirection: 'row'`) and whether the text container has `flex: 1`
3. Record the correct dark color before writing any code.
4. Run `npx tsc --noEmit` in `apps/web` and record the baseline error count.

---

## Fix 1 — Step text not wrapping

**Root cause:** The step row flex layout is missing constraints that allow the text
to fill remaining space and wrap. The badge and text are competing for width.

**Required structure:**

The step row must be a flex row where the badge has a fixed size and does not shrink,
and the text container takes all remaining width with wrapping enabled:

```tsx
// Step row — flex row, badge fixed, text fills remaining space
<View style={{ flexDirection: 'row', alignItems: 'flex-start', marginBottom: 10 }} wrap={false}>
  <StepBadge number={index + 1} />
  <View style={{ flex: 1, paddingLeft: 8 }}>
    <Text style={styles.stepText}>{step.instruction}</Text>
  </View>
</View>
```

Key rules:
- The outer row `<View>` must have `flexDirection: 'row'` and `wrap={false}`
- The badge must have a fixed width/height and `flexShrink: 0` so it never compresses
- The text must be wrapped in an inner `<View style={{ flex: 1 }}>` so it takes
  all remaining row width and allows the `<Text>` inside to wrap naturally
- Do NOT put the `<Text>` directly as a sibling of the badge with no flex wrapper —
  this is what caused the overflow in the previous session

---

## Fix 2 — Wrong circle color

**Root cause:** The previous session used `#D97706` (amber) based on an incorrect
assumption in the prompt. The original BBQ template used a dark charcoal color
for step badges.

**Required action:**
1. Read the BBQ template's color palette from the actual code — do not use any color
   from this prompt or from memory. The correct color is already defined in the file.
2. Use that existing dark/charcoal color as the badge background fill.
3. The circle style must match what the badges looked like before session
   PDF-STEP-BADGE-FIX was run. If unsure, check git history for the original
   step number color used in the template before the badge component existed.

---

## StepBadge component — final required structure

The component from the previous session used `View` + `Text` primitives (not SVG).
Keep that approach — it works correctly in react-pdf. Only fix the color and ensure
the badge has explicit fixed dimensions with `flexShrink: 0`:

```tsx
const StepBadge = ({ number }: { number: number }) => (
  <View
    style={{
      width: 22,
      height: 22,
      borderRadius: 11,
      backgroundColor: CORRECT_DARK_COLOR, // read from the file — do not hardcode here
      alignItems: 'center',
      justifyContent: 'center',
      flexShrink: 0,
    }}
  >
    <Text style={{ color: 'white', fontSize: 11, fontFamily: 'Helvetica-Bold' }}>
      {String(number)}
    </Text>
  </View>
);
```

Replace `CORRECT_DARK_COLOR` with the actual color read from the template file in pre-flight.

---

## Constraints

- Do NOT touch any file other than `apps/web/lib/pdf-templates/bbq.tsx`
- Do NOT change any other aspect of the BBQ template — only the StepBadge component
  and the step row flex layout
- Do NOT reintroduce emoji or icon font characters (publishing.md PATTERN 10)
- Do NOT use SVG primitives — the View + Text approach from the previous session is correct
- Do NOT use `fontStyle: 'italic'` on Inter (publishing.md PATTERN 11)
- Do NOT touch any mobile files

---

## Testing

### Manual verification — complete ALL steps before deploying

**Step 1 — Text wrapping**
1. Open a cookbook in the canvas editor using the BBQ template
2. Open the FlipbookPreview
3. Find a recipe with at least one step that is two or more sentences long
4. Confirm the step text wraps to multiple lines within the page column
5. Confirm no step text runs off the edge of the page
6. Confirm each step badge sits aligned to the top of its step text (not centered vertically)

**Step 2 — Circle color**
1. Confirm the step badge circles are dark/charcoal — not amber, not red, not green
2. Confirm the color matches the original BBQ template aesthetic
3. Confirm white numbers are readable against the dark background

**Step 3 — Full page check**
1. Scroll through a full recipe in the BBQ template at Letter (8.5×11) size
2. Confirm step badges and text are consistent across all steps
3. Confirm no layout regression on ingredients, header, or FillZone sections
4. Switch to Square (8×8) and confirm text still wraps correctly at the narrower width
5. Confirm no step text overlaps the next step at either page size

### Checklist — do not deploy until all pass

- [ ] Step text wraps correctly at Letter size — no text runs off the edge
- [ ] Step text wraps correctly at Square (8×8) — no text runs off the edge
- [ ] Step badge circles are dark/charcoal — not amber
- [ ] White numbers are readable inside the circles
- [ ] Badge aligns to top of multi-line step text
- [ ] No regression on ingredients, header, or FillZone
- [ ] `npx tsc --noEmit` passes with 0 errors
- [ ] Deployed to RPi5 — HTTP 200 on https://chefsbk.app
- [ ] PM2 logs show no startup errors

### psql — no DB changes in this session

No database changes. Do not run migrations. Do not restart supabase-rest.

---

## Deploy

Follow `deployment.md` exactly.

```bash
ssh rasp@rpi5-eth
/mnt/chefsbook/deploy-staging.sh
```

Verify:

```bash
curl -I https://chefsbk.app/
# Expect: HTTP 200

pm2 logs chefsbook-web --lines 30
# Expect: no startup errors
```

---

## Wrapup

Follow `wrapup.md` fully.

In DONE.md, record:
- The two regressions introduced by PDF-STEP-BADGE-FIX and how each was corrected
- The exact dark color used for the badge background (so it is on record)
- Which flex properties fixed the text wrapping issue

In `.claude/agents/publishing.md`, update PATTERN 10 to add:
- The correct StepBadge structure (View + fixed dimensions + flexShrink: 0 + inner
  View with flex: 1 wrapping the Text) as the established pattern for BBQ step badges
- A note that the text container MUST be wrapped in `<View style={{ flex: 1 }}>` —
  placing Text directly as a sibling of the badge causes overflow
- The correct dark color for the badge background
