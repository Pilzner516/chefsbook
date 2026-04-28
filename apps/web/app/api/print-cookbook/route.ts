import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin, PLAN_LIMITS } from '@chefsbook/db';
import type { PlanTier } from '@chefsbook/db';
import { createDefaultLayout } from '@/lib/book-layout';

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

// POST /api/print-cookbook - Create a new cookbook with book_layout
export async function POST(request: NextRequest) {
  const userId = await getUserFromRequest(request);
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const canPrint = await checkProPlan(userId);
  if (!canPrint) {
    return NextResponse.json({ error: 'Pro plan required' }, { status: 403 });
  }

  try {
    const body = await request.json();
    const title = body.title || 'My ChefsBook';
    const author = body.author || '';

    // Get user's preferred language
    const { data: profile } = await supabaseAdmin
      .from('user_profiles')
      .select('preferred_language, display_name')
      .eq('id', userId)
      .single();

    const language = (profile?.preferred_language as 'en' | 'fr' | 'es' | 'it' | 'de') || 'en';
    const authorName = author || profile?.display_name || '';

    // Create default book layout
    const bookLayout = createDefaultLayout({
      title,
      author: authorName,
      cover_style: 'classic',
      language,
    });

    // Create the cookbook record
    const { data: cookbook, error } = await supabaseAdmin
      .from('printed_cookbooks')
      .insert({
        user_id: userId,
        title,
        author_name: authorName,
        cover_style: 'classic',
        recipe_ids: [],
        status: 'draft',
        book_layout: bookLayout,
      })
      .select()
      .single();

    if (error) {
      throw new Error(error.message);
    }

    return NextResponse.json({ id: cookbook.id, cookbook });
  } catch (error) {
    console.error('Failed to create cookbook:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to create cookbook' },
      { status: 500 }
    );
  }
}

// GET /api/print-cookbook - List user's cookbooks with book_layout
export async function GET(request: NextRequest) {
  const userId = await getUserFromRequest(request);
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { data: cookbooks, error } = await supabaseAdmin
      .from('printed_cookbooks')
      .select('id, title, status, created_at, updated_at, recipe_ids, book_layout')
      .eq('user_id', userId)
      .not('book_layout', 'is', null)
      .order('updated_at', { ascending: false });

    if (error) {
      throw new Error(error.message);
    }

    return NextResponse.json({ cookbooks: cookbooks || [] });
  } catch (error) {
    console.error('Failed to list cookbooks:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to list cookbooks' },
      { status: 500 }
    );
  }
}
