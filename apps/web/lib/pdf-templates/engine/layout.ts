/**
 * Layout Engine — Computes all sizing values from page dimensions.
 * This is the core of the proportional layout system.
 *
 * Every layout-sensitive measurement in every template must be derived from
 * computeLayout(pageSize) — never hardcoded.
 */

import type { PageDimensions, ComputedLayout, PageSizeKey } from './types';

/**
 * Page sizes in points (72dpi) — Lulu print specifications
 */
export const PAGE_SIZES: Record<PageSizeKey, PageDimensions> = {
  letter:       { width: 612, height: 792 },   // 8.5 × 11 in
  trade:        { width: 432, height: 648 },   // 6 × 9 in
  'large-trade': { width: 504, height: 720 },  // 7 × 10 in
  digest:       { width: 396, height: 612 },   // 5.5 × 8.5 in
  square:       { width: 576, height: 576 },   // 8 × 8 in
};

/**
 * Compute all layout values from page dimensions.
 *
 * Lulu print specification (mandatory):
 * - Bleed: 0.125" = 9pt on all sides
 * - Margins: top/bottom 0.75" = 54pt, inner 0.875" = 63pt, outer 0.625" = 45pt
 * - DPI: 300 minimum for images
 * - Binding: Perfect bind (softcover)
 * - Format: Full colour interior
 *
 * Typography scales with content width using ratios derived from
 * professional cookbook design standards.
 */
export function computeLayout(pageSize: PageSizeKey | PageDimensions): ComputedLayout {
  // Resolve to dimensions
  const dims: PageDimensions = typeof pageSize === 'string'
    ? PAGE_SIZES[pageSize]
    : pageSize;

  // Lulu-compliant margins (minimums)
  const marginTop = 54;
  const marginBottom = 54;
  const marginInner = 63;
  const marginOuter = 45;

  // Content area
  const contentWidth = dims.width - marginInner - marginOuter;
  const contentHeight = dims.height - marginTop - marginBottom;

  // Typography scales with content width
  // These ratios were derived from professional cookbook design standards
  // and tested across all five page sizes
  let fontBody: number;
  if (contentWidth < 360) {
    fontBody = 9;       // Digest: smallest pages need smaller base font
  } else if (contentWidth < 420) {
    fontBody = 10;      // Trade, Large Trade: medium pages
  } else {
    fontBody = 11;      // Letter, Square: largest pages
  }

  // Title scales with content width (clamped to readable range)
  const fontTitle = Math.max(Math.round(contentWidth * 0.072), 20);

  // Subtitle at ~62.5% of title
  const fontSubtitle = Math.max(Math.round(contentWidth * 0.045), 13);

  // Caption slightly smaller than body
  const fontCaption = Math.max(fontBody - 1, 8);

  return {
    // Page dimensions
    width: dims.width,
    height: dims.height,

    // Margins
    marginTop,
    marginBottom,
    marginInner,
    marginOuter,

    // Content area
    contentWidth,
    contentHeight,

    // Typography
    fontTitle,
    fontSubtitle,
    fontBody,
    fontCaption,
    fontStepNumber: 11,     // Fixed — badge readability
    lineHeight: 1.5,

    // Component sizing — proportional to content height
    heroImageHeight: Math.round(contentHeight * 0.38),
    thumbImageHeight: Math.round(contentHeight * 0.28),

    // Fixed sizing — these do not scale
    badgeSize: 22,
    badgeFontSize: 11,
    stepGap: 10,
    sectionGap: 16,
  };
}

/**
 * Get page dimensions as a [width, height] tuple for React-PDF Page component
 */
export function getPageDimensions(pageSize: PageSizeKey): [number, number] {
  const dims = PAGE_SIZES[pageSize];
  return [dims.width, dims.height];
}

/**
 * Check if a page size key is valid
 */
export function isValidPageSize(key: string): key is PageSizeKey {
  return key in PAGE_SIZES;
}
