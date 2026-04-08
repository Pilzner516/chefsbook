# ChefsBook — Session: Fix Duplicate Button → Save a Copy
# Source: UI review screenshots 2026-04-07
# Target: apps/mobile

---

## CONTEXT

The recipe detail action bar currently shows a copy/duplicate icon (circled in the screenshot).
This needs to be removed from the action bar and replaced with a "Save a Copy" option inside
the recipe edit menu. No new buttons are needed in the header — adding new recipes is already
handled by the Scan tab.

Read CLAUDE.md and the navigator agent map before starting.

---

## FIX 1 — Remove duplicate/copy icon from the recipe action bar

In the recipe detail screen, locate the action icon row:
heart · share · pin · edit · **[copy/duplicate icon]**

Remove the copy/duplicate icon. The action bar should be exactly:
**heart · share · pin · edit**

Nothing else. Do not move it, rename it, or hide it — delete it from the action bar entirely.

---

## FIX 2 — Add "Save a Copy" to the recipe edit menu

When the user taps the edit (pencil) icon and enters edit mode, or opens the recipe overflow/
options menu, add a "Save a Copy" option:

- **Label:** "Save a Copy"
- **Icon:** `copy-outline` or `documents-outline` from Ionicons
- **Position:** at the bottom of the edit options list, clearly separated from destructive
  actions like Delete
- **Behaviour:** creates a new standalone recipe row in the DB that is an exact duplicate of
  the current recipe — same title (appended with " (Copy)"), same ingredients, steps, notes,
  tags, cuisine, course. The copy is NOT a version (no parent_recipe_id) — it is a fully
  independent recipe the user can then edit freely.
- After saving, navigate to the new copy's recipe detail so the user knows it was created.
- Show a brief toast: "Recipe saved as a copy."

---

## WHAT NOT TO BUILD

- Do NOT add any + button to the recipe detail header
- Do NOT add any new "Add recipe" entry point anywhere — the Scan tab already handles this
- Do NOT confuse "Save a Copy" with "Add version" — a copy is independent, a version has
  a parent link. Both can coexist but serve different purposes.

---

## COMPLETION CHECKLIST

- [ ] Copy/duplicate icon removed from recipe detail action bar
- [ ] Action bar is exactly: heart · share · pin · edit
- [ ] "Save a Copy" option added to edit/options menu
- [ ] Copy creates a fully independent recipe row (no parent_recipe_id)
- [ ] Copied recipe title appended with " (Copy)"
- [ ] After copy, navigates to the new recipe detail
- [ ] Toast confirmation shown
- [ ] No regressions in action bar, edit mode, or version switcher
- [ ] Run `/wrapup` to update DONE.md and CLAUDE.md
