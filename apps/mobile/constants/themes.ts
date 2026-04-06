import { TRATTORIA_COLORS } from '@chefsbook/ui';

export interface ThemeColors {
  accent: string;
  accentGreen: string;
  accentGreenSoft: string;
  accentSoft: string;
  bgScreen: string;
  bgBase: string;
  bgCard: string;
  textPrimary: string;
  textSecondary: string;
  textMuted: string;
  tabBar: string;
  tabActive: string;
  tabInactive: string;
  borderDefault: string;
  borderStrong: string;
  success: string;
  danger: string;
}

export const trattoria: ThemeColors = {
  // Canonical colors from @chefsbook/ui
  ...TRATTORIA_COLORS,
  // Mobile-specific extras
  tabBar: TRATTORIA_COLORS.accent,
  tabActive: '#ffffff',
  tabInactive: 'rgba(255,255,255,0.45)',
  success: TRATTORIA_COLORS.accentGreen,
  danger: TRATTORIA_COLORS.accent,
};
