import { supabase, supabaseAdmin, logAiCall } from '@chefsbook/db';
import { buildImagePrompt } from '@chefsbook/ai';
import type { ImageTheme, CreativityLevel } from '@chefsbook/ai';
import sharp from 'sharp';
import path from 'path';

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL || 'http://100.110.47.62:8000';
const REPLICATE_API_TOKEN = process.env.REPLICATE_API_TOKEN;
const REGEN_LIMIT = 5;

const PROMPT_STRENGTH_BY_LEVEL: Record<number, number> = {
  1: 0.2, 2: 0.4, 3: 0.6, 4: 0.8, 5: 0.95,
};

export async function POST(req: Request) {
  try {
    const authHeader = req.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const token = authHeader.slice(7);
    const { data: { user } } = await supabase.auth.getUser(token);
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    if (!REPLICATE_API_TOKEN) {
      return Response.json({ error: 'Image generation unavailable. Please try again later.' }, { status: 503 });
    }

    const { recipeId, theme, creativityLevel = 3, replaceExisting = false } = await req.json();
    if (!recipeId) return Response.json({ error: 'recipeId required' }, { status: 400 });

    const { data: recipe } = await supabaseAdmin
      .from('recipes')
      .select('id, title, cuisine, user_id, source_image_description, source_image_url')
      .eq('id', recipeId)
      .single();
    if (!recipe || recipe.user_id !== user.id) {
      return Response.json({ error: 'Recipe not found' }, { status: 404 });
    }

    const { data: profile } = await supabaseAdmin
      .from('user_profiles')
      .select('plan_tier')
      .eq('id', user.id)
      .single();
    const planTier = profile?.plan_tier ?? 'free';

    const { data: adminRow } = await supabaseAdmin
      .from('admin_users')
      .select('role')
      .eq('user_id', user.id)
      .maybeSingle();
    const isAdmin = !!adminRow;

    if (planTier === 'free' && !isAdmin) {
      return Response.json({ error: 'upgrade_required' }, { status: 402 });
    }

    if (replaceExisting) {
      const { data: aiPhoto } = await supabaseAdmin
        .from('recipe_user_photos')
        .select('regen_count')
        .eq('recipe_id', recipeId)
        .eq('is_ai_generated', true)
        .eq('is_primary', true)
        .maybeSingle();
      if ((aiPhoto?.regen_count ?? 0) >= REGEN_LIMIT) {
        return Response.json({ error: 'Regeneration limit reached for this recipe' }, { status: 429 });
      }
    }

    const level = (creativityLevel as CreativityLevel);
    // Pro/Admin or creativity ≤2 (faithful) uses Flux Dev; Chef/Family uses Schnell
    const useFluxDev = isAdmin || planTier === 'pro' || level <= 2;
    const model = useFluxDev
      ? 'black-forest-labs/flux-dev'
      : 'black-forest-labs/flux-schnell';

    const { data: ingredients } = await supabaseAdmin
      .from('recipe_ingredients')
      .select('ingredient')
      .eq('recipe_id', recipeId)
      .limit(6);

    const selectedTheme = (theme ?? 'bright_fresh') as ImageTheme;
    const prompt = buildImagePrompt(
      { title: recipe.title, cuisine: recipe.cuisine, ingredients: ingredients ?? [], source_image_description: recipe.source_image_description },
      selectedTheme,
      undefined,
      level,
    );

    let ogImage: string | null = null;
    if (useFluxDev && recipe.source_image_url) {
      try {
        const res = await fetch(recipe.source_image_url, {
          headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
          signal: AbortSignal.timeout(8000),
          redirect: 'follow',
        });
        if (res.ok) {
          const buf = await res.arrayBuffer();
          if (buf.byteLength > 1000 && buf.byteLength < 10_000_000) {
            const b64 = Buffer.from(buf).toString('base64');
            const mime = res.headers.get('content-type') || 'image/jpeg';
            ogImage = `data:${mime};base64,${b64}`;
          }
        }
      } catch {}
    }

    const input: Record<string, unknown> = {
      prompt,
      num_outputs: 1,
      output_format: 'jpg',
      output_quality: 85,
      seed: Math.floor(Math.random() * 999999),
    };
    if (useFluxDev) {
      input.prompt_strength = PROMPT_STRENGTH_BY_LEVEL[level] ?? 0.6;
      if (ogImage) {
        input.image = ogImage;
      } else {
        input.aspect_ratio = '4:3';
      }
    } else {
      input.aspect_ratio = '4:3';
    }

    const t0 = Date.now();
    const replicateRes = await fetch(
      `https://api.replicate.com/v1/models/${model}/predictions`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${REPLICATE_API_TOKEN}`,
          'Content-Type': 'application/json',
          Prefer: 'wait',
        },
        body: JSON.stringify({ input }),
        signal: AbortSignal.timeout(90000),
      },
    );

    if (!replicateRes.ok) {
      if (replicateRes.status === 402) {
        return Response.json({ error: 'Image generation unavailable. Please try again later.' }, { status: 503 });
      }
      console.error('[mobile-generate-image] Replicate error:', replicateRes.status);
      return Response.json({ error: 'Generation failed. Please try again.' }, { status: 500 });
    }

    const replicateData = await replicateRes.json();
    const outputUrl = replicateData.output?.[0] ?? replicateData.output;
    if (!outputUrl || typeof outputUrl !== 'string') {
      return Response.json({ error: 'Generation failed. Please try again.' }, { status: 500 });
    }

    const imgRes = await fetch(outputUrl, { signal: AbortSignal.timeout(30000) });
    if (!imgRes.ok) return Response.json({ error: 'Failed to download generated image.' }, { status: 500 });
    let imageBuffer = Buffer.from(await imgRes.arrayBuffer());

    // Apply visible watermark
    try {
      const badgePath = path.join(process.cwd(), 'public', 'images', 'watermark-chefsbook.png');
      const watermark = await sharp(badgePath).resize(160, null, { fit: 'inside' }).png().toBuffer();
      const imgMeta = await sharp(imageBuffer).metadata();
      const wmMeta = await sharp(watermark).metadata();
      const left = 12;
      const top = (imgMeta.height ?? 512) - (wmMeta.height ?? 36) - 12;
      imageBuffer = await sharp(imageBuffer)
        .composite([{ input: watermark, left, top, blend: 'over' }])
        .jpeg({ quality: 88 })
        .toBuffer();
    } catch (wmErr) {
      console.warn('[mobile-generate-image] watermark failed, continuing:', wmErr);
    }

    const suffix = replaceExisting ? `-${Date.now()}` : '';
    const fileName = `ai-generated/${recipeId}${suffix}.jpg`;
    const { error: uploadError } = await supabaseAdmin.storage
      .from('recipe-user-photos')
      .upload(fileName, imageBuffer, { contentType: 'image/jpeg', upsert: true });
    if (uploadError) {
      return Response.json({ error: 'Upload failed. Please try again.' }, { status: 500 });
    }

    const publicUrl = `${SUPABASE_URL}/storage/v1/object/public/recipe-user-photos/${fileName}`;
    let newRegenCount = 0;

    if (replaceExisting) {
      const { data: existing } = await supabaseAdmin
        .from('recipe_user_photos')
        .select('id, regen_count')
        .eq('recipe_id', recipeId)
        .eq('is_ai_generated', true)
        .eq('is_primary', true)
        .maybeSingle();
      newRegenCount = (existing?.regen_count ?? 0) + 1;

      const { count: photoCount } = await supabaseAdmin
        .from('recipe_user_photos')
        .select('id', { count: 'exact', head: true })
        .eq('recipe_id', recipeId);

      const planLimits: Record<string, number> = { free: 0, chef: 1, family: 1, pro: 5 };
      const limit = planLimits[planTier] ?? 1;

      if ((photoCount ?? 0) < limit) {
        await supabaseAdmin.from('recipe_user_photos')
          .update({ is_primary: false })
          .eq('recipe_id', recipeId).eq('is_primary', true);
        await supabaseAdmin.from('recipe_user_photos').insert({
          recipe_id: recipeId, user_id: user.id,
          storage_path: fileName, url: publicUrl,
          is_primary: true, is_ai_generated: true,
          sort_order: 0, regen_count: newRegenCount,
        });
      } else {
        await supabaseAdmin.from('recipe_user_photos')
          .update({ url: publicUrl, storage_path: fileName, regen_count: newRegenCount })
          .eq('recipe_id', recipeId).eq('is_ai_generated', true).eq('is_primary', true);
      }
    } else {
      await supabaseAdmin.from('recipe_user_photos')
        .update({ is_primary: false })
        .eq('recipe_id', recipeId).eq('is_primary', true);
      await supabaseAdmin.from('recipe_user_photos').insert({
        recipe_id: recipeId, user_id: user.id,
        storage_path: fileName, url: publicUrl,
        is_primary: true, is_ai_generated: true,
        sort_order: 0, regen_count: 0,
      });
    }

    await supabaseAdmin.from('recipes').update({
      image_generation_status: 'complete',
      has_ai_image: true,
      ai_image_prompt: prompt,
      image_url: publicUrl,
    }).eq('id', recipeId);

    const durationMs = Date.now() - t0;
    const modelKey = useFluxDev ? 'flux-dev' : 'flux-schnell';
    logAiCall({ userId: user.id, action: 'generate_image_mobile', model: modelKey, recipeId, durationMs, success: true }).catch(() => {});

    return Response.json({ url: publicUrl, regenCount: newRegenCount });

  } catch (err: any) {
    console.error('[mobile-generate-image]', err);
    return Response.json({ error: 'Image generation unavailable. Please try again later.' }, { status: 500 });
  }
}
