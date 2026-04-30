/**
 * Font Registration — Centralized font registration for all templates.
 * Called once at engine startup before any template renders.
 *
 * PATTERN 11 (publishing.md): Inter has NO italic variants.
 * Never register fontStyle: italic for Inter — it will fail.
 */

import { Font } from '@react-pdf/renderer';

let fontsRegistered = false;

/**
 * Register all fonts used by system templates.
 * Safe to call multiple times — subsequent calls are no-ops.
 *
 * Fonts are loaded from jsDelivr CDN for reliability.
 */
export function registerFonts(): void {
  if (fontsRegistered) return;

  // Playfair Display — Trattoria, Heritage, Studio
  Font.register({
    family: 'Playfair Display',
    fonts: [
      { src: 'https://cdn.jsdelivr.net/fontsource/fonts/playfair-display@latest/latin-400-normal.ttf', fontWeight: 400 },
      { src: 'https://cdn.jsdelivr.net/fontsource/fonts/playfair-display@latest/latin-600-normal.ttf', fontWeight: 600 },
      { src: 'https://cdn.jsdelivr.net/fontsource/fonts/playfair-display@latest/latin-700-normal.ttf', fontWeight: 700 },
      { src: 'https://cdn.jsdelivr.net/fontsource/fonts/playfair-display@latest/latin-400-italic.ttf', fontWeight: 400, fontStyle: 'italic' },
    ],
  });

  // Inter — All templates (body text)
  // CRITICAL: No italic variants — Inter does not have them (PATTERN 11)
  Font.register({
    family: 'Inter',
    fonts: [
      { src: 'https://cdn.jsdelivr.net/fontsource/fonts/inter@latest/latin-300-normal.ttf', fontWeight: 300 },
      { src: 'https://cdn.jsdelivr.net/fontsource/fonts/inter@latest/latin-400-normal.ttf', fontWeight: 400 },
      { src: 'https://cdn.jsdelivr.net/fontsource/fonts/inter@latest/latin-500-normal.ttf', fontWeight: 500 },
      { src: 'https://cdn.jsdelivr.net/fontsource/fonts/inter@latest/latin-600-normal.ttf', fontWeight: 600 },
      { src: 'https://cdn.jsdelivr.net/fontsource/fonts/inter@latest/latin-700-normal.ttf', fontWeight: 700 },
    ],
  });

  // Oswald — BBQ template (headings)
  Font.register({
    family: 'Oswald',
    fonts: [
      { src: 'https://cdn.jsdelivr.net/fontsource/fonts/oswald@latest/latin-400-normal.ttf', fontWeight: 400 },
      { src: 'https://cdn.jsdelivr.net/fontsource/fonts/oswald@latest/latin-500-normal.ttf', fontWeight: 500 },
      { src: 'https://cdn.jsdelivr.net/fontsource/fonts/oswald@latest/latin-600-normal.ttf', fontWeight: 600 },
      { src: 'https://cdn.jsdelivr.net/fontsource/fonts/oswald@latest/latin-700-normal.ttf', fontWeight: 700 },
    ],
  });

  // Source Sans Pro — BBQ, Heritage templates (body text)
  Font.register({
    family: 'Source Sans Pro',
    fonts: [
      { src: 'https://cdn.jsdelivr.net/fontsource/fonts/source-sans-3@latest/latin-300-normal.ttf', fontWeight: 300 },
      { src: 'https://cdn.jsdelivr.net/fontsource/fonts/source-sans-3@latest/latin-400-normal.ttf', fontWeight: 400 },
      { src: 'https://cdn.jsdelivr.net/fontsource/fonts/source-sans-3@latest/latin-600-normal.ttf', fontWeight: 600 },
    ],
  });

  // Work Sans — Nordic template
  Font.register({
    family: 'Work Sans',
    fonts: [
      { src: 'https://cdn.jsdelivr.net/fontsource/fonts/work-sans@latest/latin-300-normal.ttf', fontWeight: 300 },
      { src: 'https://cdn.jsdelivr.net/fontsource/fonts/work-sans@latest/latin-400-normal.ttf', fontWeight: 400 },
      { src: 'https://cdn.jsdelivr.net/fontsource/fonts/work-sans@latest/latin-500-normal.ttf', fontWeight: 500 },
      { src: 'https://cdn.jsdelivr.net/fontsource/fonts/work-sans@latest/latin-600-normal.ttf', fontWeight: 600 },
      { src: 'https://cdn.jsdelivr.net/fontsource/fonts/work-sans@latest/latin-700-normal.ttf', fontWeight: 700 },
    ],
  });

  // Libre Baskerville — Heritage template (headings, italics)
  Font.register({
    family: 'Libre Baskerville',
    fonts: [
      { src: 'https://cdn.jsdelivr.net/fontsource/fonts/libre-baskerville@latest/latin-400-normal.ttf', fontWeight: 400 },
      { src: 'https://cdn.jsdelivr.net/fontsource/fonts/libre-baskerville@latest/latin-700-normal.ttf', fontWeight: 700 },
      { src: 'https://cdn.jsdelivr.net/fontsource/fonts/libre-baskerville@latest/latin-400-italic.ttf', fontWeight: 400, fontStyle: 'italic' },
    ],
  });

  fontsRegistered = true;
}

/**
 * Check if fonts have been registered
 */
export function areFontsRegistered(): boolean {
  return fontsRegistered;
}
