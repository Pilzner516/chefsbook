#!/usr/bin/env node
/**
 * Batch generate AI images for recipes without photos.
 * Processes ChefsBook-tagged recipes first, then others.
 * Rate-limited to 1 per 5 seconds (Replicate rate limits).
 *
 * Usage: node scripts/generate-recipe-images.mjs
 * Environment: requires SUPABASE_SERVICE_ROLE_KEY + REPLICATE_API_TOKEN
 *   (reads from apps/web/.env.local if not set)
 *
 * Optional flags:
 *   --limit N     Process at most N recipes (default: all)
 *   --cb-only     Only process ChefsBook-tagged recipes
 *   --dry-run     Show what would be processed without calling Replicate
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { resolve, join } from 'path';

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
  } catch { /* no .env.local — rely on exported vars */ }
}
loadEnvFile();

// Prefer localhost for scripts running on RPi5 (avoids Cloudflare tunnel overhead)
const SUPABASE_URL = process.env.SUPABASE_URL || 'http://localhost:8000';
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const REPLICATE_TOKEN = process.env.REPLICATE_API_TOKEN;

if (!SERVICE_KEY) { console.error('SUPABASE_SERVICE_ROLE_KEY required'); process.exit(1); }
if (!REPLICATE_TOKEN) { console.error('REPLICATE_API_TOKEN required'); process.exit(1); }

const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

// ── Parse CLI flags ──
const args = process.argv.slice(2);
const limitIdx = args.indexOf('--limit');
const MAX = limitIdx >= 0 ? parseInt(args[limitIdx + 1], 10) : 999;
const CB_ONLY = args.includes('--cb-only');
const DRY_RUN = args.includes('--dry-run');

// ── Watermark paths ──
const CHEFS_HAT_PATHS = [
  join(process.cwd(), 'docs', 'pics', 'CBHat.png'),
  join(process.cwd(), 'apps', 'web', 'public', 'images', 'chefs-hat.png'),
];

// ── Image generation ──

function buildPrompt(title, cuisine, ingredients) {
  const keyIng = (ingredients || [])
    .slice(0, 4)
    .map(i => i.ingredient || '')
    .filter(Boolean)
    .join(', ');
  return `Professional food photography of ${title}, ${
    cuisine ? cuisine + ' cuisine, ' : ''
  }${keyIng ? `featuring ${keyIng}. ` : ''}Editorial style, natural window light, shallow depth of field, styled on a beautiful plate or bowl, warm tones, appetizing presentation, high resolution, no text, no watermarks, no people, photorealistic.`;
}

async function generateImage(prompt) {
  const res = await fetch(
    'https://api.replicate.com/v1/models/black-forest-labs/flux-dev/predictions',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${REPLICATE_TOKEN}`,
        'Content-Type': 'application/json',
        Prefer: 'wait',
      },
      body: JSON.stringify({
        input: {
          prompt,
          aspect_ratio: '4:3',
          num_outputs: 1,
          output_format: 'jpg',
          output_quality: 85,
          safety_tolerance: 5,
        },
      }),
    },
  );
  if (!res.ok) {
    const errBody = await res.text().catch(() => '');
    throw new Error(`Replicate ${res.status}: ${errBody.slice(0, 200)}`);
  }
  const data = await res.json();
  return data.output?.[0] ?? data.output ?? null;
}

async function downloadImage(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Download failed: ${res.status}`);
  return Buffer.from(await res.arrayBuffer());
}

async function addWatermark(imageBuffer) {
  // Dynamic import sharp (ESM)
  const sharp = (await import('sharp')).default;

  let watermarkBuf;
  for (const p of CHEFS_HAT_PATHS) {
    try {
      watermarkBuf = await sharp(p).resize(60, 60).ensureAlpha().png().toBuffer();
      break;
    } catch { continue; }
  }
  if (!watermarkBuf) {
    console.warn('  [warn] CBHat watermark not found — skipping visible watermark');
    return imageBuffer;
  }

  return sharp(imageBuffer)
    .composite([{ input: watermarkBuf, gravity: 'southeast', blend: 'over' }])
    .jpeg({ quality: 85 })
    .toBuffer();
}

// ── Main ──

