#!/usr/bin/env node
/**
 * Generate 10 theme example images using the same pasta dish.
 * Uses Flux Schnell (~$0.003/image = ~$0.03 total).
 * Saves to apps/web/public/images/themes/[theme-id].jpg
 *
 * Usage: node scripts/generate-theme-examples.mjs
 * Environment: REPLICATE_API_TOKEN (reads apps/web/.env.local if not set)
 */
import { readFileSync, mkdirSync, writeFileSync, existsSync } from 'fs';
import { resolve, join } from 'path';

// ── Load env ──
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
  } catch { /* ok */ }
}
loadEnvFile();

const REPLICATE_TOKEN = process.env.REPLICATE_API_TOKEN;
if (!REPLICATE_TOKEN) { console.error('REPLICATE_API_TOKEN required'); process.exit(1); }

const BASE_DISH = 'pappardelle pasta with rich tomato sauce and fresh basil leaves, parmesan shavings';

const THEMES = [
  { id: 'bright-fresh', prompt: 'natural window light, white marble surface, bright airy atmosphere, vibrant fresh colors, clean minimal styling, soft shadows' },
  { id: 'farmhouse', prompt: 'rustic wooden table, linen napkins, warm golden hour light, farmhouse aesthetic, cast iron or ceramic, cozy homestyle' },
  { id: 'fine-dining', prompt: 'dark slate surface, elegant restaurant plating, dramatic side lighting, fine dining presentation, precise garnish, high contrast' },
  { id: 'editorial', prompt: 'overhead flat lay, styled food photography, magazine editorial aesthetic, neutral linen background, carefully arranged props' },
  { id: 'garden-fresh', prompt: 'outdoor garden setting, dappled natural light, fresh herbs scattered, terracotta surfaces, botanical atmosphere' },
  { id: 'candlelit', prompt: 'candlelight atmosphere, warm amber tones, moody evening lighting, dark rich background, intimate dinner setting' },
  { id: 'japanese-minimal', prompt: 'clean white ceramic, zen minimalist composition, Japanese aesthetic, negative space, precise plating, neutral background' },
  { id: 'mediterranean', prompt: 'bright Mediterranean sunshine, blue and white tiles, olive wood surface, vibrant produce colors, sun-drenched atmosphere' },
  { id: 'cozy-autumn', prompt: 'warm amber autumn tones, textured wool or linen, cozy hygge atmosphere, rich earthy colors, comfort food styling' },
  { id: 'modern-glam', prompt: 'sleek black marble surface, metallic accents, high contrast dramatic lighting, contemporary modern aesthetic, sophisticated' },
];

const OUTPUT_DIR = resolve(process.cwd(), 'apps/web/public/images/themes');
mkdirSync(OUTPUT_DIR, { recursive: true });

async function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function generateImage(prompt) {
  // Use Flux Schnell for theme previews (~$0.003/image)
  const res = await fetch('https://api.replicate.com/v1/models/black-forest-labs/flux-schnell/predictions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${REPLICATE_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      input: {
        prompt,
        aspect_ratio: '4:3',
        output_format: 'jpg',
        output_quality: 85,
      },
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Replicate API error ${res.status}: ${body}`);
  }

  const prediction = await res.json();

  // Poll for completion
  let result = prediction;
  while (result.status !== 'succeeded' && result.status !== 'failed') {
    await sleep(2000);
    const pollRes = await fetch(`https://api.replicate.com/v1/predictions/${result.id}`, {
      headers: { 'Authorization': `Bearer ${REPLICATE_TOKEN}` },
    });
    result = await pollRes.json();
  }

  if (result.status === 'failed') throw new Error(`Generation failed: ${result.error}`);
  const imageUrl = Array.isArray(result.output) ? result.output[0] : result.output;
  if (!imageUrl) throw new Error('No output URL');

  // Download image
  const imgRes = await fetch(imageUrl);
  return Buffer.from(await imgRes.arrayBuffer());
}

async function main() {
  console.log('Generating 10 theme example images');
  console.log(`Output: ${OUTPUT_DIR}\n`);

  let succeeded = 0;
  let failed = 0;

  for (const theme of THEMES) {
    const outPath = join(OUTPUT_DIR, `${theme.id}.jpg`);
    if (existsSync(outPath)) {
      console.log(`[skip] ${theme.id} — already exists`);
      succeeded++;
      continue;
    }

    const prompt = `Professional food photography of ${BASE_DISH}, ${theme.prompt}, high resolution, no text, no watermarks, no people, photorealistic`;
    console.log(`[gen] ${theme.id}...`);

    try {
      const buffer = await generateImage(prompt);
      writeFileSync(outPath, buffer);
      console.log(`  ✓ ${theme.id} (${Math.round(buffer.length / 1024)}KB)`);
      succeeded++;
    } catch (err) {
      console.error(`  ✗ ${theme.id}: ${err.message}`);
      failed++;
    }

    // Rate limit: 12s between calls (Replicate <$5 account = 6 req/min)
    if (succeeded + failed < THEMES.length) await sleep(12000);
  }

  console.log(`\nDone: ${succeeded} generated, ${failed} failed`);
}

main().catch(console.error);
