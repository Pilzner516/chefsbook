#!/usr/bin/env node
/**
 * Apply ChefsBook watermark badge to all AI-generated recipe images.
 * Downloads from Supabase storage, composites watermark, re-uploads.
 * Does NOT regenerate images (no Replicate cost).
 *
 * Usage: node scripts/apply-watermarks.mjs
 * Environment: SUPABASE_SERVICE_ROLE_KEY (reads apps/web/.env.local if not set)
 */
import { createClient } from '@supabase/supabase-js';
import sharp from 'sharp';
import { existsSync, readFileSync } from 'fs';
import { join, dirname, resolve } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// ── Load env from .env.local if not already set ──
function loadEnvFile() {
  const envPath = resolve(process.cwd(), 'apps/web/.env.local');
  try {
    const content = readFileSync(envPath, 'utf-8');
    for (const line of content.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eqIdx = trimmed.indexOf('=');
      if (eqIdx < 0) continue;
      const key = trimmed.slice(0, eqIdx).trim();
      const val = trimmed.slice(eqIdx + 1).trim();
      if (!process.env[key]) process.env[key] = val;
    }
  } catch { /* ok if missing */ }
}
loadEnvFile();

const SUPABASE_URL = process.env.SUPABASE_URL
  || process.env.NEXT_PUBLIC_SUPABASE_URL
  || 'http://localhost:8000';
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SERVICE_KEY) { console.error('SUPABASE_SERVICE_ROLE_KEY required'); process.exit(1); }

const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

const WATERMARK_PATH = join(__dirname, '../apps/web/public/images/watermark-chefsbook.png');
const DELAY_MS = 500;

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function embedLsbWatermark(buffer, recipeId) {
  try {
    const payload = `chefsbk.app|${recipeId}|${Date.now()}`;
    const bits = payload.split('').flatMap(c => {
      const code = c.charCodeAt(0);
      return Array.from({ length: 8 }, (_, i) => (code >> (7 - i)) & 1);
    });
    const result = Buffer.from(buffer);
    for (let i = 0; i < bits.length && i + 20 < result.length; i++) {
      result[i + 20] = (result[i + 20] & 0xFE) | bits[i];
    }
    return result;
  } catch { return buffer; }
}

async function applyWatermark(imageBuffer, recipeId) {
  if (!existsSync(WATERMARK_PATH)) {
    throw new Error(`Watermark badge not found at ${WATERMARK_PATH}. Run create-watermark-badge.mjs first.`);
  }

  const metadata = await sharp(imageBuffer).metadata();
  const { width, height } = metadata;

  // Resize watermark proportionally for the image size
  const wmWidth = Math.min(160, Math.round(width * 0.2));
  const watermarkBuffer = await sharp(WATERMARK_PATH)
    .resize(wmWidth, null, { fit: 'inside' })
    .png()
    .toBuffer();

  const wmMeta = await sharp(watermarkBuffer).metadata();
  const left = width - wmMeta.width - 12;
  const top = height - wmMeta.height - 12;

  let result = await sharp(imageBuffer)
    .composite([{ input: watermarkBuffer, left, top, blend: 'over' }])
    .jpeg({ quality: 88 })
    .toBuffer();

  result = embedLsbWatermark(result, recipeId);
  return result;
}

async function main() {
  console.log('ChefsBook Watermark Applicator');
  console.log('================================');
  console.log(`Supabase: ${SUPABASE_URL}`);

  if (!existsSync(WATERMARK_PATH)) {
    console.error(`ERROR: Watermark badge missing at ${WATERMARK_PATH}`);
    console.error('Run: node scripts/create-watermark-badge.mjs first');
    process.exit(1);
  }

  const { data: photos, error } = await supabase
    .from('recipe_user_photos')
    .select('id, recipe_id, url, storage_path')
    .eq('is_ai_generated', true);

  if (error) { console.error('Failed to fetch photos:', error.message); process.exit(1); }

  console.log(`Found ${photos.length} AI-generated images to watermark\n`);

  let succeeded = 0;
  let failed = 0;

  for (const photo of photos) {
    const idx = succeeded + failed + 1;
    console.log(`[${idx}/${photos.length}] Recipe ${photo.recipe_id}`);

    try {
      // Use storage_path if available, else parse from URL
      let storagePath = photo.storage_path;
      if (!storagePath) {
        const match = photo.url.match(/\/recipe-user-photos\/(.+)$/);
        if (match) storagePath = decodeURIComponent(match[1]);
      }
      if (!storagePath) {
        // Try alternate URL format
        const altMatch = photo.url.match(/\/storage\/v1\/object\/public\/recipe-user-photos\/(.+)$/);
        if (altMatch) storagePath = decodeURIComponent(altMatch[1]);
      }
      if (!storagePath) {
        console.log(`  ⚠ Could not determine storage path from: ${photo.url}`);
        failed++;
        continue;
      }

      const { data: fileData, error: dlErr } = await supabase.storage
        .from('recipe-user-photos')
        .download(storagePath);

      if (dlErr || !fileData) {
        console.log(`  ✗ Download failed: ${dlErr?.message ?? 'no data'}`);
        failed++;
        continue;
      }

      const imageBuffer = Buffer.from(await fileData.arrayBuffer());
      const watermarkedBuffer = await applyWatermark(imageBuffer, photo.recipe_id);

      const { error: upErr } = await supabase.storage
        .from('recipe-user-photos')
        .upload(storagePath, watermarkedBuffer, { contentType: 'image/jpeg', upsert: true });

      if (upErr) {
        console.log(`  ✗ Upload failed: ${upErr.message}`);
        failed++;
        continue;
      }

      console.log(`  ✓ Watermarked: ${storagePath}`);
      succeeded++;
    } catch (err) {
      console.error(`  ✗ Error: ${err.message}`);
      failed++;
    }

    if (idx < photos.length) await sleep(DELAY_MS);
  }

  console.log('\n================================');
  console.log(`Done: ${succeeded + failed} processed`);
  console.log(`✓ Watermarked: ${succeeded}`);
  console.log(`✗ Failed: ${failed}`);
}

main().catch(console.error);
