import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@chefsbook/db';

const STUCK_THRESHOLD_MS = 60_000; // 1 minute

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  const { data: recipe } = await supabaseAdmin
    .from('recipes')
    .select('image_generation_status, image_generation_started_at')
    .eq('id', id)
    .single();

  const { data: photos } = await supabaseAdmin
    .from('recipe_user_photos')
    .select('url, is_primary, is_ai_generated, regen_count')
    .eq('recipe_id', id)
    .order('is_primary', { ascending: false })
    .limit(1);

  const photo = photos?.[0] ?? null;
  const primaryAiPhoto = photo?.is_ai_generated ? photo : null;

  const rawStatus = recipe?.image_generation_status ?? 'none';
  const isPending = rawStatus === 'pending' || rawStatus === 'generating';
  const startedAt = recipe?.image_generation_started_at
    ? new Date(recipe.image_generation_started_at).getTime()
    : null;
  const elapsed = startedAt ? Date.now() - startedAt : Infinity;
  const isStuck =
    isPending && !primaryAiPhoto && elapsed > STUCK_THRESHOLD_MS;

  return NextResponse.json({
    status: isStuck ? 'failed' : rawStatus,
    url: photo?.url ?? null,
    isAiGenerated: photo?.is_ai_generated ?? false,
    regenCount: photo?.regen_count ?? 0,
  });
}
