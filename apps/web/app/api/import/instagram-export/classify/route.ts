import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { classifyFoodImage, extractInstagramExportCaption } from '@chefsbook/ai';
import { PLAN_LIMITS, logAiCall } from '@chefsbook/db';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

interface BatchPost {
  uri: string;
  imageBase64: string;
  caption: string;
  timestamp: number;
}

interface ClassifyResult {
  uri: string;
  isFood: boolean;
  extracted: {
    title: string | null;
    cuisine: string | null;
    tags: string[];
    notes: string | null;
  } | null;
}

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.slice(7);
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: profile } = await supabaseAdmin
      .from('user_profiles')
      .select('plan_tier')
      .eq('id', user.id)
      .single();

    const plan = (profile?.plan_tier ?? 'free') as keyof typeof PLAN_LIMITS;
    if (plan !== 'pro') {
      return NextResponse.json(
        { error: 'plan_required', plan: 'pro' },
        { status: 403 }
      );
    }

    const { batch } = (await request.json()) as { batch: BatchPost[] };
    if (!Array.isArray(batch) || batch.length === 0) {
      return NextResponse.json({ error: 'No posts provided' }, { status: 400 });
    }

    if (batch.length > 20) {
      return NextResponse.json(
        { error: 'Batch size exceeds 20' },
        { status: 400 }
      );
    }

    const results: ClassifyResult[] = [];

    for (const post of batch) {
      const { isFood, tokensIn: classifyTokensIn, tokensOut: classifyTokensOut } = await classifyFoodImage(post.imageBase64);

      await logAiCall({
        userId: user.id,
        action: 'instagram_food_classify',
        model: 'haiku',
        tokensIn: classifyTokensIn ?? 300,
        tokensOut: classifyTokensOut ?? 2,
        success: true,
      });

      if (!isFood) {
        results.push({ uri: post.uri, isFood: false, extracted: null });
        continue;
      }

      const { extracted, tokensIn: extractTokensIn, tokensOut: extractTokensOut } = await extractInstagramExportCaption(post.caption || '');

      await logAiCall({
        userId: user.id,
        action: 'instagram_caption_extract',
        model: 'haiku',
        tokensIn: extractTokensIn ?? 100,
        tokensOut: extractTokensOut ?? 100,
        success: true,
      });

      results.push({ uri: post.uri, isFood: true, extracted });
    }

    return NextResponse.json({ results });
  } catch (error) {
    console.error('[instagram-export/classify] Error:', error);
    return NextResponse.json(
      { error: 'Classification failed' },
      { status: 500 }
    );
  }
}
