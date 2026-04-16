import sharp from 'sharp';
import path from 'path';
import { supabaseAdmin } from '@chefsbook/db';

// Use the Tailscale IP for storage URLs stored in DB — reachable from all devices
// (NOT api.chefsbk.app which needs apikey header, NOT localhost which is unreachable from browsers)
const SUPABASE_STORAGE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL || 'http://100.110.47.62:8000';
const REPLICATE_API_TOKEN = process.env.REPLICATE_API_TOKEN;

// Path to the CBHat watermark image
const CHEFS_HAT_PATH = path.join(process.cwd(), '..', '..', 'docs', 'pics', 'CBHat.png');

/**
 * Generate a food photography prompt from recipe data.
 */
function buildImagePrompt(recipe: {
  title: string;
  cuisine?: string | null;
  ingredients?: Array<{ ingredient?: string; name?: string }>;
  tags?: string[];
}): string {
  const keyIngredients = (recipe.ingredients ?? [])
    .slice(0, 4)
    .map((i) => i.ingredient || i.name || '')
    .filter(Boolean)
    .join(', ');

  return `Professional food photography of ${recipe.title}, ${
    recipe.cuisine ? recipe.cuisine + ' cuisine, ' : ''
  }${keyIngredients ? `featuring ${keyIngredients}. ` : ''}Editorial style, natural window light, shallow depth of field, styled on a beautiful plate or bowl, warm tones, appetizing presentation, high resolution, no text, no watermarks, no people, photorealistic.`;
}

/**
 * Call Replicate Flux Dev to generate an image.
 * Returns the image URL from Replicate or null on failure.
 * ~$0.025 per image.
 */
