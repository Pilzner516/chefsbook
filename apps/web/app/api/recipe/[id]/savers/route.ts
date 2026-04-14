import { NextRequest, NextResponse } from 'next/server';
import { supabase, supabaseAdmin } from '@chefsbook/db';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: recipeId } = await params;

  // Authenticate via JWT — only recipe owner should see savers
  const authHeader = req.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const { data: { user } } = await supabase.auth.getUser(authHeader.slice(7));
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Two-step query via supabaseAdmin (recipe_saves FK → auth.users, not user_profiles)
  const { data: saves } = await supabaseAdmin
    .from('recipe_saves')
    .select('user_id')
    .eq('recipe_id', recipeId)
    .order('saved_at', { ascending: false })
    .limit(50);
  if (!saves || saves.length === 0) {
    return NextResponse.json([]);
  }
  const userIds = saves.map((s: any) => s.user_id);
  const { data: profiles } = await supabaseAdmin
    .from('user_profiles')
    .select('id, username, display_name, avatar_url')
    .in('id', userIds);

  return NextResponse.json(
    (profiles ?? []).map((p: any) => ({
      id: p.id,
      username: p.username,
      display_name: p.display_name,
      avatar_url: p.avatar_url,
    })),
  );
}
