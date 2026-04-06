# Unit Conversion Bug Fixes — Ladder + Dry Ingredient Classification
# Save to: docs/prompts/unit-conversion-fix.md

Read CLAUDE.md, apps/mobile/CLAUDE.md and
.claude/agents/navigator.md to orient yourself.

Fix two unit conversion bugs in packages/ui/src/unitConversion.ts

## Bug 1 — Unit ladder (step up at thresholds)
Quantities must step up to larger units when they hit thresholds.
Never show 946ml when it should be ~1L, never show 1000g when it
should be 1kg.

### Metric liquid ladder:
< 1ml      → show as ml (round to 0.1)
1–999ml    → show as ml (round to whole number)
≥ 1000ml   → convert to L (round to 1 decimal)
             e.g. 1000ml → "1 L", 1500ml → "1.5 L"

### Imperial liquid ladder:
< 1 tsp    → show as tsp
1–2 tsp    → tsp
3 tsp      → "1 Tbsp" (3 tsp = 1 Tbsp)
1–15 Tbsp  → Tbsp
16 Tbsp    → "1 cup"
1–3 cups   → cups
4 cups     → "1 qt"
Round to nearest clean fraction where possible.

### Weight ladder:
Metric:
< 1000g    → show as g (round to whole number)
≥ 1000g    → convert to kg (round to 2 decimals)
             e.g. 1000g → "1 kg", 1500g → "1.5 kg"

Imperial:
< 16oz     → show as oz (round to 1 decimal)
≥ 16oz     → convert to lb (round to 1 decimal)
             e.g. 16oz → "1 lb", 24oz → "1.5 lb"

## Bug 2 — Dry ingredients must never use liquid units
Dry/solid ingredients (flour, sugar, salt, spices, butter, etc.)
must NEVER be measured in ml. They must use weight (g/kg or oz/lb)
or appropriate dry volume measures (cups, Tbsp, tsp).

### Fix the classification logic:
Add a isDryIngredient(unit: string, ingredientName: string): boolean
function that checks:

ALWAYS liquid units (ml, l, fl oz, cup for liquids):
- unit is already ml/l/cl → it IS a liquid measurement
- ingredient name contains: milk, water, oil, juice, stock, 
  broth, cream, wine, vinegar, sauce, syrup, extract, liqueur

ALWAYS dry/weight units:
- unit is already g/kg/oz/lb → it IS a weight measurement
- ingredient name contains: flour, sugar, salt, pepper, spice,
  butter, powder, starch, cocoa, yeast, baking, breadcrumb,
  oat, rice, pasta, seed, nut, cheese (grated), zest

### Conversion rules by ingredient type:

LIQUID ingredients (milk, oil, juice etc.):
- Metric: keep as ml/L using liquid ladder above
- Imperial: convert to tsp/Tbsp/cup/fl oz using liquid ladder

DRY ingredients measured by volume (cups, Tbsp, tsp):
- These are recipe volume measures for dry goods
- Metric: KEEP as cups/Tbsp/tsp — do NOT convert to ml
  (a "cup of flour" is a cup of flour in any system)
- Imperial: keep as cups/Tbsp/tsp

DRY ingredients measured by weight (g, kg, oz, lb):
- Metric: show as g/kg using weight ladder
- Imperial: convert to oz/lb using weight ladder

AMBIGUOUS (unit is ml but ingredient seems dry):
- Flag: convertIngredient should detect this and
  keep original unit + quantity unchanged
- Do NOT convert pastry flour, pearl sugar, or any
  obviously dry ingredient from ml to anything
- Log a warning: console.warn('Dry ingredient with liquid unit:', name)

## Implementation

Update convertIngredient() in packages/ui/src/unitConversion.ts:

export function convertIngredient(
  quantity: number,
  unit: string,
  ingredientName: string,
  targetSystem: UnitSystem
): { quantity: number; unit: string; warning?: string }

1. Classify the ingredient as liquid/dry/weight using isDryIngredient()
2. If dry ingredient has liquid unit (ml) → return unchanged + warning
3. Apply correct conversion based on classification
4. Apply unit ladder to step up to cleaner units
5. Format quantity using formatQuantity() for clean fractions

## Update all call sites
In these files, update the convertIngredient() call to pass
ingredientName as the third argument:
- apps/mobile/app/recipe/[id].tsx
- apps/mobile/app/(tabs)/shop.tsx

## Verify with the waffle recipe
The waffle recipe currently shows:
- 237ml milk → should stay 237ml (metric) or 1 cup (imperial) ✓
- 946ml pastry flour → WRONG (dry) → should be unchanged or cups
- 88.7ml brown sugar → WRONG (dry) → should be unchanged or cups
- 237ml pearl sugar → WRONG (dry) → should be unchanged
- 283g butter → correct unit, just needs ladder check
- 12.3ml instant dry yeast → borderline, yeast is dry → keep as tsp

Fix all errors without stopping.
Commit: git add -A && git commit -m "fix: unit conversion ladder + dry ingredient classification"
