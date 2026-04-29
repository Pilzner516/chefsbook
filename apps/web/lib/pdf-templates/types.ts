/**
 * Shared types for PDF cookbook templates
 */

import type { BookLocale } from './book-strings';

export type CoverStyle = 'classic' | 'modern' | 'minimal' | 'heritage' | 'nordic' | 'bbq';
export type FillType = 'blank' | 'chefs_notes' | 'quote' | 'decorative' | 'custom';
export type PageSizeKey = 'letter' | 'trade' | 'large-trade' | 'digest' | 'square';

export interface FillContent {
  quoteText?: string;
  quoteAttribution?: string;
  customText?: string;
  customImageUrl?: string;
}

export interface CookbookPdfOptions {
  cookbook: {
    title: string;
    subtitle?: string;
    author_name: string;
    cover_style: CoverStyle;
    cover_image_url?: string;
    selected_image_urls?: Record<string, string[]>;
    foreword?: string;
    pageSize?: PageSizeKey;
  };
  recipes: CookbookRecipe[];
  chefsHatBase64?: string | null;
  language?: BookLocale;
}

export interface CustomPageData {
  id: string;
  layout: 'image_only' | 'text_only' | 'image_and_text';
  image_url?: string;
  text?: string;
  caption?: string;
}

export interface CookbookRecipe {
  id: string;
  title: string;
  description?: string;
  cuisine?: string;
  course?: string;
  total_minutes?: number;
  servings?: number;
  ingredients: Array<{
    quantity?: number | null;
    unit?: string | null;
    ingredient: string;
    preparation?: string | null;
    optional?: boolean;
    group_label?: string | null;
  }>;
  steps: Array<{
    step_number: number;
    instruction: string;
    timer_minutes?: number | null;
    group_label?: string | null;
  }>;
  notes?: string;
  image_urls: string[]; // all images for this recipe, primary first
  custom_pages?: CustomPageData[]; // user-added custom pages
  fillType?: FillType; // fill zone at bottom of content page
  fillContent?: FillContent;
}

export interface IngredientGroup {
  label: string | null;
  items: CookbookRecipe['ingredients'];
}

/**
 * Group ingredients by their group_label
 */
export function groupIngredients(ingredients: CookbookRecipe['ingredients']): IngredientGroup[] {
  const groups: IngredientGroup[] = [];
  let currentGroup: string | null = null;
  let currentItems: CookbookRecipe['ingredients'] = [];

  for (const ing of ingredients) {
    if (ing.group_label !== currentGroup) {
      if (currentItems.length > 0) {
        groups.push({ label: currentGroup, items: currentItems });
      }
      currentGroup = ing.group_label ?? null;
      currentItems = [ing];
    } else {
      currentItems.push(ing);
    }
  }

  if (currentItems.length > 0) {
    groups.push({ label: currentGroup, items: currentItems });
  }

  return groups;
}

/**
 * Format duration in minutes to human-readable string
 */
export function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (mins === 0) return `${hours}h`;
  return `${hours}h ${mins}min`;
}

/**
 * Format quantity with fractions
 */
export function formatQuantity(qty: number | null | undefined): string {
  if (qty === null || qty === undefined) return '';
  if (Number.isInteger(qty)) return qty.toString();

  // Handle common fractions
  const fractions: Record<number, string> = {
    0.25: '¼', 0.33: '⅓', 0.5: '½', 0.66: '⅔', 0.75: '¾',
    0.125: '⅛', 0.375: '⅜', 0.625: '⅝', 0.875: '⅞',
  };

  const whole = Math.floor(qty);
  const frac = qty - whole;
  const fracStr = fractions[Math.round(frac * 1000) / 1000] || frac.toFixed(2);

  if (whole === 0) return fracStr;
  return `${whole} ${fracStr}`;
}

/**
 * Truncate text with ellipsis
 */
export function truncate(text: string, maxLen: number): string {
  if (text.length <= maxLen) return text;
  return text.slice(0, maxLen - 1) + '…';
}

/**
 * Fix timer character bug (ñ → remove, don't use emoji - fonts don't support it)
 */
export function fixTimerCharacter(text: string): string {
  let fixed = text.replace(/ñ\s*(\d)/g, '$1');
  fixed = fixed.replace(/ñ(?!\w)/g, '');
  fixed = fixed.replace(/ñ\s+/g, '');
  return fixed;
}
