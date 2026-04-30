/**
 * Template Validation — Validates template code before use.
 *
 * A template passes validation when ALL of the following are true:
 * 1. No hardcoded page size: code does not contain size="LETTER" etc.
 * 2. No emoji: code does not contain emoji Unicode characters
 * 3. No fixed step heights: code does not contain height/minHeight on step rows
 * 4. Correct export: code exports a default function
 * 5. Approved imports only: no external npm packages
 */

import type { ValidationResult } from './types';

/**
 * Hardcoded page size patterns to reject
 */
const HARDCODED_SIZE_PATTERNS = [
  /size=["']LETTER["']/gi,
  /size=["']A4["']/gi,
  /size=["']LEGAL["']/gi,
  /size=["']TABLOID["']/gi,
  /size=\{["']letter["']\}/gi,
  /size=\{["']trade["']\}/gi,
  /size=\{["']digest["']\}/gi,
  /size=\{["']square["']\}/gi,
];

/**
 * Emoji ranges to reject (simplified — covers most common cases)
 * Full Unicode emoji detection is complex; we focus on the common problems:
 * - Keycap digits (1️⃣2️⃣3️⃣ etc.)
 * - Common emoji starting at U+1F000
 * - Miscellaneous symbols that render as emoji
 */
const EMOJI_PATTERN = /[\u{1F000}-\u{1FFFF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]|[\u{FE00}-\u{FE0F}]|[\u{1F1E0}-\u{1F1FF}]/gu;

/**
 * Pattern to detect height/minHeight on step-related elements
 * This catches things like: style={{ height: 40 }} on step rows
 */
const STEP_HEIGHT_PATTERNS = [
  /step.*style\s*=\s*\{\s*\{[^}]*height\s*:/gi,
  /style\s*=\s*\{\s*\{[^}]*height\s*:[^}]*\}\s*\}[^>]*step/gi,
  /stepWrap.*height\s*:/gi,
  /stepRow.*height\s*:/gi,
  /minHeight.*step/gi,
  /step.*minHeight/gi,
];

/**
 * Approved import sources for templates
 */
const APPROVED_IMPORTS = [
  '@react-pdf/renderer',
  'react',
  '../types',
  './types',
  '../book-strings',
  './book-strings',
  '../engine/types',
  '../engine/layout',
  '../engine',
];

/**
 * Import statement pattern
 */
const IMPORT_PATTERN = /import\s+.*?\s+from\s+['"]([^'"]+)['"]/g;

/**
 * Validate template code
 */
export function validateTemplate(code: string): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // 1. Check for hardcoded page sizes
  for (const pattern of HARDCODED_SIZE_PATTERNS) {
    if (pattern.test(code)) {
      errors.push(`Hardcoded page size detected (pattern: ${pattern.source}). Use getPageSize(pageSize) instead.`);
    }
  }

  // 2. Check for emoji characters
  const emojiMatches = code.match(EMOJI_PATTERN);
  if (emojiMatches && emojiMatches.length > 0) {
    errors.push(`Emoji characters detected: ${emojiMatches.slice(0, 3).join(', ')}${emojiMatches.length > 3 ? '...' : ''}. React-PDF cannot render emoji.`);
  }

  // 3. Check for fixed heights on step elements
  for (const pattern of STEP_HEIGHT_PATTERNS) {
    if (pattern.test(code)) {
      warnings.push(`Possible fixed height on step element (pattern: ${pattern.source}). Step rows must use auto-height only.`);
    }
  }

  // 4. Check for default export
  const hasDefaultExport = /export\s+default\s+function/.test(code) ||
                           /export\s+\{\s*\w+\s+as\s+default\s*\}/.test(code) ||
                           /export\s+default\s+\w+/.test(code);
  if (!hasDefaultExport) {
    errors.push('Template must export a default function.');
  }

  // 5. Check import sources
  let match;
  const importPattern = new RegExp(IMPORT_PATTERN.source, 'g');
  while ((match = importPattern.exec(code)) !== null) {
    const source = match[1];
    const isApproved = APPROVED_IMPORTS.some(approved =>
      source === approved || source.startsWith(approved + '/')
    );
    if (!isApproved && !source.startsWith('.')) {
      errors.push(`Unapproved import source: "${source}". Only approved packages are allowed.`);
    }
  }

  // Additional checks for common problems

  // Check for hardcoded numeric values in styles that should use layout
  // This is a warning, not an error, because some hardcoded values are fine
  const hardcodedFontSizes = code.match(/fontSize:\s*\d{2,}/g);
  if (hardcodedFontSizes && hardcodedFontSizes.length > 10) {
    warnings.push(`Many hardcoded font sizes detected (${hardcodedFontSizes.length}). Consider using layout.* values.`);
  }

  // Check for problematic characters that display as garbled text
  if (/ñ/.test(code) && !/fixTimerCharacter/.test(code)) {
    warnings.push('Character "ñ" found but fixTimerCharacter() not used. Timer characters may display incorrectly.');
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Quick check if code is likely a valid template (fast, minimal checks)
 */
export function quickValidate(code: string): boolean {
  // Must have default export
  if (!/export\s+(default|{[^}]*default)/.test(code)) return false;

  // Must import from react-pdf
  if (!/@react-pdf\/renderer/.test(code)) return false;

  // Should not have obvious emoji
  if (EMOJI_PATTERN.test(code)) return false;

  return true;
}