export async function generateRecipeImage(recipe: {
  title: string;
  cuisine?: string | null;
  ingredients?: Array<{ ingredient?: string; name?: string }>;
  tags?: string[];
}): Promise<string | null> {
  if (!REPLICATE_API_TOKEN) {
    console.warn('REPLICATE_API_TOKEN not set — skipping image generation');
    return null;
  }

  const prompt = buildImagePrompt(recipe);

  const response = await fetch(
    'https://api.replicate.com/v1/models/black-forest-labs/flux-dev/predictions',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${REPLICATE_API_TOKEN}`,
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

  if (!response.ok) {
    console.error('Replicate API error:', response.status, await response.text().catch(() => ''));
    return null;
  }

  const data = await response.json();
  const outputUrl = data.output?.[0] ?? data.output;
  if (!outputUrl || typeof outputUrl !== 'string') return null;

  return outputUrl;
}

/**
 * Download an image from a URL and return it as a Buffer.
 */
async function downloadImage(url: string): Promise<Buffer> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to download image: ${res.status}`);
  const arrayBuffer = await res.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

/**
 * Add the ChefsBook hat watermark (visible) to the bottom-right corner.
 * 60x60px, semi-transparent.
 */
async function addVisibleWatermark(imageBuffer: Buffer): Promise<Buffer> {
  let watermark: Buffer;
  try {
    watermark = await sharp(CHEFS_HAT_PATH)
      .resize(60, 60)
      .ensureAlpha()
      .modulate({ brightness: 1 })
      .png()
      .toBuffer();
  } catch {
    // Fallback: try alternate path (when running from apps/web)
    const altPath = path.join(process.cwd(), 'public', 'images', 'chefs-hat.png');
    watermark = await sharp(altPath)
      .resize(60, 60)
      .ensureAlpha()
      .png()
      .toBuffer();
  }

  return sharp(imageBuffer)
    .composite([
      {
        input: watermark,
        gravity: 'southeast',
        blend: 'over',
      },
    ])
    .jpeg({ quality: 85 })
    .toBuffer();
}

// ── Invisible LSB Steganographic Watermark ──

const WATERMARK_MAGIC = 'CBWM'; // 4-byte magic header to detect watermarks

/**
 * Encode a string payload into image pixel LSBs.
 * Payload format: CBWM + length(2 bytes) + payload string bytes
 * Embedded in the blue channel LSBs of raw pixels.
 */
async function embedInvisibleWatermark(
  imageBuffer: Buffer,
  recipeId: string,
): Promise<Buffer> {
  const payload = `chefsbk.app|${recipeId}|${Date.now()}`;
  const payloadBytes = Buffer.from(payload, 'utf-8');

  // Header: magic (4) + length (2) + payload
  const header = Buffer.alloc(6);
  header.write(WATERMARK_MAGIC, 0, 4, 'ascii');
  header.writeUInt16BE(payloadBytes.length, 4);
  const fullPayload = Buffer.concat([header, payloadBytes]);

  // Get raw pixel data
  const image = sharp(imageBuffer);
  const metadata = await image.metadata();
  const { data: rawData, info } = await image
    .raw()
    .toBuffer({ resolveWithObject: true });

  const totalPixels = info.width * info.height;
  const bitsNeeded = fullPayload.length * 8;

  if (bitsNeeded > totalPixels) {
    // Image too small to embed watermark — return as-is
    return imageBuffer;
  }

  // Embed bits into LSB of the blue channel (every 3rd byte in RGB, every 4th in RGBA)
  const channels = info.channels;
  const pixelData = Buffer.from(rawData);

  for (let bitIndex = 0; bitIndex < bitsNeeded; bitIndex++) {
    const byteIndex = Math.floor(bitIndex / 8);
    const bitPosition = 7 - (bitIndex % 8);
    const bit = (fullPayload[byteIndex] >> bitPosition) & 1;

    // Target the blue channel of pixel bitIndex
    const pixelOffset = bitIndex * channels + 2; // blue channel offset
    if (pixelOffset < pixelData.length) {
      pixelData[pixelOffset] = (pixelData[pixelOffset] & 0xfe) | bit;
    }
  }

  return sharp(pixelData, {
    raw: { width: info.width, height: info.height, channels: info.channels },
  })
    .jpeg({ quality: 90 }) // slightly higher quality to preserve LSB
    .toBuffer();
}

/**
 * Full pipeline: generate image → download → visible watermark → invisible watermark → upload.
 */
export async function generateAndSaveRecipeImage(
  recipeId: string,
  recipe: {
    title: string;
    cuisine?: string | null;
    ingredients?: Array<{ ingredient?: string; name?: string }>;
    tags?: string[];
    user_id: string;
  },
): Promise<void> {
  // Mark as generating
  await supabaseAdmin
    .from('recipes')
    .update({ image_generation_status: 'generating' })
    .eq('id', recipeId);

  const imageUrl = await generateRecipeImage(recipe);
  if (!imageUrl) throw new Error('Image generation returned null');

  // Download the generated image
  let imageBuffer = await downloadImage(imageUrl);

  // Add visible ChefsBook hat watermark
  imageBuffer = await addVisibleWatermark(imageBuffer);

  // Embed invisible steganographic watermark
  imageBuffer = await embedInvisibleWatermark(imageBuffer, recipeId);

  // Upload to Supabase storage
  const fileName = `ai-generated/${recipeId}.jpg`;
  const { error: uploadError } = await supabaseAdmin.storage
    .from('recipe-user-photos')
    .upload(fileName, imageBuffer, {
      contentType: 'image/jpeg',
      upsert: true,
    });

  if (uploadError) throw uploadError;

  const publicUrl = `${SUPABASE_STORAGE_URL}/storage/v1/object/public/recipe-user-photos/${fileName}`;

  // Insert as primary photo
  await supabaseAdmin.from('recipe_user_photos').insert({
    recipe_id: recipeId,
    user_id: recipe.user_id,
    storage_path: fileName,
    url: publicUrl,
    is_primary: true,
    is_ai_generated: true,
    sort_order: 0,
  });

  // Update recipe metadata
  await supabaseAdmin
    .from('recipes')
    .update({
      image_generation_status: 'complete',
      has_ai_image: true,
      ai_image_prompt: buildImagePrompt(recipe),
    })
    .eq('id', recipeId);
}

/**
 * Trigger image generation as a background task (non-blocking).
 */
export function triggerImageGeneration(
  recipeId: string,
  recipe: {
    title: string;
    cuisine?: string | null;
    ingredients?: Array<{ ingredient?: string; name?: string }>;
    tags?: string[];
    user_id: string;
  },
): void {
  // Fire-and-forget background generation
  (async () => {
    try {
      await supabaseAdmin
        .from('recipes')
        .update({ image_generation_status: 'pending' })
        .eq('id', recipeId);

      await generateAndSaveRecipeImage(recipeId, recipe);
    } catch (err) {
      console.error(`Image generation failed for recipe ${recipeId}:`, err);
      try {
        await supabaseAdmin
          .from('recipes')
          .update({ image_generation_status: 'failed' })
          .eq('id', recipeId);
      } catch { /* silent */ }
    }
  })();
}
