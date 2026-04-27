# Prompt: Web Search — Filter Counts + Scrollable Sections
# Model: Sonnet
# Launch: Read docs/prompts/prompt-search-filter-polish.md and execute fully.

---

## MANDATORY PRE-FLIGHT

Read these before touching anything:
- CLAUDE.md
- docs/agents/testing.md
- docs/agents/deployment.md
- docs/agents/ui-guardian.md

Codebase audit:
- apps/web/app/dashboard/search/ — read the full directory
- Find the search filter component (likely a FilterPanel or similar)
- Find where tag counts are currently computed — replicate that pattern
- Find the search RPC or API route that powers the filter data

---

## SCOPE — TWO CHANGES

1. Recipe counts `(N)` on all filter category items, not just tags
2. Scrollable sections with max-height on all filter categories that can grow long

---

## CHANGE 1 — Recipe Counts on All Filter Sections

**Current state:** Tags shows counts — e.g. `Italian (23)`, `Quick (14)`.
All other sections (Cuisine, Course, Source, Technique, Cook Time) show
labels only with no count.

**What to add:** Every filter item in every section shows the count of recipes
in the current user's visible collection that have that value.

Target sections:
- Cuisine — e.g. `Italian (23)`, `French (8)`, `Japanese (14)`
- Course — e.g. `Dinner (41)`, `Breakfast (12)`, `Dessert (19)`
- Source — e.g. `URL Import (34)`, `Scanned (12)`, `Manual (6)`
- Technique — e.g. `Sous Vide (4)`, `Braising (11)`
- Cook Time — e.g. `Under 30 min (28)`, `30–60 min (19)`
- Tags — already working, verify it stays correct ✓

**Data source:**
Read how tag counts are currently fetched. Use the same pattern for the
other sections. This is likely one of:
- A `GROUP BY` query on the recipes table
- An RPC function that returns counts per category
- Computed client-side from the fetched recipe list

Whichever pattern exists — extend it to cover all sections. Do NOT introduce
a separate DB query per section — batch them efficiently.

**Display:**
- Count in muted/secondary colour after the label: `Italian (23)`
- If count is 0: hide the item entirely (don't show `Obscure Cuisine (0)`)
- If count data is loading: show label without count (graceful degradation)

---

## CHANGE 2 — Scrollable Sections

**Current state:** Tags section has a max-height with overflow scroll.
Other sections (especially Cuisine) can grow very long and push content
far down the filter panel.

**What to add:** All filter sections get a consistent max-height + scroll.

Rules:
- Max-height: match whatever Tags currently uses, or set to show ~8 items
  before scrolling kicks in (approximately 8 × item height)
- Thin scrollbar (existing Tags scrollbar style)
- Section header (e.g. "Cuisine") stays pinned above the scrollable list —
  only the items scroll, not the header
- Applies to: Cuisine, Course, Source, Technique, Tags, Cook Time
- Nutrition filters (added in Nutrition-3) should also get this treatment
  if they are in list form

**Important:** Do not change the Tags section scrolling behaviour if it
already works correctly — match it, don't replace it.

---

## GUARDRAILS

- Do not change any filter logic — only display (counts + scroll)
- Do not change the search RPC unless extending it for count data
- Existing search behaviour must be identical — this is purely visual polish
- If counts require a new DB query, it must be efficient (single query,
  not N+1 per section)
- Do not change mobile files

---

## VERIFICATION

```bash
cd apps/web && npx tsc --noEmit
```

Live checks at https://chefsbk.app/dashboard/search:
1. Open search filter panel → Cuisine shows counts next to each item ✓
2. Cuisine list is scrollable when it has more than ~8 items ✓
3. Course, Source, Technique, Cook Time all show counts ✓
4. Tags still shows counts (no regression) ✓
5. Filter items with 0 recipes are hidden ✓
6. Applying a filter still works correctly (counts are display-only) ✓
7. Section headers stay pinned when scrolling within a section ✓

---

## DEPLOYMENT
Follow deployment.md. Build on RPi5, PM2 restart, smoke test.

---

## WRAPUP REQUIREMENT

DONE.md entry (prefix `[SESSION SEARCH-FILTER-POLISH]`) must include:
- How counts are fetched (query pattern used)
- Which sections now show counts (list them)
- Confirmed scroll behaviour on long sections
- tsc clean confirmed
- Deploy confirmed: HTTP 200
