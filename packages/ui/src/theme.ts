/**
 * ChefsBook Trattoria Theme — single source of truth.
 *
 * Both apps import from here:
 *   Mobile  →  apps/mobile/constants/themes.ts re-exports with mobile extras
 *   Web     →  apps/web/tailwind.config.ts maps to cb-* tokens
 */

export const TRATTORIA_COLORS = {
  /** Pomodoro red — accent, active states, purchase units */
  accent: '#ce2b37',
  /** Red soft — tag backgrounds */
  accentSoft: '#fdecea',
  /** Basil green — CTAs, usage amounts, fresh tags */
  accentGreen: '#009246',
  /** Green soft — tag backgrounds */
  accentGreenSoft: '#e8f5ee',
  /** Cream background */
  bgScreen: '#faf7f0',
  /** Darker cream — section backgrounds */
  bgBase: '#f4f0e8',
  /** White cards */
  bgCard: '#ffffff',
  /** Primary body text */
  textPrimary: '#1a1a1a',
  /** Secondary / helper text */
  textSecondary: '#7a6a5a',
  /** Muted labels, placeholders */
  textMuted: '#9a8a7a',
  /** Default borders, dividers */
  borderDefault: '#e8e0d0',
  /** Strong borders, emphasis */
  borderStrong: '#d0c8b8',
} as const;

export type TrattoriaColor = keyof typeof TRATTORIA_COLORS;
