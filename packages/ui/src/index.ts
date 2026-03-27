import React from 'react';

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

export function groupBy<T>(items: T[], key: (item: T) => string | null): Record<string, T[]> {
  const groups: Record<string, T[]> = {};
  for (const item of items) {
    const k = key(item) ?? 'Other';
    (groups[k] ??= []).push(item);
  }
  return groups;
}
