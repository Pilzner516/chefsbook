import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin, PLAN_LIMITS } from '@chefsbook/db';
import type { PlanTier } from '@chefsbook/db';
import type { BookLayout } from '@/lib/book-layout';

async function getUserFromRequest(request: NextRequest): Promise<string | null> {
  const authHeader = request.headers.get('authorization');
  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.slice(7);
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

// GET /api/print-cookbook/[id] - Get a cookbook
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const userId = await getUserFromRequest(request);
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { data: cookbook, error } = await supabaseAdmin
      .from('printed_cookbooks')
      .select('*')
      .eq('id', id)
      .eq('user_id', userId)
      .single();

    if (error || !cookbook) {
      return NextResponse.json({ error: 'Cookbook not found' }, { status: 404 });
    }

    return NextResponse.json({ cookbook });
  } catch (error) {
    console.error('Failed to get cookbook:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to get cookbook' },
      { status: 500 }
    );
  }
}

// PATCH /api/print-cookbook/[id] - Update a cookbook's book_layout
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
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

  try {
    // First verify ownership
    const { data: existing, error: fetchError } = await supabaseAdmin
      .from('printed_cookbooks')
      .select('user_id')
      .eq('id', id)
      .single();

    if (fetchError || !existing) {
      return NextResponse.json({ error: 'Cookbook not found' }, { status: 404 });
    }

    if (existing.user_id !== userId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();
    const bookLayout = body.book_layout as BookLayout | undefined;

    // Build update object
    const updateData: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    if (bookLayout) {
      updateData.book_layout = bookLayout;

      // Sync derived columns from book_layout for backward compatibility
      const coverCard = bookLayout.cards.find((c) => c.type === 'cover');
      if (coverCard && coverCard.type === 'cover') {
        updateData.title = coverCard.title;
        updateData.subtitle = coverCard.subtitle || null;
        updateData.author_name = coverCard.author;
        updateData.cover_style = coverCard.cover_style;
        updateData.cover_image_url = coverCard.image_url || null;
      }

      // Extract recipe_ids from recipe cards
      const recipeCards = bookLayout.cards.filter((c) => c.type === 'recipe');
      updateData.recipe_ids = recipeCards.map((c) => (c as { recipe_id: string }).recipe_id);

      // Extract foreword
      const forewordCard = bookLayout.cards.find((c) => c.type === 'foreword');
      if (forewordCard && forewordCard.type === 'foreword') {
        updateData.foreword = forewordCard.text || null;
      }

      // Extract selected_image_urls from recipe cards
      const selectedImageUrls: Record<string, string> = {};
      for (const card of bookLayout.cards) {
        if (card.type === 'recipe') {
          const imagePage = card.pages.find((p) => p.kind === 'image');
          if (imagePage && imagePage.kind === 'image' && imagePage.image_url) {
            selectedImageUrls[card.recipe_id] = imagePage.image_url;
          }
        }
      }
      updateData.selected_image_urls = selectedImageUrls;
    }

    // Allow updating individual fields
    if (body.title !== undefined) updateData.title = body.title;
    if (body.subtitle !== undefined) updateData.subtitle = body.subtitle;
    if (body.author_name !== undefined) updateData.author_name = body.author_name;
    if (body.cover_style !== undefined) updateData.cover_style = body.cover_style;
    if (body.cover_image_url !== undefined) updateData.cover_image_url = body.cover_image_url;

    const { data: cookbook, error: updateError } = await supabaseAdmin
      .from('printed_cookbooks')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (updateError) {
      throw new Error(updateError.message);
    }

    return NextResponse.json({ cookbook });
  } catch (error) {
    console.error('Failed to update cookbook:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to update cookbook' },
      { status: 500 }
    );
  }
}

// DELETE /api/print-cookbook/[id] - Delete a cookbook draft
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const userId = await getUserFromRequest(request);
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    // First verify ownership
    const { data: existing, error: fetchError } = await supabaseAdmin
      .from('printed_cookbooks')
      .select('user_id, status')
      .eq('id', id)
      .single();

    if (fetchError || !existing) {
      return NextResponse.json({ error: 'Cookbook not found' }, { status: 404 });
    }

    if (existing.user_id !== userId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    if (existing.status === 'ordered') {
      return NextResponse.json({ error: 'Cannot delete an ordered cookbook' }, { status: 400 });
    }

    const { error: deleteError } = await supabaseAdmin
      .from('printed_cookbooks')
      .delete()
      .eq('id', id);

    if (deleteError) {
      throw new Error(deleteError.message);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to delete cookbook:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to delete cookbook' },
      { status: 500 }
    );
  }
}
