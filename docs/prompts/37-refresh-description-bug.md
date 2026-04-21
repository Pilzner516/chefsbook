# ChefsBook — Session 199: Fix "Cannot read properties of undefined (reading 'description')" on re-import
# Target: apps/web (refresh / re-import path)
# TYPE: CODE FIX (mandatory — per session 187 rule; do NOT data-fix this)

---

## CONTEXT

User (pilzner) re-imported an existing recipe and saw a native browser alert:

> **chefsbk.app says:** Cannot read properties of undefined (reading 'description')

Details from the screenshot:
- Recipe: **Panisses** — source: davidlebovitz.com
- Status: **public**, has photos (1/10), `is_complete=true` (no incomplete banner visible)
- Top-right toolbar had **"Updating…"** pill between Favourite and Delete when the alert fired
- The alert is a **native `window.alert()`**, NOT a ChefsDialog — that alone is a design-system violation per ui-guardian.md

The user's mental model was also informative: they asked "does re-import start from scratch and regenerate images too?" — so the button they clicked implied a re-run, and they expected more than the strict merge our refresh endpoint actually does.

---

## AGENTS TO READ BEFORE WRITING CODE (in this order)

1. `.claude/agents/wrapup.md`
2. `.claude/agents/testing.md` — MANDATORY
3. `.claude/agents/feature-registry.md` — MANDATORY (touching import pipeline)
4. `.claude/agents/deployment.md` — MANDATORY (web session)
5. `.claude/agents/import-pipeline.md`
6. `.claude/agents/import-quality.md`
7. `.claude/agents/ui-guardian.md` (raw `alert()` is in-scope for this agent)

Run every agent's pre-flight checklist. Do not skip.

---

## DIAGNOSE BEFORE FIXING — REPORT ROOT CAUSE FIRST

Three angles. Work them in order. Do NOT write code until all three are reported back to the user.

### Angle 1 — The raw `alert()` is the entry point
Native browser alerts should not exist in this codebase (unified dialog system).
- `grep -rn "alert(" apps/web/app apps/web/components | grep -v "// " | grep -v "AlertDialog"`
- Identify every call site. Cross-reference with which ones handle refresh/import responses.
- The offender IS a handler that consumed a refresh/import response and blindly accessed `.description`.

### Angle 2 — Which button did the user actually click?
**Panisses is complete + public** — so the incomplete-banner is NOT visible, and `RefreshFromSourceBanner` is NOT the trigger.
- Look at `apps/web/app/recipe/[id]/page.tsx` — find every button in the top-right toolbar (Share, Favourite, the "Updating…" pill, Delete)
- What action renders "Updating…"? That is the trigger. Find its onClick handler.
- Candidates to rule in/out: re-run auto-tag, refresh-from-source, regenerate-image, re-moderate, re-translate. Session 189 added fire-and-forget auto-tag. Session 197 touched refresh banner. Session 188 touched regen.

### Angle 3 — Response shape mismatch (the actual null access)
Once the handler is located, trace what it destructures from the response.
- `/api/recipes/refresh` returns `{ ingredientsAdded, stepsAdded, isComplete, missingFields, aiVerdict }` in the 200 branch, and `{ needsBrowserExtraction, domain, reason }` in the 206 branch. **The two shapes have no overlapping keys.** A caller that assumes the 200 shape and hits the 206 branch will blow up.
- `/api/recipes/regenerate-image`, `/api/recipes/auto-tag`, `/api/recipes/check-image` — check their response shapes too, in case this is one of them.
- The missing property is `.description`. Find the access site. It is likely reading something like `result.recipe.description`, `result.data.description`, or `response.description` where the parent is undefined on one branch.

**Pattern recognition:** sessions 195, 197, and 189 all fixed the same class of bug (undefined destructuring / silent drop) in the import/refresh family. This is the 4th instance of the same failure mode. When reporting root cause, note which prior fix the new site is analogous to.

---

## EVIDENCE TO COLLECT AND REPORT

Before any code change, paste back:
1. The exact file:line of the raw `alert()` that fired
2. The exact property expression that threw (e.g. `result.recipe.description`)
3. The name and file of the button/handler the user clicked
4. curl output of the endpoint that handler calls, hit against the live RPi5 for the Panisses recipe with pilzner's JWT, showing the actual response shape
5. Whether the access is in the 200 branch, the 206 branch, or an error branch
6. Which prior session's fix this one is structurally analogous to

---

## FIX GUIDANCE (when user approves the diagnosis)

- Replace the raw `alert()` with `ChefsDialog` via `useConfirmDialog` (per ui-guardian.md).
- Guard the property access at the real source — do not silently fallback to `{}`.
- If response shapes diverge across branches (200 vs 206), **normalize in the route handler**, not in every caller. Returning `{ status: 'ok' | 'needs_extension' | 'error', ...payload }` is acceptable; returning disjoint top-level shapes is the bug.
- CODE FIX only. No data patches.
- While in the file, grep for any other `alert()` calls touched in the same handler and leave a follow-up note in AGENDA.md if more remain (do not expand scope beyond this bug in this session).

---

## VERIFICATION (all four, no shortcuts — per testing.md)

1. **psql on RPi5**: `SELECT id, title, is_complete, source_url FROM recipes WHERE title = 'Panisses' AND user_id = '<pilzner uuid>';` — note the id.
2. **curl** the endpoint identified in Angle 2 against the live Panisses id with pilzner's Bearer token. Capture response. Confirm it no longer causes a client-side undefined access when passed to the handler.
3. **Browser test on chefsbk.app**: load `/recipe/<panisses-id>`, click the button that triggered the error, confirm: no native alert, proper ChefsDialog or success toast shows, top-right pill cycles "Updating…" → done without error.
4. **Negative test**: reproduce with a recipe whose `source_url` is on a Cloudflare-blocked domain (e.g. seriouseats.com per session 194) to exercise the 206 branch. Confirm the handler renders the "install extension" path instead of throwing.

---

## DEPLOYMENT

```bash
ssh rasp@rpi5-eth
cd /mnt/chefsbook/repo
git pull
cd apps/web
rm -rf node_modules/react node_modules/react-dom .next
NODE_OPTIONS=--max-old-space-size=1024 npx next build --no-lint 2>&1 | tail -20
pm2 restart chefsbook-web
```

Build must exit 0 before `pm2 restart`. If build fails, do NOT restart PM2.

---

## COMPLETION CHECKLIST

- [ ] All 7 agents read; pre-flight checklists run
- [ ] Three diagnosis angles reported back to user BEFORE any code change
- [ ] Exact button/handler/file:line of failing access named (not assumed)
- [ ] Raw `alert()` replaced with ChefsDialog
- [ ] Null-guard or response normalization applied at the real source
- [ ] Response shape normalized in route handler if branches diverge
- [ ] curl verification of both 200 and 206 branches for the affected endpoint
- [ ] Browser reproduction no longer triggers native alert
- [ ] Negative test on Cloudflare-blocked source passes
- [ ] `tsc --noEmit` clean in apps/web
- [ ] Deployed to RPi5, chefsbk.app returns HTTP 200, recipe detail page loads
- [ ] DONE.md entry tagged **TYPE: CODE FIX** and references which prior-session pattern this matches (195 / 197 / 189)
- [ ] /wrapup to update DONE.md and CLAUDE.md
