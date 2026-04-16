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

const WIDTH = 160;
const HEIGHT = 36;
const OUTPUT = resolve(process.cwd(), 'apps/web/public/images/watermark-chefsbook.png');

// Ensure output directory exists
const dir = dirname(OUTPUT);
if (!existsSync(dir)) mkdirSync(dir, { recursive: true });

// SVG watermark badge with "Chefs" in red + "book" in near-black + chef hat icon
const svg = `
<svg width="${WIDTH}" height="${HEIGHT}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <filter id="shadow" x="-10%" y="-10%" width="130%" height="150%">
      <feDropShadow dx="0" dy="2" stdDeviation="3" flood-opacity="0.15"/>
    </filter>
  </defs>

  <!-- White pill background -->
  <rect x="2" y="2" width="${WIDTH - 4}" height="${HEIGHT - 4}"
    rx="16" ry="16"
    fill="rgba(255,255,255,0.88)"
    filter="url(#shadow)"
  />

  <!-- "Chefs" in pomodoro red -->
  <text
    x="14" y="${Math.round(HEIGHT / 2 + 5)}"
    font-family="Inter, Arial, Helvetica, sans-serif"
    font-size="14"
    font-weight="700"
    fill="#ce2b37"
  >Chefs</text>

  <!-- "book" in near-black -->
  <text
    x="56" y="${Math.round(HEIGHT / 2 + 5)}"
    font-family="Inter, Arial, Helvetica, sans-serif"
    font-size="14"
    font-weight="700"
    fill="#1a1a1a"
  >book</text>

  <!-- Chef hat icon -->
  <g transform="translate(100, 6)">
    <!-- Hat body (toque) -->
    <ellipse cx="12" cy="10" rx="10" ry="8" fill="white" stroke="#ce2b37" stroke-width="1.5"/>
    <!-- Left puff -->
    <ellipse cx="5" cy="13" rx="5" ry="4.5" fill="white" stroke="#ce2b37" stroke-width="1"/>
    <!-- Right puff -->
    <ellipse cx="19" cy="13" rx="5" ry="4.5" fill="white" stroke="#ce2b37" stroke-width="1"/>
    <!-- Fill center -->
    <rect x="5" y="8" width="14" height="7" fill="white"/>
    <!-- Hat band -->
    <rect x="3" y="15" width="18" height="5" rx="1.5" fill="#ce2b37"/>
  </g>
</svg>`;

await sharp(Buffer.from(svg))
  .resize(WIDTH, HEIGHT)
  .png({ compressionLevel: 9 })
  .toFile(OUTPUT);

console.log(`Watermark badge created: ${OUTPUT}`);
console.log(`Size: ${WIDTH}x${HEIGHT}px`);
