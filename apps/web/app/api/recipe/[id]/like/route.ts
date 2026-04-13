import { NextRequest, NextResponse } from 'next/server';
import { supabase, supabaseAdmin } from '@chefsbook/db';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: recipeId } = await params;

  // Authenticate via JWT
  const authHeader = req.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const { data: { user } } = await supabase.auth.getUser(authHeader.slice(7));
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const userId = user.id;

  // Toggle the like via supabaseAdmin (bypasses RLS)
  const { data: existing } = await supabaseAdmin
    .from('recipe_likes')
    .select('id')
    .eq('recipe_id', recipeId)
    .eq('user_id', userId)
    .single();

  let liked: boolean;

  if (existing) {
    // Unlike
    await supabaseAdmin
      .from('recipe_likes')
      .delete()
      .eq('recipe_id', recipeId)
      .eq('user_id', userId);
    liked = false;
  } else {
    // Like
    await supabaseAdmin
      .from('recipe_likes')
      .insert({ recipe_id: recipeId, user_id: userId });
    liked = true;

    // Create notification for recipe owner (server-side, supabaseAdmin available)
    try {
      const { data: recipe } = await supabaseAdmin
        .from('recipes')
        .select('user_id, title')
        .eq('id', recipeId)
        .single();

      if (recipe && recipe.user_id !== userId) {
        const { data: liker } = await supabaseAdmin
          .from('user_profiles')
          .select('username')
          .eq('id', userId)
          .single();

        await supabaseAdmin.from('notifications').insert({
          user_id: recipe.user_id,
          type: 'recipe_like',
          actor_id: userId,
          actor_username: liker?.username ?? undefined,
          recipe_id: recipeId,
          recipe_title: recipe.title ?? undefined,
          message: 'liked your recipe',
        });
      }
    } catch {} // notification failure should not block the like
  }

  // Return updated like count
  const { data: updated } = await supabaseAdmin
    .from('recipes')
    .select('like_count')
    .eq('id', recipeId)
    .single();

  return NextResponse.json({ liked, like_count: updated?.like_count ?? 0 });
}
