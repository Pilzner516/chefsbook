#!/usr/bin/env node
/**
 * Creates the ChefsBook watermark badge PNG.
 *
 * Source: scripts/chefs-hat.png (copied from docs/pics/cb_plus_hat.png) —
 * the full "Chefsbook" wordmark + red-square hat icon as a single asset.
 *
 * NEVER redraw the chef's hat as SVG geometry — every attempt has produced the wrong result.
 * The badge is simply the real logo PNG centered on a white rounded-rect pill
 * for legibility on dark food photos. No SVG text overlay.
 *
 * Usage: node scripts/create-watermark-badge.mjs
 * Output: apps/web/public/images/watermark-chefsbook.png (read by apply-watermarks.mjs)
 */
import sharp from 'sharp';
import { mkdirSync, existsSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const PADDING = 40; // pixels of white around logo at native size

export async function createWatermarkBadge(outputPath) {
  const logoPath = path.join(__dirname, 'chefs-hat.png');
  const logoMeta = await sharp(logoPath).metadata();
  const logoW = logoMeta.width ?? 1324;
  const logoH = logoMeta.height ?? 371;

  const badgeW = logoW + 2 * PADDING;
  const badgeH = logoH + 2 * PADDING;
  const pillRadius = Math.round(badgeH / 2);

  const logoBuffer = await sharp(logoPath).png().toBuffer();

  // White rounded-rect pill (SVG gives us rounded corners with transparent outside)
  const pillSvg = `<svg width="${badgeW}" height="${badgeH}" xmlns="http://www.w3.org/2000/svg">
    <rect x="0" y="0" width="${badgeW}" height="${badgeH}"
          rx="${pillRadius}" ry="${pillRadius}"
          fill="rgb(255,255,255)" fill-opacity="0.94"/>
  </svg>`;

  await sharp(Buffer.from(pillSvg))
    .composite([{ input: logoBuffer, left: PADDING, top: PADDING }])
    .png({ compressionLevel: 9 })
    .toFile(outputPath);
}

const outputPath = path.resolve(process.cwd(), 'apps/web/public/images/watermark-chefsbook.png');
const outDir = path.dirname(outputPath);
if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true });

await createWatermarkBadge(outputPath);

const finalMeta = await sharp(outputPath).metadata();
console.log(`Watermark badge created: ${outputPath}`);
console.log(`Size: ${finalMeta.width}x${finalMeta.height}px`);
