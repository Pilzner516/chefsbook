# Prompt: Fix Load More Recipes Duplication Bug (Web Dashboard)

## LAUNCH PROMPT (paste this into Claude Code to start the session)

```
Read and execute docs/prompts/fix-load-more-duplicates.md fully and autonomously, from pre-flight through deployment and /wrapup. Do not stop for questions unless you hit a genuine blocker.
```

---

## TYPE: BUG FIX — WEB ONLY

## Overview

The "Load More Recipes" button on the dashboard duplicates recipes. After clicking it,
users see the same recipe card appearing 2–3 times in the grid. The duplicates clear
when navigating away and back, but always return when "Load More" is clicked again.
This was introduced in session P-217 when the load-more pagination feature was built.

---

## Agent files to read — ALL of these, in order, before writing a single line of code

- `.claude/agents/wrapup.md`
- `.claude/agents/testing.md`
- `.claude/agents/feature-registry.md`
- `.claude/agents/data-flow.md`
- `.claude/agents/deployment.md`

Run ALL pre-flight checklists before writing any code.

---

## Pre-flight: before writing any code

1. Read DONE.md — specifically session P-217 which introduced the load-more feature
2. Find the dashboard recipe list component — likely in `apps/web/app/(app)/dashboard/`
3. Identify every place `setRecipes` (or equivalent Zustand setter) is called
4. Identify the exact state accumulation call when "Load More" is clicked
5. Confirm whether the component uses local `useState` or a Zustand store for the recipe list

---

## Known bug pattern

The duplication happens because recipe state is being seeded with page 1 data on
re-renders, and the load-more handler appends to that already-populated state.
Common root causes in order of likelihood:

1. **`useEffect` re-seeding**: a `useEffect` depending on `initialRecipes` or similar
   prop resets state to page 1 after load-more has already appended page 2, then the
   next load-more click appends page 2 again on top of page 1+2
2. **Zustand store not cleared**: the store retains stale data between renders and the
   append accumulates duplicates
3. **Load-more handler called twice**: double invocation (e.g. from an un-debounced
   button) appends the same page twice

---

## The fix

When appending new recipes in the load-more handler, always deduplicate by `id`:

```ts
setRecipes(prev => {
  const seen = new Set(prev.map(r => r.id));
  return [...prev, ...newRecipes.filter(r => !seen.has(r.id))];
});
```

Additionally:
- Ensure the `useEffect` that initialises recipe state does NOT re-run after load-more
  appends (check its dependency array carefully)
- Ensure the offset/page counter resets correctly when a search query changes
- Ensure the "Load More" button is disabled while a fetch is in-flight to prevent
  double-clicks

---

## Verification

1. Load dashboard — confirm first 50 recipes show with no duplicates
2. Click "Load More Recipes" — confirm next batch appends without any duplicates
3. Click "Load More" a second time if enough recipes exist — confirm still no duplicates
4. Type in the search box — confirm results reset cleanly, no duplicates
5. Clear search — confirm recipes reload from page 1 with no duplicates
6. `npx tsc --noEmit` in `apps/web` — 0 errors

---

## Deploy

Follow `deployment.md`. Deploy web to RPi5 after fix is verified.
Run regression smoke test from `testing.md` before wrapup.

---

## Wrapup

Follow `wrapup.md` fully.
Note the root cause found and fix applied in DONE.md.
