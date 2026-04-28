import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin, PLAN_LIMITS } from '@chefsbook/db';
import type { PlanTier } from '@chefsbook/db';

async function getUserFromRequest(request: NextRequest): Promise<string | null> {
  const authHeader = request.headers.get('authorization');
  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.slice(7);
    // Use supabaseAdmin to verify JWT (anon client cannot validate tokens)
    const { data } = await supabaseAdmin.auth.getUser(token);
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

// GET /api/print-cookbooks/[id] - Get a specific cookbook
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const userId = await getUserFromRequest(request);
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { data, error } = await supabaseAdmin
    .from('printed_cookbooks')
    .select('*')
    .eq('id', id)
    .eq('user_id', userId)
    .single();

  if (error || !data) {
    return NextResponse.json({ error: 'Cookbook not found' }, { status: 404 });
  }

  return NextResponse.json({ cookbook: data });
}

// PUT /api/print-cookbooks/[id] - Update a cookbook draft
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const userId = await getUserFromRequest(request);
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const canPrint = await checkProPlan(userId);
  if (!canPrint) {
    return NextResponse.json({ error: 'Pro plan required' }, { status: 403 });
  }

  // Verify ownership
  const { data: existing } = await supabaseAdmin
    .from('printed_cookbooks')
    .select('id, status')
    .eq('id', id)
    .eq('user_id', userId)
    .single();

  if (!existing) {
    return NextResponse.json({ error: 'Cookbook not found' }, { status: 404 });
  }

  if (existing.status === 'ordered') {
    return NextResponse.json({ error: 'Cannot edit an ordered cookbook' }, { status: 400 });
  }

  const body = await request.json();
  const { title, subtitle, author_name, cover_style, recipe_ids } = body;

  if (recipe_ids && recipe_ids.length < 5) {
    return NextResponse.json({ error: 'Minimum 5 recipes required' }, { status: 400 });
  }

  if (recipe_ids && recipe_ids.length > 80) {
    return NextResponse.json({ error: 'Maximum 80 recipes allowed' }, { status: 400 });
  }

  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (title !== undefined) updates.title = title;
  if (subtitle !== undefined) updates.subtitle = subtitle;
  if (author_name !== undefined) updates.author_name = author_name;
  if (cover_style !== undefined) updates.cover_style = cover_style;
  if (recipe_ids !== undefined) {
    updates.recipe_ids = recipe_ids;
    updates.status = 'draft';
    updates.interior_pdf_url = null;
    updates.cover_pdf_url = null;
    updates.page_count = null;
  }

  const { data, error } = await supabaseAdmin
    .from('printed_cookbooks')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ cookbook: data });
}

// DELETE /api/print-cookbooks/[id] - Delete a cookbook draft
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const userId = await getUserFromRequest(request);
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Verify ownership and status
  const { data: existing } = await supabaseAdmin
    .from('printed_cookbooks')
    .select('id, status')
    .eq('id', id)
    .eq('user_id', userId)
    .single();

  if (!existing) {
    return NextResponse.json({ error: 'Cookbook not found' }, { status: 404 });
  }

  if (existing.status === 'ordered') {
    return NextResponse.json({ error: 'Cannot delete an ordered cookbook' }, { status: 400 });
  }

  const { error } = await supabaseAdmin
    .from('printed_cookbooks')
    .delete()
    .eq('id', id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
