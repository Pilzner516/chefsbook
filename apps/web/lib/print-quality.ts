/**
 * Print Quality Checking for Cookbook Images
 *
 * Calculates DPI based on source image dimensions vs print dimensions.
 * Used to warn users about low-resolution images before PDF generation.
 */

export type PrintUsage = 'full_bleed' | 'cover' | 'half_page' | 'custom_full';

export type QualityTier = 'excellent' | 'acceptable' | 'poor';

export interface QualityResult {
  tier: QualityTier;
  dpi: number;
  widthPx: number;
  heightPx: number;
  printWidth: number;
  printHeight: number;
  minWidthForExcellent: number;
  minHeightForExcellent: number;
}

// Print dimensions in inches for each usage type
const PRINT_DIMENSIONS: Record<PrintUsage, { width: number; height: number }> = {
  full_bleed: { width: 8.5, height: 5.5 },       // Full-page recipe photo
  cover: { width: 8.75, height: 11.25 },         // Cover with bleed
  half_page: { width: 4.25, height: 11 },        // Half-page split layout
  custom_full: { width: 8.5, height: 10.5 },     // Custom page full image
};

// DPI thresholds
const EXCELLENT_DPI = 300;
const ACCEPTABLE_DPI = 150;

/**
 * Calculate print quality tier and DPI for an image
 */
export function calculateQuality(
  widthPx: number,
  heightPx: number,
  usage: PrintUsage
): QualityResult {
  const printDims = PRINT_DIMENSIONS[usage];

  // Calculate effective DPI for both dimensions, use the lower one
  const dpiWidth = widthPx / printDims.width;
  const dpiHeight = heightPx / printDims.height;
  const dpi = Math.min(dpiWidth, dpiHeight);

  // Determine tier
  let tier: QualityTier;
  if (dpi >= EXCELLENT_DPI) {
    tier = 'excellent';
  } else if (dpi >= ACCEPTABLE_DPI) {
    tier = 'acceptable';
  } else {
    tier = 'poor';
  }

  return {
    tier,
    dpi: Math.round(dpi),
    widthPx,
    heightPx,
    printWidth: printDims.width,
    printHeight: printDims.height,
    minWidthForExcellent: Math.ceil(printDims.width * EXCELLENT_DPI),
    minHeightForExcellent: Math.ceil(printDims.height * EXCELLENT_DPI),
  };
}

/**
 * Get image dimensions by loading it in the browser
 */
export function getImageDimensions(url: string): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';

    img.onload = () => {
      resolve({ width: img.naturalWidth, height: img.naturalHeight });
    };

    img.onerror = () => {
      reject(new Error(`Failed to load image: ${url}`));
    };

    img.src = url;
  });
}

/**
 * Check quality for an image URL
 */
export async function checkImageQuality(
  url: string,
  usage: PrintUsage
): Promise<QualityResult> {
  const dims = await getImageDimensions(url);
  return calculateQuality(dims.width, dims.height, usage);
}

/**
 * Get badge emoji for quality tier
 */
export function getQualityBadge(tier: QualityTier): string {
  switch (tier) {
    case 'excellent': return '🟢';
    case 'acceptable': return '🟡';
    case 'poor': return '🔴';
  }
}

/**
 * Get human-readable description for quality tier
 */
export function getQualityDescription(result: QualityResult): string {
  switch (result.tier) {
    case 'excellent':
      return `Great quality (${result.dpi} DPI)`;
    case 'acceptable':
      return `May print soft (${result.dpi} DPI)`;
    case 'poor':
      return `Too low resolution (${result.dpi} DPI)`;
  }
}

/**
 * Get recommendation for improving quality
 */
export function getQualityRecommendation(result: QualityResult): string | null {
  if (result.tier === 'excellent') {
    return null;
  }

  return `For crisp results, use at least ${result.minWidthForExcellent}×${result.minHeightForExcellent} px`;
}

/**
 * Check if image can be used for print (blocks poor quality for recipe/cover)
 */
export function canUseForPrint(
  result: QualityResult,
  usage: PrintUsage,
  isCustomPage: boolean = false
): { allowed: boolean; reason?: string } {
  if (result.tier === 'excellent' || result.tier === 'acceptable') {
    return { allowed: true };
  }

  // Poor quality: block recipe and cover photos, allow custom pages with warning
  if (isCustomPage) {
    return {
      allowed: true,
      reason: 'This photo is low resolution but can be kept for sentimental value.'
    };
  }

  return {
    allowed: false,
    reason: `This photo (${result.widthPx}×${result.heightPx} px) is too low resolution for printing. Upload a higher resolution image.`,
  };
}
