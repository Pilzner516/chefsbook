import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin, PLAN_LIMITS, getMenu } from '@chefsbook/db';
import type { PlanTier } from '@chefsbook/db';
import type { BookLayout, MenuChapterCard } from '@/lib/book-layout';
import { getMenuChapterCards, createDefaultLayout } from '@/lib/book-layout';

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
 * POST /api/print-cookbooks/[id]/add-menu
 * Body: { menu_id: string }
 * Adds a menu as a MenuChapterCard to the cookbook's book_layout.cards.
 * Also adds the menu's recipe_ids to recipe_ids for PDF generation.
 * Returns: { success: true, recipe_count: number } or { already_exists: true }
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: cookbookId } = await params;
  const userId = await getUserFromRequest(request);
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const canPrint = await checkCanPrint(userId);
  if (!canPrint) {
    return NextResponse.json({ error: 'upgrade_required' }, { status: 403 });
  }

  const body = await request.json();
  const { menu_id: menuId } = body as { menu_id: string };

  if (!menuId) {
    return NextResponse.json({ error: 'menu_id required' }, { status: 400 });
  }

  const { data: cookbook, error: fetchError } = await supabaseAdmin
    .from('printed_cookbooks')
    .select('id, user_id, book_layout, recipe_ids, status, title, author_name, cover_style')
    .eq('id', cookbookId)
    .eq('user_id', userId)
    .single();

  if (fetchError || !cookbook) {
    return NextResponse.json({ error: 'Cookbook not found' }, { status: 404 });
  }

  if (cookbook.status === 'ordered') {
    return NextResponse.json({ error: 'Cannot edit an ordered cookbook' }, { status: 400 });
  }

  const menu = await getMenu(menuId);
  if (!menu) {
    return NextResponse.json({ error: 'Menu not found' }, { status: 404 });
  }

  let layout: BookLayout = cookbook.book_layout ?? createDefaultLayout({
    title: cookbook.title,
    author: cookbook.author_name,
    cover_style: cookbook.cover_style,
  });

  const existingChapters = getMenuChapterCards(layout);
  if (existingChapters.some((ch) => ch.menu_id === menuId)) {
    return NextResponse.json({ already_exists: true });
  }

  const newChapter: MenuChapterCard = {
    id: crypto.randomUUID(),
    type: 'menu_chapter',
    locked: false,
    menu_id: menuId,
    menu_title: menu.title,
    occasion: menu.occasion ?? undefined,
    notes: menu.public_notes ?? undefined,
    chapter_number: existingChapters.length + 1,
    recipe_count: menu.menu_items.length,
  };

  const indexIdx = layout.cards.findIndex((c) => c.type === 'index');
  if (indexIdx !== -1) {
    layout.cards.splice(indexIdx, 0, newChapter);
  } else {
    const backIdx = layout.cards.findIndex((c) => c.type === 'back');
    if (backIdx !== -1) {
      layout.cards.splice(backIdx, 0, newChapter);
    } else {
      layout.cards.push(newChapter);
    }
  }

  const menuRecipeIds = menu.menu_items.map((item) => item.recipe_id);
  const existingRecipeIds = new Set<string>(cookbook.recipe_ids ?? []);
  for (const rid of menuRecipeIds) {
    existingRecipeIds.add(rid);
  }
  const mergedRecipeIds = Array.from(existingRecipeIds);

  if (mergedRecipeIds.length > 80) {
    return NextResponse.json({
      error: 'Adding this menu would exceed the 80 recipe limit'
    }, { status: 400 });
  }

  const { error: updateError } = await supabaseAdmin
    .from('printed_cookbooks')
    .update({
      book_layout: layout,
      recipe_ids: mergedRecipeIds,
      updated_at: new Date().toISOString(),
      status: 'draft',
      interior_pdf_url: null,
      cover_pdf_url: null,
      page_count: null,
    })
    .eq('id', cookbookId);

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  return NextResponse.json({
    success: true,
    recipe_count: menu.menu_items.length,
  });
}
