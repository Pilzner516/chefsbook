import type { UnitSystem } from './languages';

interface ConversionResult {
  quantity: number;
  unit: string;
  warning?: string;
}

// ── Unit abbreviation ──

const UNIT_ABBREV: Record<string, string> = {
  'teaspoon': 'tsp', 'teaspoons': 'tsp',
  'tablespoon': 'Tbsp', 'tablespoons': 'Tbsp',
  'fluid ounce': 'fl oz', 'fluid ounces': 'fl oz',
  'cup': 'cup', 'cups': 'cups',
  'ounce': 'oz', 'ounces': 'oz',
  'pound': 'lb', 'pounds': 'lb',
  'gram': 'g', 'grams': 'g',
  'kilogram': 'kg', 'kilograms': 'kg',
  'milliliter': 'ml', 'milliliters': 'ml',
  'liter': 'L', 'liters': 'L',
};

function abbrevUnit(unit: string): string {
  return UNIT_ABBREV[unit.toLowerCase()] ?? unit;
}

// ── Dry ingredient detection ──

const LIQUID_KEYWORDS = [
  'milk', 'water', 'oil', 'juice', 'stock', 'broth', 'cream',
  'wine', 'vinegar', 'sauce', 'syrup', 'extract', 'liqueur',
  'beer', 'rum', 'brandy', 'whiskey', 'vodka', 'buttermilk',
  'coconut milk', 'almond milk', 'soy milk', 'oat milk',
  'lemon juice', 'lime juice', 'orange juice',
];

const DRY_KEYWORDS = [
  'flour', 'sugar', 'salt', 'pepper', 'spice', 'butter',
  'powder', 'starch', 'cocoa', 'yeast', 'baking', 'breadcrumb',
  'oat', 'rice', 'pasta', 'seed', 'nut', 'cheese', 'zest',
  'cinnamon', 'nutmeg', 'paprika', 'cumin', 'oregano', 'thyme',
  'basil', 'parsley', 'garlic', 'onion', 'ginger',
  'chocolate', 'pearl sugar', 'brown sugar', 'icing sugar',
  'cornstarch', 'cornmeal', 'semolina', 'polenta',
];

const IMPERIAL_VOLUME_UNITS = new Set(['cup', 'cups', 'tbsp', 'tsp', 'tablespoon', 'tablespoons', 'teaspoon', 'teaspoons', 'fl oz', 'fluid ounce', 'fluid ounces']);
const METRIC_VOLUME_UNITS = new Set(['ml', 'milliliter', 'milliliters', 'l', 'liter', 'liters', 'cl']);
const IMPERIAL_WEIGHT_UNITS = new Set(['oz', 'ounce', 'ounces', 'lb', 'lbs', 'pound', 'pounds']);
const METRIC_WEIGHT_UNITS = new Set(['g', 'gram', 'grams', 'kg', 'kilogram', 'kilograms']);

function isLiquidIngredient(ingredientName: string): boolean {
  const lower = ingredientName.toLowerCase();
  return LIQUID_KEYWORDS.some((kw) => lower.includes(kw));
}

function isDryIngredient(ingredientName: string): boolean {
  const lower = ingredientName.toLowerCase();
  return DRY_KEYWORDS.some((kw) => lower.includes(kw));
}

// ── Ladders ──

function applyMetricLiquidLadder(ml: number): { quantity: number; unit: string } {
  if (ml >= 1000) return { quantity: smartRound(ml / 1000), unit: 'L' };
  if (ml >= 1) return { quantity: Math.round(ml), unit: 'ml' };
  return { quantity: smartRound(ml), unit: 'ml' };
}

function applyImperialLiquidLadder(ml: number): { quantity: number; unit: string } {
  const cups = ml / 236.588;
  if (cups >= 4) {
    const qt = cups / 4;
    return { quantity: smartRound(qt), unit: 'qt' };
  }
  if (cups >= 0.25) return { quantity: smartRound(cups), unit: 'cup' };

  const tbsp = ml / 14.7868;
  if (tbsp >= 1) return { quantity: smartRound(tbsp), unit: 'Tbsp' };

  const tsp = ml / 4.92892;
  return { quantity: smartRound(tsp), unit: 'tsp' };
}

function applyMetricWeightLadder(g: number): { quantity: number; unit: string } {
  if (g >= 1000) return { quantity: smartRound(g / 1000), unit: 'kg' };
  return { quantity: Math.round(g), unit: 'g' };
}

function applyImperialWeightLadder(oz: number): { quantity: number; unit: string } {
  if (oz >= 16) return { quantity: smartRound(oz / 16), unit: 'lb' };
  return { quantity: smartRound(oz), unit: 'oz' };
}

