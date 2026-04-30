/**
 * Template Engine — Central entry point for the PDF template system.
 *
 * Usage:
 *   import { TemplateEngine } from '@/lib/pdf-templates/engine';
 *
 *   // Get a template by ID
 *   const Template = TemplateEngine.getTemplate('trattoria');
 *
 *   // Compute layout for a page size
 *   const layout = TemplateEngine.computeLayout('letter');
 *
 *   // Build context for rendering
 *   const ctx = TemplateEngine.buildContext(recipe, 'letter', 'trattoria');
 */

import type {
  PageSizeKey,
  PageDimensions,
  ComputedLayout,
  TemplateContext,
  TemplateManifest,
  TemplateSettings,
  ValidationResult,
  CookbookRecipe,
  FillContent,
  CoverStyle,
  TemplateComponent,
} from './types';

import { computeLayout, PAGE_SIZES, isValidPageSize } from './layout';
import { registerFonts, areFontsRegistered } from './register-fonts';
import { validateTemplate, quickValidate } from './validate';
import { getStrings } from './types';

// Re-export for convenience
export { computeLayout, PAGE_SIZES, isValidPageSize } from './layout';
export { registerFonts, areFontsRegistered } from './register-fonts';
export { validateTemplate, quickValidate } from './validate';
export { TEST_RECIPE, TEST_COOKBOOK_OPTIONS, getMinimalTestRecipe } from './test-recipe';
export * from './types';

/**
 * System template manifests
 */
const SYSTEM_TEMPLATES: TemplateManifest[] = [
  {
    id: 'trattoria',
    name: 'Trattoria',
    description: 'Warm rustic Italian style with cream background and red accents',
    version: '2.0.0',
    isSystem: true,
    status: 'active',
    supportedPageSizes: ['letter', 'trade', 'large-trade', 'digest', 'square'],
    luluCompliant: true,
    fonts: [
      { family: 'Playfair Display', weights: [400, 600, 700], italic: [400] },
      { family: 'Inter', weights: [300, 400, 500, 600] },
    ],
    settings: {
      palette: {
        accent: '#ce2b37',
        background: '#faf7f0',
        text: '#1a1a1a',
        muted: '#7a6a5a',
        surface: '#f0ece0',
      },
      fonts: { heading: 'Playfair Display', body: 'Inter' },
    },
  },
  {
    id: 'studio',
    name: 'Studio',
    description: 'Modern dark theme with dramatic presentation',
    version: '2.0.0',
    isSystem: true,
    status: 'active',
    supportedPageSizes: ['letter', 'trade', 'large-trade', 'digest', 'square'],
    luluCompliant: true,
    fonts: [
      { family: 'Playfair Display', weights: [400, 700], italic: [400] },
      { family: 'Inter', weights: [300, 400, 600] },
    ],
    settings: {
      palette: {
        accent: '#ce2b37',
        background: '#1a1a1a',
        text: '#f5f0e8',
        muted: 'rgba(245, 240, 232, 0.5)',
        surface: '#242424',
      },
      fonts: { heading: 'Playfair Display', body: 'Inter' },
    },
  },
  {
    id: 'garden',
    name: 'Garden',
    description: 'Fresh minimal style celebrating photography',
    version: '2.0.0',
    isSystem: true,
    status: 'active',
    supportedPageSizes: ['letter', 'trade', 'large-trade', 'digest', 'square'],
    luluCompliant: true,
    fonts: [
      { family: 'Inter', weights: [300, 400, 500, 600, 700] },
    ],
    settings: {
      palette: {
        accent: '#009246',
        background: '#ffffff',
        text: '#1a1a1a',
        muted: '#9a8a7a',
        surface: '#f0ece0',
      },
      fonts: { heading: 'Inter', body: 'Inter' },
    },
  },
  {
    id: 'heritage',
    name: 'Heritage',
    description: 'Warm farmhouse style like a family heirloom',
    version: '2.0.0',
    isSystem: true,
    status: 'active',
    supportedPageSizes: ['letter', 'trade', 'large-trade', 'digest', 'square'],
    luluCompliant: true,
    fonts: [
      { family: 'Libre Baskerville', weights: [400, 700], italic: [400] },
      { family: 'Source Sans Pro', weights: [300, 400, 600] },
    ],
    settings: {
      palette: {
        accent: '#8b9a7d',
        background: '#f8f5f0',
        text: '#3a3028',
        muted: '#9a8a7a',
        surface: '#f0ebe3',
      },
      fonts: { heading: 'Libre Baskerville', body: 'Source Sans Pro' },
    },
  },
  {
    id: 'nordic',
    name: 'Nordic',
    description: 'Stark Scandinavian minimalism with massive white space',
    version: '2.0.0',
    isSystem: true,
    status: 'active',
    supportedPageSizes: ['letter', 'trade', 'large-trade', 'digest', 'square'],
    luluCompliant: true,
    fonts: [
      { family: 'Work Sans', weights: [300, 400, 500, 600, 700] },
    ],
    settings: {
      palette: {
        accent: '#5c7a8a',
        background: '#ffffff',
        text: '#2d2d2d',
        muted: '#4a4a4a',
        surface: '#f5f5f5',
      },
      fonts: { heading: 'Work Sans', body: 'Work Sans' },
    },
  },
  {
    id: 'bbq',
    name: 'BBQ',
    description: 'Smoky rustic American barbecue style',
    version: '2.0.0',
    isSystem: true,
    status: 'active',
    supportedPageSizes: ['letter', 'trade', 'large-trade', 'digest', 'square'],
    luluCompliant: true,
    fonts: [
      { family: 'Oswald', weights: [400, 500, 600, 700] },
      { family: 'Source Sans Pro', weights: [300, 400, 600] },
    ],
    settings: {
      palette: {
        accent: '#d4a03a',
        background: '#f5f0e8',
        text: '#2d2926',
        muted: '#4a4543',
        surface: '#fffdf8',
      },
      fonts: { heading: 'Oswald', body: 'Source Sans Pro' },
    },
  },
];

