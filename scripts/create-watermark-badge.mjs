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
 * Sizing: BADGE_WIDTH is the authoritative canvas width; the logo is resized to
 * BADGE_WIDTH - 2*PADDING_X, badge height is proportional to the logo aspect.
 * The pill uses a moderate corner radius (not full stadium) so the logo — which
 * has its red-square hat icon near the right edge — does not clip into curved caps.
 *
 * Usage: node scripts/create-watermark-badge.mjs
 * Output: apps/web/public/images/watermark-chefsbook.png (read by apply-watermarks.mjs)
 */
import sharp from 'sharp';
import { mkdirSync, existsSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const BADGE_WIDTH = 260;
const PADDING_X = 18;
const PADDING_Y = 16;
const CORNER_RADIUS = 16;

export async function createWatermarkBadge(outputPath) {
  const logoPath = path.join(__dirname, 'chefs-hat.png');
  const logoMeta = await sharp(logoPath).metadata();
  const srcW = logoMeta.width ?? 1324;
  const srcH = logoMeta.height ?? 371;
  const aspect = srcW / srcH;

  const logoTargetW = BADGE_WIDTH - 2 * PADDING_X;
  const logoTargetH = Math.round(logoTargetW / aspect);
  const badgeW = BADGE_WIDTH;
  const badgeH = logoTargetH + 2 * PADDING_Y;

  const logoBuffer = await sharp(logoPath)
    .resize(logoTargetW, logoTargetH, { fit: 'contain', background: { r: 255, g: 255, b: 255, alpha: 0 } })
    .png()
    .toBuffer();

  // White rounded-rect pill (moderate corner radius so the logo clears both caps)
  const pillSvg = `<svg width="${badgeW}" height="${badgeH}" xmlns="http://www.w3.org/2000/svg">
    <rect x="0" y="0" width="${badgeW}" height="${badgeH}"
          rx="${CORNER_RADIUS}" ry="${CORNER_RADIUS}"
          fill="rgb(255,255,255)" fill-opacity="0.94"/>
  </svg>`;

  await sharp(Buffer.from(pillSvg))
    .composite([{ input: logoBuffer, left: PADDING_X, top: PADDING_Y }])
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
