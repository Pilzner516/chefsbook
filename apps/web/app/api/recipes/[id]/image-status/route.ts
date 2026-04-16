import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@chefsbook/db';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  const { data: recipe } = await supabaseAdmin
    .from('recipes')
    .select('image_generation_status')
    .eq('id', id)
    .single();

  const { data: photos } = await supabaseAdmin
    .from('recipe_user_photos')
    .select('url, is_primary, is_ai_generated, regen_count')
    .eq('recipe_id', id)
    .order('is_primary', { ascending: false })
    .limit(1);

  const photo = photos?.[0] ?? null;

  return NextResponse.json({
    status: recipe?.image_generation_status ?? 'none',
    url: photo?.url ?? null,
    isAiGenerated: photo?.is_ai_generated ?? false,
    regenCount: photo?.regen_count ?? 0,
  });
}