async function main() {
  console.log(`\nGenerating AI recipe images`);
  console.log(`  Supabase: ${SUPABASE_URL}`);
  console.log(`  Limit: ${MAX === 999 ? 'all' : MAX}`);
  console.log(`  CB-only: ${CB_ONLY}`);
  console.log(`  Dry run: ${DRY_RUN}\n`);

  // Find recipes without images, ChefsBook-tagged first
  const { data: allRecipes, error } = await supabase
    .from('recipes')
    .select('id, title, cuisine, user_id, tags, has_ai_image, image_generation_status')
    .eq('has_ai_image', false)
    .is('image_generation_status', null)
    .order('created_at', { ascending: true });

  if (error) { console.error('Query error:', error.message); process.exit(1); }

  // Batch-fetch recipe IDs that already have photos, then exclude
  const recipeIds = (allRecipes || []).map(r => r.id);
  const { data: photosExist } = await supabase
    .from('recipe_user_photos')
    .select('recipe_id')
    .in('recipe_id', recipeIds.length > 0 ? recipeIds : ['00000000-0000-0000-0000-000000000000']);
  const hasPhotoSet = new Set((photosExist || []).map(p => p.recipe_id));
  const candidates = (allRecipes || []).filter(r => !hasPhotoSet.has(r.id));

  // Sort: ChefsBook-tagged first
  candidates.sort((a, b) => {
    const aTag = (a.tags || []).includes('ChefsBook') ? 0 : 1;
    const bTag = (b.tags || []).includes('ChefsBook') ? 0 : 1;
    return aTag - bTag;
  });

  const filtered = CB_ONLY
    ? candidates.filter(r => (r.tags || []).includes('ChefsBook'))
    : candidates;
  const batch = filtered.slice(0, MAX);

  const cbCount = batch.filter(r => (r.tags || []).includes('ChefsBook')).length;
  console.log(`Found ${candidates.length} recipes without images (${cbCount} ChefsBook-tagged)`);
  console.log(`Processing ${batch.length} recipes\n`);

  let generated = 0;
  let failed = 0;
  let skipped = 0;

  for (let i = 0; i < batch.length; i++) {
    const recipe = batch[i];
    const isCB = (recipe.tags || []).includes('ChefsBook');
    const tag = isCB ? '[CB]' : '[--]';

    if (DRY_RUN) {
      console.log(`  ${tag} [dry] ${recipe.title}`);
      generated++;
      continue;
    }

    try {
      // Fetch ingredients for prompt
      const { data: ingredients } = await supabase
        .from('recipe_ingredients')
        .select('ingredient')
        .eq('recipe_id', recipe.id)
        .limit(6);

      const prompt = buildPrompt(recipe.title, recipe.cuisine, ingredients);

      // Mark as generating
      await supabase.from('recipes').update({ image_generation_status: 'generating' }).eq('id', recipe.id);

      // Generate
      console.log(`  ${tag} [${i + 1}/${batch.length}] ${recipe.title}...`);
      const imageUrl = await generateImage(prompt);
      if (!imageUrl) throw new Error('No image URL returned');

      // Download + watermark
      let buf = await downloadImage(imageUrl);
      buf = await addWatermark(buf);

      // Upload to Supabase storage
      const fileName = `ai-generated/${recipe.id}.jpg`;
      const { error: upErr } = await supabase.storage
        .from('recipe-user-photos')
        .upload(fileName, buf, { contentType: 'image/jpeg', upsert: true });
      if (upErr) throw new Error(`Upload: ${upErr.message}`);

      const publicUrl = `${SUPABASE_URL}/storage/v1/object/public/recipe-user-photos/${fileName}`;

      // Insert photo row
      await supabase.from('recipe_user_photos').insert({
        recipe_id: recipe.id,
        user_id: recipe.user_id,
        storage_path: fileName,
        url: publicUrl,
        is_primary: true,
        is_ai_generated: true,
        sort_order: 0,
      });

      // Update recipe metadata
      await supabase.from('recipes').update({
        image_generation_status: 'complete',
        has_ai_image: true,
        ai_image_prompt: prompt.slice(0, 500),
      }).eq('id', recipe.id);

      generated++;
      console.log(`         done`);
    } catch (err) {
      failed++;
      console.error(`         FAIL: ${err.message}`);

      // Mark failed
      try { await supabase.from('recipes').update({ image_generation_status: 'failed' }).eq('id', recipe.id); } catch {}

      // Abort on auth/billing errors
      if (err.message?.includes('authentication') || err.message?.includes('billing') || err.message?.includes('401')) {
        console.error('\nAborting: API auth/billing error.');
        break;
      }
    }

    // Rate limit: 5 seconds between requests
    if (i < batch.length - 1 && !DRY_RUN) {
      await new Promise(r => setTimeout(r, 5000));
    }
  }

  const cost = generated * 0.025;
  console.log(`\n${'='.repeat(50)}`);
  console.log(`Done: ${generated} generated, ${failed} failed, ${skipped} skipped`);
  console.log(`Estimated cost: $${cost.toFixed(2)} (${generated} x $0.025)`);
  console.log(`${'='.repeat(50)}\n`);
}

main().catch(err => { console.error(err); process.exit(1); });
