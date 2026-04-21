# ChefsBook — Session 184: Fix Image Regen Bugs
# Target: apps/web (recipe detail, Change Image popup, image delete flow)

---

## CONTEXT

Read CLAUDE.md, DONE.md, .claude/agents/testing.md, .claude/agents/deployment.md,
.claude/agents/image-system.md, .claude/agents/ui-guardian.md, and
.claude/agents/feature-registry.md before starting.
Run all pre-flight checklists.

---

## THREE BUGS TO FIX

### Bug 1 — Regen pills not showing in Change Image popup
The scoped regen pills (wrong_dish, update_scene, brighter, etc.) are not
visible to the user in the Change Image popup. Find out why and fix it.

### Bug 2 — Same image regenerates repeatedly
Triggering regen on the Sicilian Pizza recipe produces the same image every
time despite a random seed being added in session 166. Find out why variation
isn't working and fix it.

### Bug 3 — Deleting AI image reveals original scraped website image
When the AI-generated photo is deleted, the recipe falls back to showing the
original og:image URL from the source website. This was fixed in session 169
but is happening again on recipes imported since then. Find the root cause,
fix the import pipeline so external URLs are never persisted, and ensure no
external URLs remain in the DB.

---

## RULES

- Diagnose each bug before writing any code
- Fix root causes — do not patch symptoms
- Verify each fix is working before moving to the next
- Deploy once all three are confirmed fixed

---

## COMPLETION CHECKLIST

- [ ] Bug 1: Pills visible in Change Image popup
- [ ] Bug 2: Successive regens produce different images
- [ ] Bug 3: Deleting AI image does not reveal external URL
- [ ] Bug 3: Zero external URLs remaining in recipes.image_url
- [ ] Bug 3: Import pipeline cannot persist external og:image URLs going forward
- [ ] tsc --noEmit passes clean
- [ ] Deployed to RPi5 — chefsbk.app HTTP 200
- [ ] Run /wrapup
