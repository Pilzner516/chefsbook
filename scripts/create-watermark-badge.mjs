#!/usr/bin/env node
/**
 * Creates the ChefsBook watermark badge PNG.
 * Run once to generate the badge, then composite onto images.
 *
 * Usage: node scripts/create-watermark-badge.mjs
 * Output: apps/web/public/images/watermark-chefsbook.png
 */
import sharp from 'sharp';
import { mkdirSync, existsSync } from 'fs';
import { dirname, resolve } from 'path';

const WIDTH = 200;
const HEIGHT = 46;
const OUTPUT = resolve(process.cwd(), 'apps/web/public/images/watermark-chefsbook.png');

// Ensure output directory exists
const dir = dirname(OUTPUT);
if (!existsSync(dir)) mkdirSync(dir, { recursive: true });

// SVG watermark badge — "ChefsBook" (no space, capital B) + toque hat icon
const svg = `
<svg width="${WIDTH}" height="${HEIGHT}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <filter id="shadow" x="-10%" y="-20%" width="130%" height="160%">
      <feDropShadow dx="0" dy="1" stdDeviation="3" flood-opacity="0.3"/>
    </filter>
  </defs>

  <!-- Opaque white pill background -->
  <rect x="2" y="2" width="${WIDTH - 4}" height="${HEIGHT - 4}"
    rx="21" ry="21"
    fill="white"
    filter="url(#shadow)"
  />
  <!-- Subtle border -->
  <rect x="3" y="3" width="${WIDTH - 6}" height="${HEIGHT - 6}"
    rx="20" ry="20"
    fill="none" stroke="rgba(0,0,0,0.1)" stroke-width="1"
  />

  <!-- "ChefsBook" — single word, no space, tspan for color -->
  <text x="16" y="${Math.round(HEIGHT / 2 + 6)}"
    font-family="Arial, Helvetica, sans-serif"
    font-size="18"
    font-weight="700"
    letter-spacing="-0.3"
  ><tspan fill="#ce2b37">Chefs</tspan><tspan fill="#1a1a1a">Book</tspan></text>

  <!-- Chef toque icon — clean minimal style -->
  <g transform="translate(148, 7)">
    <!-- Hat brim/band (red) -->
    <rect x="2" y="24" width="36" height="8" rx="2" fill="#ce2b37"/>
    <!-- Hat body (white rectangle) -->
    <rect x="6" y="8" width="28" height="18" rx="2"
      fill="white" stroke="#ce2b37" stroke-width="1.8"/>
    <!-- Top puff (rounded dome) -->
    <ellipse cx="20" cy="9" rx="15" ry="9"
      fill="white" stroke="#ce2b37" stroke-width="1.8"/>
  </g>
</svg>`;

await sharp(Buffer.from(svg))
  .resize(WIDTH, HEIGHT)
  .png({ compressionLevel: 9 })
  .toFile(OUTPUT);

console.log(`Watermark badge created: ${OUTPUT}`);
console.log(`Size: ${WIDTH}x${HEIGHT}px`);
