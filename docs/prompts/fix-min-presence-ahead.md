# Prompt: Fix minPresenceAhead + Commit Phase 1 Complete

## LAUNCH PROMPT (paste this into Claude Code to start the session)

```
Read and execute docs/prompts/fix-min-presence-ahead.md fully and autonomously, from pre-flight through deployment and /wrapup. Do not stop for questions unless you hit a genuine blocker.
```

---

## TYPE: CODE FIX — WEB ONLY

## Overview

Phase 1 is 95% done. One remaining issue: on page boundaries at Square (8×8),
a step that starts near the bottom of a page overflows into the next step instead
of being pushed to the next page. The fix is increasing `minPresenceAhead` from
40 to 100 on all step row Views across all six templates.

This is a one-line fix per template. Six templates. Deploy. Verify. Done.
Phase 2 starts immediately after this session wraps.

---

## Agent files to read

- `.claude/agents/wrapup.md`
- `.claude/agents/deployment.md`

---

## Pre-flight

```bash
grep -rn "minPresenceAhead" apps/web/lib/pdf-templates/trattoria.tsx \
  apps/web/lib/pdf-templates/bbq.tsx \
  apps/web/lib/pdf-templates/garden.tsx \
  apps/web/lib/pdf-templates/nordic.tsx \
  apps/web/lib/pdf-templates/studio.tsx \
  apps/web/lib/pdf-templates/heritage.tsx
```

Record every occurrence. Confirm all are on individual step row Views (not section
containers). Then run `npx tsc --noEmit` and record baseline error count.

---

## The fix

Change `minPresenceAhead={40}` to `minPresenceAhead={100}` on every step row
View across all six templates.

```bash
sed -i 's/minPresenceAhead={40}/minPresenceAhead={100}/g' \
  apps/web/lib/pdf-templates/trattoria.tsx \
  apps/web/lib/pdf-templates/bbq.tsx \
  apps/web/lib/pdf-templates/garden.tsx \
  apps/web/lib/pdf-templates/nordic.tsx \
  apps/web/lib/pdf-templates/studio.tsx \
  apps/web/lib/pdf-templates/heritage.tsx
```

Verify the change took:

```bash
grep -rn "minPresenceAhead" apps/web/lib/pdf-templates/trattoria.tsx \
  apps/web/lib/pdf-templates/bbq.tsx \
  apps/web/lib/pdf-templates/garden.tsx \
  apps/web/lib/pdf-templates/nordic.tsx \
  apps/web/lib/pdf-templates/studio.tsx \
  apps/web/lib/pdf-templates/heritage.tsx
```

All occurrences must show `minPresenceAhead={100}`.

---

## Constraints

- Touch ONLY the six template files — nothing else
- Only change `minPresenceAhead` values — nothing else in the templates

---

## Checklist

- [ ] All `minPresenceAhead` values changed to 100 in all 6 templates
- [ ] `npx tsc --noEmit` passes with 0 errors
- [ ] Deployed to RPi5 — HTTP 200
- [ ] PM2 online

---

## Deploy

```bash
ssh rasp@rpi5-eth
/mnt/chefsbook/deploy-staging.sh
```

---

## Wrapup

Follow `wrapup.md` fully.

In DONE.md record as PHASE1-MINPRESENCE:
- Changed minPresenceAhead from 40 to 100 on step rows in all 6 templates
- Prevents steps from starting at the bottom of a page and overflowing at Square (8×8)
- Phase 1 is now COMPLETE
- Phase 2 (admin-template-dashboard.md) is ready to run immediately

In `docs/prompts/template-system-design.md` mark Phase 1 as COMPLETE.
In AGENDA.md note that Phase 2 is the next session to run.
