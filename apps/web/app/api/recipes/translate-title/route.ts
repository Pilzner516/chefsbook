import { NextRequest, NextResponse } from 'next/server';
import { supabase, supabaseAdmin, saveTitleOnlyTranslations } from '@chefsbook/db';
import { translateRecipeTitle } from '@chefsbook/ai';

export async function POST(req: NextRequest) {
  try {
    // Auth check
    const authHeader = req.headers.get('authorization');
    if (!authHeader) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const { data: { user } } = await supabase.auth.getUser(authHeader.replace('Bearer ', ''));
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { recipeId, title } = await req.json();
    if (!recipeId || !title) return NextResponse.json({ error: 'Missing recipeId or title' }, { status: 400 });

    // Check if translations already exist for this recipe
    const { count } = await supabaseAdmin
      .from('recipe_translations')
      .select('*', { count: 'exact', head: true })
      .eq('recipe_id', recipeId);
    if ((count ?? 0) > 0) return NextResponse.json({ ok: true, skipped: true });

    // Translate title into all 4 languages via HAIKU
    const titles = await translateRecipeTitle(title);
    await saveTitleOnlyTranslations(recipeId, titles);

    return NextResponse.json({ ok: true, languages: Object.keys(titles) });
  } catch (err: any) {
    console.error('[api/recipes/translate-title] Error:', err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
