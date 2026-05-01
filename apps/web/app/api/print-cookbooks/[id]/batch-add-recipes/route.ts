import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin, PLAN_LIMITS } from '@chefsbook/db';
import type { PlanTier } from '@chefsbook/db';

async function getUserFromRequest(request: NextRequest): Promise<string | null> {
  const authHeader = request.headers.get('authorization');
  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.slice(7);
    const { data } = await supabaseAdmin.auth.getUser(token);
    return data.user?.id ?? null;
  }
  return null;
}

async function checkCanPrint(userId: string): Promise<boolean> {
  const { data: profile } = await supabaseAdmin
    .from('user_profiles')
    .select('plan_tier')
    .eq('id', userId)
    .single();
  const plan = (profile?.plan_tier as PlanTier) ?? 'free';
  return PLAN_LIMITS[plan]?.canPrintCookbook ?? false;
}

/**
 * POST /api/print-cookbooks/[id]/batch-add-recipes
 * Body: { recipe_ids: string[] }
 * Appends recipe_ids to printed_cookbooks.recipe_ids[], deduplicating.
 * Returns: { added: number, skipped: number, total: number }
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const userId = await getUserFromRequest(request);
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const canPrint = await checkCanPrint(userId);
  if (!canPrint) {
    return NextResponse.json({ error: 'upgrade_required' }, { status: 403 });
  }

  const body = await request.json();
  const { recipe_ids: newRecipeIds } = body as { recipe_ids: string[] };

  if (!Array.isArray(newRecipeIds) || newRecipeIds.length === 0) {
    return NextResponse.json({ error: 'recipe_ids array required' }, { status: 400 });
  }

  // Fetch existing cookbook and verify ownership
  const { data: cookbook, error: fetchError } = await supabaseAdmin
    .from('printed_cookbooks')
    .select('id, recipe_ids, status')
    .eq('id', id)
    .eq('user_id', userId)
    .single();

  if (fetchError || !cookbook) {
    return NextResponse.json({ error: 'Cookbook not found' }, { status: 404 });
  }

  if (cookbook.status === 'ordered') {
    return NextResponse.json({ error: 'Cannot edit an ordered cookbook' }, { status: 400 });
  }

  const existingIds = new Set<string>(cookbook.recipe_ids ?? []);
  const existingCount = existingIds.size;

  // Add new IDs, deduplicating
  for (const rid of newRecipeIds) {
    existingIds.add(rid);
  }

  const mergedIds = Array.from(existingIds);
  const added = mergedIds.length - existingCount;
  const skipped = newRecipeIds.length - added;

  // Check max limit
  if (mergedIds.length > 80) {
    return NextResponse.json({
      error: `Maximum 80 recipes allowed. You have ${existingCount}, trying to add ${newRecipeIds.length} would exceed limit.`
    }, { status: 400 });
  }

  // Update the cookbook
  const { error: updateError } = await supabaseAdmin
    .from('printed_cookbooks')
    .update({
      recipe_ids: mergedIds,
      updated_at: new Date().toISOString(),
      status: 'draft',
      interior_pdf_url: null,
      cover_pdf_url: null,
      page_count: null,
    })
    .eq('id', id);

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  return NextResponse.json({
    added,
    skipped,
    total: mergedIds.length,
  });
}
