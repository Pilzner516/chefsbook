/**
 * Template Engine Types — All shared interfaces for the PDF template system.
 * Every template receives a TemplateContext built from computeLayout().
 */

// Re-export types from parent for convenience
export type {
  CookbookPdfOptions,
  CookbookRecipe,
  CustomPageData,
  IngredientGroup,
  FillContent,
  CoverStyle,
  FillType,
  PageSizeKey,
} from '../types';

// Re-export utility functions
export {
  groupIngredients,
  formatDuration,
  formatQuantity,
  truncate,
  fixTimerCharacter,
  getPageSize,
  getPageMargins,
  PAGE_SIZE_SPECS,
} from '../types';

// Re-export book strings
export type { BookStrings, BookLocale } from '../book-strings';
export { getStrings } from '../book-strings';

/**
 * Page dimensions in points (72dpi)
 */
export interface PageDimensions {
  width: number;
  height: number;
}

/**
 * Layout values computed from page dimensions.
 * Templates MUST use these values for all sizing — no hardcoded numbers.
 */
export interface ComputedLayout {
  // Page dimensions (points)
  width: number;
  height: number;

  // Lulu-compliant margins (points)
  marginTop: number;        // 54pt minimum
  marginBottom: number;     // 54pt minimum
  marginInner: number;      // 63pt minimum (binding gutter)
  marginOuter: number;      // 45pt minimum

  // Content area (after margins)
  contentWidth: number;     // width - marginInner - marginOuter
  contentHeight: number;    // height - marginTop - marginBottom

  // Typography scale — proportional to contentWidth
  fontTitle: number;        // recipe title (36-20pt range)
  fontSubtitle: number;     // section headers (22-13pt range)
  fontBody: number;         // ingredient/step text (11-9pt range)
  fontCaption: number;      // metadata, timers, captions (10-8pt range)
  fontStepNumber: number;   // step badge numbers (fixed 11pt)
  lineHeight: number;       // body line height multiplier (1.5)

  // Component sizing — proportional to contentHeight
  heroImageHeight: number;  // full-width hero photo (~38% content height)
  thumbImageHeight: number; // secondary/additional images (~28% content height)

  // Fixed sizing — these do not scale
  badgeSize: number;        // step badge circle diameter (22pt)
  badgeFontSize: number;    // number inside badge (11pt)
  stepGap: number;          // vertical gap between steps (10pt)
  sectionGap: number;       // gap between major sections (16pt)
}

/**
 * Template color palette
 */
export interface TemplatePalette {
  accent: string;           // primary brand color for this template
  background: string;       // page background
  text: string;             // primary text color
  muted: string;            // secondary/caption text color
  surface: string;          // card/section background
}

/**
 * Template settings from manifest
 */
export interface TemplateSettings {
  palette: TemplatePalette;
  fonts: {
    heading: string;        // registered font family name for titles
    body: string;           // registered font family name for body text
  };
}

/**
 * Menu chapter data for "By Menu" organisation
 */
export interface MenuChapterData {
  menu_id: string;
  menu_title: string;
  occasion?: string;
  notes?: string;
  chapter_number: number;
  recipe_ids: string[];
}

/**
 * Full context passed to every template component
 */
export interface TemplateContext {
  // Single recipe rendering (used by page components)
  recipe: import('../types').CookbookRecipe;
  // Full cookbook data (used by Document-level templates)
  cookbook: {
    title: string;
    subtitle?: string;
    author_name: string;
    cover_style: import('../types').CoverStyle;
    cover_image_url?: string;
    selected_image_urls?: Record<string, string[]>;
    foreword?: string;
    pageSize?: import('../types').PageSizeKey;
  };
  recipes: import('../types').CookbookRecipe[];
  chefsHatBase64?: string | null;
  language?: import('../book-strings').BookLocale;
  // Computed layout values
  layout: ComputedLayout;
  settings: TemplateSettings;
  strings: import('../book-strings').BookStrings;
  fillZone?: import('../types').FillContent;
  isPreview?: boolean;      // true = FlipbookPreview, false = actual PDF generation
  // Menu chapter organisation (optional)
  organisation?: 'manual' | 'by_menu';
  menuChapters?: MenuChapterData[];
}

/**
 * Template manifest describing a template to the engine and admin UI
 */
export interface TemplateManifest {
  id: string;
  name: string;
  description: string;
  version: string;
  isSystem: boolean;
  status: 'active' | 'inactive' | 'draft' | 'error';
  supportedPageSizes: import('../types').PageSizeKey[];
  luluCompliant: boolean;
  fonts: Array<{
    family: string;
    weights: number[];
    italic?: number[];
  }>;
  settings: TemplateSettings;
}

/**
 * Validation result from template validation
 */
export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

/**
 * Template component function signature
 */
export type TemplateComponent = (ctx: TemplateContext) => React.ReactElement;
