# Prompt: Mobile-5 — Nutrition Search Filters
# Model: OPUS
# Launch: Read docs/prompts/prompt-mobile-5.md and execute fully.

---

## MANDATORY PRE-FLIGHT

Read ALL of these:
- CLAUDE.md
- apps/mobile/CLAUDE.md
- docs/agents/feature-registry.md — find Nutrition-3 (search filters) entry
- docs/agents/testing.md — ADB screenshots mandatory
- docs/agents/ui-guardian.md

**Codebase audit — read before writing anything:**
- apps/web/app/dashboard/search/ — web search with nutrition filters (reference)
- apps/mobile/app/(tabs)/search.tsx (or equivalent) — current mobile search screen
- The search RPC — confirm it already accepts nutrition filter params
  (Nutrition-3 extended it on web):
  ```bash
  ssh rasp@rpi5-eth "sudo docker exec supabase-db psql -U postgres -d postgres \
    -c 'SELECT prosrc FROM pg_proc WHERE proname = '"'"'search_recipes'"'"';'" | head -60
  ```
  Look for calorie_max, protein_min, dietary_preset parameters.

**Launch emulator:**
```bash
emulator -avd Medium_Phone_API_36.1 -no-snapshot -gpu host
```
Navigate to the Search tab. ADB screenshot of current search/filter UI as baseline.

---

## SCOPE

Add nutrition filters to the mobile search screen.
The web has three filter categories — replicate all three on mobile.

---

## FILTERS TO ADD

These match exactly what Nutrition-3 added to web:

**Calories (per serving)**
- Any (default, no filter)
- Under 300
- 300–500
- 500–700
- Over 700

**Protein**
- Any (default)
- High (20g+)
- Medium (10–20g)
- Low (under 10g)

**Dietary Presets** (compound filters)
- Low Carb (carbs_g < 20)
- High Fiber (fiber_g ≥ 5)
- Low Fat (fat_g < 10)
- Low Sodium (sodium_mg < 600)

---

## MOBILE UI DESIGN

Mobile search has limited vertical space. Implement filters as horizontal
scrollable chip rows beneath the search bar, grouped by category.

**Layout:**
```
[Search bar                        ]
[Calories ▾] [Protein ▾] [Diet ▾]   ← category selector chips
[Under 300] [300-500] [500-700] [700+]  ← expanded when tapped
Active filters: [Under 300 ✕] [High Protein ✕]
```

Or use a filter bottom sheet — check how existing filters work on the mobile
search screen and match that pattern exactly. Do not introduce a new UI pattern.

**Filter behaviour:**
- Nutrition filters only show recipes WHERE nutrition IS NOT NULL
- When any nutrition filter is active, show a subtle note:
  "Showing recipes with nutrition data"
- Filters are additive (AND logic)
- Clear All button when any filter is active

---

## API WIRING

The search RPC was extended in Nutrition-3 to accept nutrition params.
The mobile search API call just needs to pass them through.

Find where the mobile search makes its API/RPC call and add the nutrition
filter params alongside the existing filter params:

```typescript
// Add to existing search call params:
calorie_max?: number
calorie_min?: number
protein_min?: number
dietary_preset?: 'low_carb' | 'high_fiber' | 'low_fat' | 'low_sodium'
```

Match the exact parameter names used in the web search call — read
apps/web/app/api/search/ to find them.

---

## GUARDRAILS

- Do not change web files or the search RPC
- Do not redesign the existing search UI — add nutrition filters to it
- Existing search filters (cuisine, course, tags, etc.) must work identically
  after this change
- useTheme().colors always
- All filter chips must have minimum 44px touch targets

---

## TYPESCRIPT CHECK
```bash
cd apps/mobile && npx tsc --noEmit
```

---

## VERIFICATION

Live tests with ADB screenshots:
1. Open search with no nutrition filters → results identical to before ✓
2. Select "Under 300 calories" → only low-calorie recipes appear → ADB screenshot
3. Select "High Protein" → only protein-rich recipes appear → ADB screenshot
4. Select "Low Carb" dietary preset → ADB screenshot
5. Combine calorie + protein → both conditions apply → ADB screenshot
6. "Showing recipes with nutrition data" note visible when filter active
7. Clear All → full results restore

---

## WRAPUP REQUIREMENT

DONE.md entry (prefix `[SESSION MOBILE-5]`) must include:
- ADB screenshot filenames for each filter test above
- Description of how nutrition filters appear in the mobile UI
- Confirmed existing search filters (cuisine, course) still work
- tsc clean confirmed
- MOBILE PARITY COMPLETE: note that Mobile-1 through 5 are done and
  mobile is at parity with web for the nutrition and social feature sets
