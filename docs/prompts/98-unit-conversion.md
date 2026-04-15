# ChefsBook — Session 98: Wire Metric/Imperial Unit Conversion
# Source: Gap identified in session 94 — toggle saves to DB but never applies conversions
# Target: apps/web + apps/mobile

---

## CONTEXT

Read CLAUDE.md, DONE.md, feature-registry.md, and ALL mandatory agents
per SESSION START sequence.

The kg/lb toggle exists in the web sidebar and mobile header and saves the
user's preference to DB via preferencesStore. However the preference is never
actually applied to displayed quantities. This session wires it end-to-end.

IMPORTANT: unit conversion logic lives ONLY in packages/ui/src/unitConversion.ts
Never duplicate conversion logic in app code — always import from there.

CRITICAL RULES — NO EXCEPTIONS:
- Unit conversion is pure math — it NEVER calls the Claude API or any AI service
- All conversion happens client-side in useMemo hooks using unitConversion.ts
- Never put math or conversion logic inline in JSX/TSX templates
- The template only renders pre-computed display values: {displayAmount} {displayUnit}
- Pattern to follow in every component:

  const { isMetric } = usePreferencesStore()
  const displayIngredients = useMemo(() =>
    ingredients.map(ing => convertIngredientAmount(ing.amount, ing.unit, isMetric)),
    [ingredients, isMetric]
  )
  // template just renders displayIngredients — no math whatsoever
If unitConversion.ts is missing functions needed below, add them there first.

---

## STEP 1 — Audit unitConversion.ts

Read packages/ui/src/unitConversion.ts fully. Confirm it has:

- convertIngredientAmount(amount, unit, toMetric: boolean) → { amount, unit }
- A full unit ladder for both directions:
  - Imperial → Metric: oz→g, lb→kg, fl oz→ml, cup→ml, tsp→ml, tbsp→ml
  - Metric → Imperial: g→oz or lb, ml→fl oz or cup, kg→lb
- Dry ingredient classification (flour, sugar etc convert to weight not volume)
- Fraction formatting for display (1/2, 1/4 etc)
- abbreviateUnit() for display (tsp, tbsp, cup etc)

Add any missing functions. Do not change existing function signatures.

---

## STEP 2 — Web: Recipe detail ingredient display

In apps/web, find where recipe ingredients are rendered in recipe detail
(read mode, not edit mode).

For each ingredient quantity + unit:
- Read the user's unit preference from preferencesStore or user_profiles
  (isMetric: boolean)
- Pass through convertIngredientAmount(amount, unit, isMetric)
- Display the converted amount + unit
- Conversion is display-only — never write converted values back to DB
- Quantities stored in DB are always in their original units

The conversion must react to toggle changes without page reload —
use the store's reactive state so flipping the toggle instantly
updates all ingredient quantities on screen.

---

## STEP 3 — Web: Shopping list quantity display

In apps/web/app/dashboard/shop/, find where shopping list item quantities
are displayed.

Apply the same conversion:
- Read isMetric from preferencesStore
- Convert each item's quantity + unit via convertIngredientAmount()
- Display converted values
- Reactive to toggle — flipping kg/lb updates all quantities instantly
- Never write converted values to DB

---

## STEP 4 — Mobile: Recipe detail ingredient display

Same as Step 2 but in apps/mobile.
- Read isMetric from preferencesStore (Zustand)
- Convert via convertIngredientAmount() from packages/ui
- Display converted values reactively
- Never hardcode hex — use useTheme().colors for any styling

---

## STEP 5 — Mobile: Shopping list quantity display

Same as Step 3 but in apps/mobile/(tabs)/shop.tsx and related components.

---

## STEP 6 — Verify the toggle itself

Confirm the kg/lb toggle in the web sidebar and mobile header:
- Reads current isMetric state from preferencesStore
- Writes new value to preferencesStore AND syncs to user_profiles in DB
- The toggle label shows the CURRENT unit (kg when metric, lb when imperial)
- Flipping it triggers instant re-render of all converted quantities

---

## STEP 7 — Update feature-registry.md

Change Metric/Imperial toggle status from PARTIAL → LIVE.
Add note: "unitConversion.ts in packages/ui — display-only, never writes to DB"

---

## DEPLOYMENT

```bash
ssh rasp@rpi5-eth
cd /mnt/chefsbook/repo
git pull
cd apps/web
rm -rf node_modules/react node_modules/react-dom .next
NODE_OPTIONS=--max-old-space-size=1024 npm run build 2>&1 | tail -20
pm2 restart chefsbook-web
```

Only restart PM2 if build exits with code 0.

---

## COMPLETION CHECKLIST

- [ ] unitConversion.ts has all required functions (both directions, dry/wet classification)
- [ ] Web recipe detail: ingredients display in user's preferred units
- [ ] Web recipe detail: toggle flip updates quantities instantly without reload
- [ ] Web shopping list: quantities display in user's preferred units
- [ ] Web shopping list: toggle flip updates quantities instantly
- [ ] Mobile recipe detail: same conversion + reactive toggle
- [ ] Mobile shopping list: same conversion + reactive toggle
- [ ] Toggle label reflects current unit (kg or lb)
- [ ] Converted values never written to DB — always display-only
- [ ] feature-registry.md updated: Metric/Imperial → LIVE
- [ ] tsc --noEmit passes both apps
- [ ] Deployed to RPi5
- [ ] Run /wrapup
