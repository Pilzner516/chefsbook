import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin, PLAN_LIMITS } from '@chefsbook/db';
import type { PlanTier } from '@chefsbook/db';

async function getUserFromRequest(request: NextRequest): Promise<string | null> {
  const authHeader = request.headers.get('authorization');
  console.log('[print-cookbooks] Auth header present:', !!authHeader);
  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.slice(7);
    console.log('[print-cookbooks] Token length:', token.length);
    // Use supabaseAdmin to verify JWT (anon client cannot validate tokens)
    const { data, error } = await supabaseAdmin.auth.getUser(token);
    console.log('[print-cookbooks] getUser result:', { userId: data.user?.id, error: error?.message });
    return data.user?.id ?? null;
  }
  return null;
}

async function checkProPlan(userId: string): Promise<boolean> {
  const { data: profile } = await supabaseAdmin
    .from('user_profiles')
    .select('plan_tier')
    .eq('id', userId)
    .single();
  const plan = (profile?.plan_tier as PlanTier) ?? 'free';
  return PLAN_LIMITS[plan]?.canPrintCookbook ?? false;
}

// GET /api/print-cookbooks - List user's printed cookbooks
export async function GET(request: NextRequest) {
  const userId = await getUserFromRequest(request);
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { data, error } = await supabaseAdmin
    .from('printed_cookbooks')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ cookbooks: data });
}

// POST /api/print-cookbooks - Create a new printed cookbook draft
export async function POST(request: NextRequest) {
  const userId = await getUserFromRequest(request);
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const canPrint = await checkProPlan(userId);
  if (!canPrint) {
    return NextResponse.json({ error: 'Pro plan required for printed cookbooks' }, { status: 403 });
  }

  const body = await request.json();
  const { title, subtitle, author_name, cover_style, recipe_ids, foreword } = body;

  if (!title || !author_name) {
    return NextResponse.json({ error: 'Title and author name are required' }, { status: 400 });
  }

  if (!recipe_ids || recipe_ids.length < 5) {
    return NextResponse.json({ error: 'Minimum 5 recipes required' }, { status: 400 });
  }

  if (recipe_ids.length > 80) {
    return NextResponse.json({ error: 'Maximum 80 recipes allowed' }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin
    .from('printed_cookbooks')
    .insert({
      user_id: userId,
      title,
      subtitle: subtitle || null,
      author_name,
      cover_style: cover_style || 'classic',
      recipe_ids,
      foreword: foreword || null,
      status: 'draft',
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ cookbook: data });
}