/**
 * Template Engine — static class for template operations
 */
export class TemplateEngine {
  /**
   * Ensure fonts are registered before any template use
   */
  static ensureFonts(): void {
    if (!areFontsRegistered()) {
      registerFonts();
    }
  }

  /**
   * Get a template component by ID
   * Returns the Document function for the specified template
   */
  static getTemplate(id: string): TemplateComponent {
    TemplateEngine.ensureFonts();
    console.log('[TemplateEngine] getTemplate called with id:', id);

    // Import templates dynamically based on ID
    let mod: any;
    let exportName: string;
    switch (id) {
      case 'trattoria':
      case 'classic':
        mod = require('../trattoria');
        exportName = 'TrattoriaDocument';
        break;
      case 'studio':
      case 'modern':
        mod = require('../studio');
        exportName = 'StudioDocument';
        break;
      case 'garden':
      case 'minimal':
        mod = require('../garden');
        exportName = 'GardenDocument';
        break;
      case 'heritage':
        mod = require('../heritage');
        exportName = 'HeritageDocument';
        break;
      case 'nordic':
        mod = require('../nordic');
        exportName = 'NordicDocument';
        break;
      case 'bbq':
        mod = require('../bbq');
        exportName = 'BBQDocument';
        break;
      default:
        console.warn(`Unknown template ID "${id}", falling back to trattoria`);
        mod = require('../trattoria');
        exportName = 'TrattoriaDocument';
    }

    console.log('[TemplateEngine] Module keys:', Object.keys(mod || {}));
    console.log('[TemplateEngine] Looking for export:', exportName);
    console.log('[TemplateEngine] Export type:', typeof mod?.[exportName]);
    console.log('[TemplateEngine] Default export type:', typeof mod?.default);

    const component = mod?.[exportName];
    if (!component) {
      console.error('[TemplateEngine] CRITICAL: Export not found!');
      console.error('[TemplateEngine] Available exports:', Object.keys(mod || {}));
    }
    return component;
  }

  /**
   * Compute layout values for a page size
   */
  static computeLayout(pageSize: PageSizeKey | PageDimensions): ComputedLayout {
    return computeLayout(pageSize);
  }

  /**
   * Get manifest for a template by ID
   */
  static getManifest(id: string): TemplateManifest | undefined {
    return SYSTEM_TEMPLATES.find(t => t.id === id);
  }

  /**
   * Get settings for a template by ID
   */
  static getSettings(id: string): TemplateSettings {
    const manifest = TemplateEngine.getManifest(id);
    if (manifest) {
      return manifest.settings;
    }
    // Default to trattoria settings
    return SYSTEM_TEMPLATES[0].settings;
  }

  /**
   * Build a TemplateContext for rendering
   */
  static buildContext(
    data: {
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
      language?: string;
    },
    pageSize: PageSizeKey | PageDimensions,
    templateId: string,
    options?: {
      fillZone?: FillContent;
      isPreview?: boolean;
    }
  ): TemplateContext {
    const layout = computeLayout(pageSize);
    const settings = TemplateEngine.getSettings(templateId);
    const strings = getStrings(data.language ?? 'en');

    return {
      // Use first recipe as the primary recipe for single-recipe rendering
      recipe: data.recipes[0] || ({} as CookbookRecipe),
      // Full cookbook data for Document-level templates
      cookbook: data.cookbook,
      recipes: data.recipes,
      chefsHatBase64: data.chefsHatBase64,
      language: (data.language ?? 'en') as any,
      // Computed values
      layout,
      settings,
      strings,
      fillZone: options?.fillZone,
      isPreview: options?.isPreview ?? false,
    };
  }

  /**
   * Validate template code
   */
  static validate(code: string): ValidationResult {
    return validateTemplate(code);
  }

  /**
   * Quick validation check
   */
  static quickValidate(code: string): boolean {
    return quickValidate(code);
  }

  /**
   * List all available template manifests
   */
  static listTemplates(): TemplateManifest[] {
    return [...SYSTEM_TEMPLATES];
  }

  /**
   * Get all active templates
   */
  static getActiveTemplates(): TemplateManifest[] {
    return SYSTEM_TEMPLATES.filter(t => t.status === 'active');
  }

  /**
   * Check if a template ID is valid
   */
  static isValidTemplate(id: string): boolean {
    return SYSTEM_TEMPLATES.some(t => t.id === id);
  }

  /**
   * Get page sizes with labels
   */
  static getPageSizes(): Array<{ key: PageSizeKey; label: string; width: number; height: number }> {
    return [
      { key: 'letter', label: '8.5 × 11 in', ...PAGE_SIZES['letter'] },
      { key: 'trade', label: '6 × 9 in', ...PAGE_SIZES['trade'] },
      { key: 'large-trade', label: '7 × 10 in', ...PAGE_SIZES['large-trade'] },
      { key: 'digest', label: '5.5 × 8.5 in', ...PAGE_SIZES['digest'] },
      { key: 'square', label: '8 × 8 in', ...PAGE_SIZES['square'] },
    ];
  }
}

// Default export for convenience
export default TemplateEngine;
