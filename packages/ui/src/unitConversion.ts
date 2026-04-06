import type { UnitSystem } from './languages';

interface ConversionResult {
  quantity: number;
  unit: string;
}

// Volume conversions (imperial → metric)
const VOLUME_TO_METRIC: Record<string, { factor: number; unit: string }> = {
  'fl oz': { factor: 29.5735, unit: 'ml' },
  'cup':   { factor: 236.588, unit: 'ml' },
  'cups':  { factor: 236.588, unit: 'ml' },
  'tbsp':  { factor: 14.7868, unit: 'ml' },
  'tsp':   { factor: 4.92892, unit: 'ml' },
  'tablespoon':  { factor: 14.7868, unit: 'ml' },
  'tablespoons': { factor: 14.7868, unit: 'ml' },
  'teaspoon':    { factor: 4.92892, unit: 'ml' },
  'teaspoons':   { factor: 4.92892, unit: 'ml' },
};

// Volume conversions (metric → imperial)
const VOLUME_TO_IMPERIAL: Record<string, { factor: number; unit: string }> = {
  'ml':    { factor: 1 / 236.588, unit: 'cup' },
  'milliliter':  { factor: 1 / 236.588, unit: 'cup' },
  'milliliters': { factor: 1 / 236.588, unit: 'cup' },
  'l':     { factor: 1000 / 236.588, unit: 'cup' },
  'liter':  { factor: 1000 / 236.588, unit: 'cup' },
  'liters': { factor: 1000 / 236.588, unit: 'cup' },
};

// Weight conversions (imperial → metric)
const WEIGHT_TO_METRIC: Record<string, { factor: number; unit: string }> = {
  'oz':     { factor: 28.3495, unit: 'g' },
  'ounce':  { factor: 28.3495, unit: 'g' },
  'ounces': { factor: 28.3495, unit: 'g' },
  'lb':     { factor: 453.592, unit: 'g' },
  'lbs':    { factor: 453.592, unit: 'g' },
  'pound':  { factor: 453.592, unit: 'g' },
  'pounds': { factor: 453.592, unit: 'g' },
};

// Weight conversions (metric → imperial)
const WEIGHT_TO_IMPERIAL: Record<string, { factor: number; unit: string }> = {
  'g':     { factor: 1 / 28.3495, unit: 'oz' },
  'gram':  { factor: 1 / 28.3495, unit: 'oz' },
  'grams': { factor: 1 / 28.3495, unit: 'oz' },
  'kg':     { factor: 1000 / 453.592, unit: 'lb' },
  'kilogram':  { factor: 1000 / 453.592, unit: 'lb' },
  'kilograms': { factor: 1000 / 453.592, unit: 'lb' },
};

function smartRound(n: number): number {
  if (n >= 100) return Math.round(n);
  if (n >= 10) return Math.round(n * 10) / 10;
  if (n >= 1) return Math.round(n * 100) / 100;
  return Math.round(n * 100) / 100;
}

function isImperialUnit(unit: string): boolean {
  const lower = unit.toLowerCase();
  return lower in VOLUME_TO_METRIC || lower in WEIGHT_TO_METRIC;
}

function isMetricUnit(unit: string): boolean {
  const lower = unit.toLowerCase();
  return lower in VOLUME_TO_IMPERIAL || lower in WEIGHT_TO_IMPERIAL;
}

/**
 * Convert an ingredient's quantity and unit to the target measurement system.
 * Returns unchanged if the unit is not convertible (e.g. "clove", "bunch").
 */
export function convertIngredient(
  quantity: number | null,
  unit: string | null,
  targetSystem: UnitSystem,
): ConversionResult {
  if (quantity === null || !unit) return { quantity: quantity ?? 0, unit: unit ?? '' };

  const lower = unit.toLowerCase();

  if (targetSystem === 'metric') {
    // Convert imperial → metric
    const vol = VOLUME_TO_METRIC[lower];
    if (vol) {
      let result = quantity * vol.factor;
      let resultUnit = vol.unit;
      // Upgrade ml to L if >= 1000
      if (resultUnit === 'ml' && result >= 1000) {
        result = result / 1000;
        resultUnit = 'L';
      }
      return { quantity: smartRound(result), unit: resultUnit };
    }
    const wt = WEIGHT_TO_METRIC[lower];
    if (wt) {
      let result = quantity * wt.factor;
      let resultUnit = wt.unit;
      // Upgrade g to kg if >= 1000
      if (resultUnit === 'g' && result >= 1000) {
        result = result / 1000;
        resultUnit = 'kg';
      }
      return { quantity: smartRound(result), unit: resultUnit };
    }
  } else {
    // Convert metric → imperial
    const vol = VOLUME_TO_IMPERIAL[lower];
    if (vol) {
      let result = quantity * vol.factor;
      let resultUnit = vol.unit;
      // Use tbsp for small amounts < 0.25 cup
      if (resultUnit === 'cup' && result < 0.25) {
        result = quantity / 14.7868;
        resultUnit = 'tbsp';
        if (result < 1) {
          result = quantity / 4.92892;
          resultUnit = 'tsp';
        }
      }
      return { quantity: smartRound(result), unit: resultUnit };
    }
    const wt = WEIGHT_TO_IMPERIAL[lower];
    if (wt) {
      let result = quantity * wt.factor;
      let resultUnit = wt.unit;
      // Upgrade oz to lb if >= 16
      if (resultUnit === 'oz' && result >= 16) {
        result = result / 16;
        resultUnit = 'lb';
      }
      return { quantity: smartRound(result), unit: resultUnit };
    }
  }

  // No conversion — return unchanged
  return { quantity, unit };
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
