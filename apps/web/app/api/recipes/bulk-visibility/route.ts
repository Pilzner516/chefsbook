import { NextRequest, NextResponse } from 'next/server';
import { supabase, supabaseAdmin } from '@chefsbook/db';

export async function POST(req: NextRequest) {
  try {
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { ids, visibility, all } = body as { ids?: string[]; visibility: 'public' | 'private'; all?: boolean };

    if (visibility !== 'public' && visibility !== 'private') {
      return NextResponse.json({ error: 'Invalid visibility value' }, { status: 400 });
    }

    if (all) {
      // Update ALL user's recipes to the specified visibility
      const { error, count } = await supabaseAdmin
        .from('recipes')
        .update({ visibility })
        .eq('user_id', session.user.id);

      if (error) {
        console.error('Bulk visibility update error:', error);
        return NextResponse.json({ error: 'Failed to update recipes' }, { status: 500 });
      }

      return NextResponse.json({ success: true, updated: count ?? 0 });
    } else {
      // Update specific recipes by ID
      if (!ids || !Array.isArray(ids) || ids.length === 0) {
        return NextResponse.json({ error: 'No recipe IDs provided' }, { status: 400 });
      }

      // Verify ownership of all recipes (prevent IDOR)
      const { data: ownedRecipes } = await supabaseAdmin
        .from('recipes')
        .select('id')
        .eq('user_id', session.user.id)
        .in('id', ids);

      if (!ownedRecipes || ownedRecipes.length !== ids.length) {
        return NextResponse.json({ error: 'You do not own all selected recipes' }, { status: 403 });
      }

      // Update visibility for owned recipes
      const { error } = await supabaseAdmin
        .from('recipes')
        .update({ visibility })
        .eq('user_id', session.user.id)
        .in('id', ids);

      if (error) {
        console.error('Bulk visibility update error:', error);
        return NextResponse.json({ error: 'Failed to update recipes' }, { status: 500 });
      }

      return NextResponse.json({ success: true, updated: ids.length });
    }
  } catch (error: any) {
    console.error('Bulk visibility route error:', error);
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}