function smartRound(n: number): number {
  if (n >= 100) return Math.round(n);
  if (n >= 10) return Math.round(n * 10) / 10;
  if (n >= 1) return Math.round(n * 100) / 100;
  return Math.round(n * 100) / 100;
}

// ── Unit → ml/g base conversions ──

const TO_ML: Record<string, number> = {
  'ml': 1, 'milliliter': 1, 'milliliters': 1,
  'cl': 10,
  'l': 1000, 'liter': 1000, 'liters': 1000,
  'fl oz': 29.5735, 'fluid ounce': 29.5735, 'fluid ounces': 29.5735,
  'cup': 236.588, 'cups': 236.588,
  'tbsp': 14.7868, 'tablespoon': 14.7868, 'tablespoons': 14.7868,
  'tsp': 4.92892, 'teaspoon': 4.92892, 'teaspoons': 4.92892,
};

const TO_GRAMS: Record<string, number> = {
  'g': 1, 'gram': 1, 'grams': 1,
  'kg': 1000, 'kilogram': 1000, 'kilograms': 1000,
  'oz': 28.3495, 'ounce': 28.3495, 'ounces': 28.3495,
  'lb': 453.592, 'lbs': 453.592, 'pound': 453.592, 'pounds': 453.592,
};

/**
 * Convert an ingredient's quantity and unit to the target measurement system.
 * Everything converts — metric shows ml/L and g/kg, imperial shows tsp/Tbsp/cup and oz/lb.
 */
export function convertIngredient(
  quantity: number | null,
  unit: string | null,
  targetSystem: UnitSystem,
  ingredientName?: string,
): ConversionResult {
  if (quantity === null || !unit) return { quantity: quantity ?? 0, unit: unit ?? '' };

  const lower = unit.toLowerCase();
  const isImperialVolume = IMPERIAL_VOLUME_UNITS.has(lower);
  const isMetricVolume = METRIC_VOLUME_UNITS.has(lower);
  const isImperialWeight = IMPERIAL_WEIGHT_UNITS.has(lower);
  const isMetricWeight = METRIC_WEIGHT_UNITS.has(lower);

  // ── Already in the target system → abbreviate and return ──
  if (targetSystem === 'imperial' && (isImperialVolume || isImperialWeight)) {
    return { quantity, unit: abbrevUnit(unit) };
  }
  if (targetSystem === 'metric' && (isMetricVolume || isMetricWeight)) {
    // Apply ladder for metric (e.g. 1000ml → 1L, 1000g → 1kg)
    if (isMetricVolume) {
      const ml = quantity * (TO_ML[lower] ?? 1);
      return applyMetricLiquidLadder(ml);
    }
    if (isMetricWeight) {
      const g = quantity * (TO_GRAMS[lower] ?? 1);
      return applyMetricWeightLadder(g);
    }
    return { quantity, unit: abbrevUnit(unit) };
  }

  // ── Volume conversions (cross-system) ──
  if (lower in TO_ML) {
    const ml = quantity * TO_ML[lower]!;
    if (targetSystem === 'metric') {
      // Dry ingredients convert to weight (g/kg) instead of volume (ml/L)
      const name = ingredientName ?? '';
      if (isDryIngredient(name) && !isLiquidIngredient(name)) {
        // Approximate: 1 cup ≈ 125g for flour-like, 1 Tbsp ≈ 8g, 1 tsp ≈ 3g
        // Use ml value as a proxy (ml ≈ grams for water density; close enough for dry goods)
        return applyMetricWeightLadder(Math.round(ml));
      }
      return applyMetricLiquidLadder(ml);
    } else {
      return applyImperialLiquidLadder(ml);
    }
  }

  // ── Weight conversions (cross-system) ──
  if (lower in TO_GRAMS) {
    const g = quantity * TO_GRAMS[lower]!;
    if (targetSystem === 'metric') {
      return applyMetricWeightLadder(g);
    } else {
      const oz = g / 28.3495;
      return applyImperialWeightLadder(oz);
    }
  }

  // No conversion (pinch, clove, bunch, etc.) — return unchanged but abbreviate
  return { quantity, unit: abbrevUnit(unit) };
}

/**
 * Convert temperatures in step text.
 * Shows both systems: "180°C (356°F)" or "350°F (177°C)"
 */
export function convertTemperatureInText(text: string, targetSystem: UnitSystem): string {
  return text.replace(/(\d+)\s*°\s*([FC])/g, (match, temp, scale) => {
    const n = parseInt(temp, 10);
    if (targetSystem === 'metric' && scale === 'F') {
      const celsius = Math.round((n - 32) * 5 / 9);
      return `${celsius}°C (${n}°F)`;
    }
    if (targetSystem === 'imperial' && scale === 'C') {
      const fahrenheit = Math.round(n * 9 / 5 + 32);
      return `${fahrenheit}°F (${n}°C)`;
    }
    return match;
  });
}
