import React from 'react';

// Shared theme — single source of truth for both apps
export { TRATTORIA_COLORS } from './theme';
export type { TrattoriaColor } from './theme';

// Shared constants
export { DIETARY_FLAGS, CUISINE_LIST, COURSE_LIST } from './constants';
export { LANGUAGES, PRIORITY_LANGUAGES, SUPPORTED_LANGUAGES } from './languages';
export type { Language, UnitSystem } from './languages';
export { convertIngredient, convertTemperatureInText } from './unitConversion';

// Shared formatting utilities used by both mobile and web apps

export function formatDuration(minutes: number | null | undefined): string {
  if (!minutes) return '';
  if (minutes < 60) return `${minutes}min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m > 0 ? `${h}h ${m}min` : `${h}h`;
}

export function formatServings(servings: number): string {
  return servings === 1 ? '1 serving' : `${servings} servings`;
}

export function scaleQuantity(quantity: number | null, originalServings: number, newServings: number): number | null {
  if (quantity === null || originalServings === 0) return quantity;
  return Math.round((quantity * (newServings / originalServings)) * 100) / 100;
}

export function formatQuantity(quantity: number | null): string {
  if (quantity === null) return '';
  if (Number.isInteger(quantity)) return quantity.toString();

  const fractions: Record<number, string> = {
    0.25: '\u00BC', 0.33: '\u2153', 0.5: '\u00BD',
    0.67: '\u2154', 0.75: '\u00BE',
  };

  const whole = Math.floor(quantity);
  const decimal = Math.round((quantity - whole) * 100) / 100;
  const frac = fractions[decimal];

  if (frac) return whole > 0 ? `${whole}${frac}` : frac;
  return quantity.toFixed(1).replace(/\.0$/, '');
}

export function getInitials(name: string | null | undefined): string {
  if (!name) return '?';
  return name
    .split(' ')
    .map((w) => w[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

export function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength - 1) + '\u2026';
}

// Short abbreviations for shopping list qty column (T, t, c — no space)
const UNIT_SHORT: [RegExp, string][] = [
  [/\bfluid ounces?\b/gi, 'fl oz'],
  [/\btablespoons?\b|\bTbsp\b|\btbsp\b/g, 'T'],
  [/\bteaspoons?\b|\btsp\b/gi, 't'],
  [/\bcups?\b/gi, 'c'],
  [/\bounces?\b|\boz\b/gi, 'oz'],
  [/\bpounds?\b|\blbs?\b/gi, 'lb'],
  [/\bgrams?\b/gi, 'g'],
  [/\bkilograms?\b/gi, 'kg'],
  [/\bmilliliters?\b/gi, 'ml'],
  [/\bliters?\b/gi, 'L'],
  [/\binches?\b/gi, 'in'],
];

// Medium abbreviations for recipe display (Tbsp, tsp, cup — readable)
// Also expands short abbreviations (T, t, c) to medium format
const UNIT_MEDIUM: [RegExp, string][] = [
  [/\bfluid ounces?\b/gi, 'fl oz'],
  [/\btablespoons?\b/gi, 'Tbsp'],
  [/\bteaspoons?\b/gi, 'tsp'],
  [/\bpackages?\b/gi, 'pkg'],
  [/\bpackets?\b/gi, 'pkt'],
  [/\bpieces?\b/gi, 'pc'],
  [/\bounces?\b/gi, 'oz'],
  [/\bpounds?\b/gi, 'lb'],
  [/\bgrams?\b/gi, 'g'],
  [/\bkilograms?\b/gi, 'kg'],
  [/\bmilliliters?\b/gi, 'ml'],
  [/\bliters?\b/gi, 'L'],
  [/\binches?\b/gi, 'in'],
  // Expand short abbreviations to medium
  [/^T$/, 'Tbsp'],
  [/^t$/, 'tsp'],
  [/^c$/, 'cup'],
];

/** Ultra-short units for tight spaces (T, t, c). No space before single-char. */
export function abbreviateUnit(text: string): string {
  let result = text;
  for (const [pattern, replacement] of UNIT_SHORT) {
    result = result.replace(pattern, replacement);
  }
  result = result.replace(/(\d+\.?\d*)\s+([TtcgL])\b/g, '$1$2');
  return result;
}

/** Readable abbreviations for recipe display (Tbsp, tsp, cup). */
export function abbreviateUnitMedium(text: string): string {
  let result = text;
  for (const [pattern, replacement] of UNIT_MEDIUM) {
    result = result.replace(pattern, replacement);
  }
  return result;
}

const STRIP_ADJECTIVES = /\b(very cold|cold|room temperature|warm|hot|melted|softened|frozen|fresh|dried|ground|whole|raw|cooked|toasted|roasted|chopped|diced|minced|sliced|grated|shredded|peeled|pitted|seeded|deveined|trimmed|halved|quartered|roughly|finely|thinly|thickly)\b/gi;

export function cleanIngredientName(name: string): string {
  let result = name;
  // Strip everything after comma (prep notes like "butter, cubed")
  result = result.split(',')[0]!;
  // Strip parenthetical notes like "(480g)"
  result = result.replace(/\([^)]*\)/g, '');
  // Strip prep adjectives but keep item-identity ones
  result = result.replace(STRIP_ADJECTIVES, '');
  // Clean up whitespace
  result = result.replace(/\s+/g, ' ').trim();
  // Capitalize first letter
  if (result.length > 0) result = result.charAt(0).toUpperCase() + result.slice(1);
  return result;
}

export function groupBy<T>(items: T[], key: (item: T) => string | null): Record<string, T[]> {
  const groups: Record<string, T[]> = {};
  for (const item of items) {
    const k = key(item) ?? 'Other';
    (groups[k] ??= []).push(item);
  }
  return groups;
}
