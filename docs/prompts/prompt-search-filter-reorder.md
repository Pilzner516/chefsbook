# Prompt: Web Search — Dietary Section Fix + Reorderable Filter Sections
# Model: Sonnet
# Launch: Read docs/prompts/prompt-search-filter-reorder.md and execute fully.

---

## MANDATORY PRE-FLIGHT

Read these before touching anything:
- CLAUDE.md
- docs/agents/testing.md
- docs/agents/deployment.md
- docs/agents/ui-guardian.md
- apps/web/app/dashboard/search/ — read the full directory again
- Find where the admin menu drag-and-drop reorder was implemented
  (the user confirmed this exists — find it and use the same pattern)

---

## SCOPE — TWO CHANGES

1. Fix Dietary and Dietary Goals sections to match all other filter sections
2. Allow users to drag-and-drop reorder filter sections, persisted to localStorage

---

## CHANGE 1 — Dietary + Dietary Goals Section Styling Fix

**Problem:** The Dietary and Dietary Goals filter sections have:
- Inconsistent font (different weight/size/family vs other sections)
- No scrollable container (items overflow instead of scrolling)
- Icons are correct — keep them exactly as-is

**Fix:**
- Apply the identical font styles used by Cuisine, Course, Tags etc. to
  the Dietary and Dietary Goals sections
- Wrap their item lists in the same `max-h-[200px] overflow-y-auto` container
  applied to other sections in the previous session
- Section headers stay pinned (same as all other sections)
- Icons stay — only fix font and add scroll container

**Verify by eye:** After fix, Dietary and Dietary Goals should be
visually indistinguishable from Cuisine/Course in terms of typography.
Only difference allowed: the icons (which are intentional).

---

## CHANGE 2 — User-Reorderable Filter Sections

**Concept:** Users can drag filter sections up and down to set their
preferred order. For example, a user who searches by ingredient frequently
can drag "Ingredients" to the top. Order persists across sessions via localStorage.

**Reference:** Find the admin menu drag-and-drop reorder implementation
in the codebase and use the same drag library and pattern. Do not introduce
a new drag library if one is already installed.

### Drag handle
- Small `⠿` or `≡` drag handle icon on the RIGHT side of each section header
- Only visible on hover (desktop) or always visible (mobile-friendly)
- Cursor changes to `grab` on hover over the handle
- Dragging the handle reorders the section

### Section order
Default order (when no preference saved):
1. Cuisine
2. Course  
3. Cook Time
4. Ingredients
5. Technique
6. Source
7. Tags
8. Dietary
9. Dietary Goals
10. Nutrition (Calories / Protein / Dietary Presets — if shown as a group)

### Persistence
- Save order to `localStorage` key `'cb-search-filter-order'`
- Value: array of section keys in the user's preferred order
  e.g. `["ingredients", "cuisine", "course", ...]`
- On load: read from localStorage, fall back to default order if missing/malformed
- "Reset to default order" link at the bottom of the filter panel
  (small, muted — similar to the admin menu reset)

### Drag behaviour
- Sections snap into place — no free-floating (discrete reorder only)
- Visual indicator during drag: dragged section has slight opacity reduction
  and a blue/red highlight on the drop target position
- Animate the reorder smoothly (CSS transition, not jarring)
- Section content (items, counts, scroll) stays fully intact during and after drag

### What does NOT move
- The search bar at the top stays fixed
- Active filter pills stay fixed
- Only the section list below those is reorderable

---

## GUARDRAILS

- Use the existing drag library already in the project — do not add a new one
  (check package.json in apps/web before reaching for anything new)
- If no drag library exists, use the HTML5 drag-and-drop API directly —
  it's sufficient for this use case and adds zero dependencies
- Do not change filter logic, counts, or scroll behaviour from the previous session
- Do not change mobile files
- localStorage key must be namespaced (`cb-` prefix) to avoid collisions

---

## VERIFICATION

```bash
cd apps/web && npx tsc --noEmit
```

Live checks:
1. Dietary section — font matches Cuisine/Course exactly ✓
2. Dietary Goals section — font matches, scrollable ✓
3. Icons still present on Dietary sections ✓
4. Drag handle visible on all section headers ✓
5. Drag "Ingredients" to top → it moves to position 1 ✓
6. Reload page → Ingredients still at top (localStorage persisted) ✓
7. "Reset to default order" → sections return to default order ✓
8. All filter counts still show correctly after reorder ✓
9. All scroll behaviour still works after reorder ✓

---

## DEPLOYMENT
Follow deployment.md. Build on RPi5, PM2 restart, smoke test.

---

## WRAPUP REQUIREMENT

DONE.md entry (prefix `[SESSION SEARCH-FILTER-REORDER]`) must include:
- Dietary fix confirmed (describe what was different and what changed)
- Drag library used (name or "HTML5 native")
- localStorage key confirmed: `cb-search-filter-order`
- Reorder tested: which section was moved, confirmed it persisted on reload
- Reset to default confirmed
- tsc clean confirmed
- Deploy confirmed: HTTP 200
