import { supabase } from '../client';

// ── Likes ──

export async function toggleLike(recipeId: string, userId: string): Promise<boolean> {
  const { data: existing } = await supabase
    .from('recipe_likes')
    .select('id')
    .eq('recipe_id', recipeId)
    .eq('user_id', userId)
    .single();

  if (existing) {
    await supabase.from('recipe_likes').delete().eq('id', existing.id);
    return false; // unliked
  } else {
    await supabase.from('recipe_likes').insert({ recipe_id: recipeId, user_id: userId });
    return true; // liked
  }
}

export async function isLiked(recipeId: string, userId: string): Promise<boolean> {
  const { count } = await supabase
    .from('recipe_likes')
    .select('*', { count: 'exact', head: true })
    .eq('recipe_id', recipeId)
    .eq('user_id', userId);
  return (count ?? 0) > 0;
}

export async function getLikers(recipeId: string, limit = 50): Promise<{ id: string; username: string | null; display_name: string | null; avatar_url: string | null }[]> {
  const { data } = await supabase
    .from('recipe_likes')
    .select('user_id, user_profiles!inner(id, username, display_name, avatar_url)')
    .eq('recipe_id', recipeId)
    .order('created_at', { ascending: false })
    .limit(limit);
  return (data ?? []).map((row: any) => ({
    id: row.user_profiles.id,
    username: row.user_profiles.username,
    display_name: row.user_profiles.display_name,
    avatar_url: row.user_profiles.avatar_url,
  }));
}

export async function getSavers(recipeId: string, limit = 50): Promise<{ id: string; username: string | null; display_name: string | null; avatar_url: string | null }[]> {
  const { data } = await supabase
    .from('recipe_saves')
    .select('user_id, user_profiles!inner(id, username, display_name, avatar_url)')
    .eq('recipe_id', recipeId)
    .order('created_at', { ascending: false })
    .limit(limit);
  return (data ?? []).map((row: any) => ({
    id: row.user_profiles.id,
    username: row.user_profiles.username,
    display_name: row.user_profiles.display_name,
    avatar_url: row.user_profiles.avatar_url,
  }));
}

// ── Comments ──

export interface CommentRow {
  id: string;
  recipe_id: string;
  user_id: string;
  parent_id: string | null;
  content: string;
  status: string;
  flag_severity: string | null;
  reply_count: number;
  created_at: string;
  username?: string;
  display_name?: string;
  avatar_url?: string;
}

export async function getComments(recipeId: string): Promise<CommentRow[]> {
  const { data } = await supabase
    .from('recipe_comments')
    .select('*, user_profiles!recipe_comments_user_id_fkey(username, display_name, avatar_url)')
    .eq('recipe_id', recipeId)
    .in('status', ['visible', 'approved'])
    .order('created_at', { ascending: true });
  return (data ?? []).map((row: any) => ({
    ...row,
    username: row.user_profiles?.username,
    display_name: row.user_profiles?.display_name,
    avatar_url: row.user_profiles?.avatar_url,
  }));
}

export async function postComment(
  recipeId: string,
  userId: string,
  content: string,
  status: string = 'visible',
  flagSeverity?: string,
  flagSource?: string,
  flagReason?: string,
  parentId?: string,
): Promise<CommentRow> {
  const { data, error } = await supabase
    .from('recipe_comments')
    .insert({
      recipe_id: recipeId,
      user_id: userId,
      content,
      status,
      parent_id: parentId ?? null,
      flag_severity: flagSeverity ?? null,
      flag_source: flagSource ?? null,
      flag_reason: flagReason ?? null,
      flagged_at: flagSeverity ? new Date().toISOString() : null,
    })
    .select()
    .single();
  if (error) throw error;
  return data as CommentRow;
}

export async function deleteComment(commentId: string): Promise<void> {
  await supabase.from('recipe_comments').delete().eq('id', commentId);
}

export async function flagComment(commentId: string, userId: string, reason: string): Promise<void> {
  await supabase.from('comment_flags').upsert(
    { comment_id: commentId, flagged_by: userId, reason },
    { onConflict: 'comment_id,flagged_by' },
  );
  // Check if 3+ flags → escalate
  const { count } = await supabase
    .from('comment_flags')
    .select('*', { count: 'exact', head: true })
    .eq('comment_id', commentId);
  if ((count ?? 0) >= 3) {
    await supabase.from('recipe_comments').update({
      flag_source: 'user',
      flag_severity: 'mild',
      flagged_at: new Date().toISOString(),
    }).eq('id', commentId);
  }
}

export async function blockCommenter(blockerId: string, blockedId: string): Promise<void> {
  await supabase.from('blocked_commenters').upsert(
    { blocker_id: blockerId, blocked_id: blockedId },
    { onConflict: 'blocker_id,blocked_id' },
  );
}

export async function isBlockedCommenter(blockerId: string, blockedId: string): Promise<boolean> {
  const { count } = await supabase
    .from('blocked_commenters')
    .select('*', { count: 'exact', head: true })
    .eq('blocker_id', blockerId)
    .eq('blocked_id', blockedId);
  return (count ?? 0) > 0;
}

export async function toggleComments(recipeId: string, enabled: boolean): Promise<void> {
  await supabase.from('recipes').update({ comments_enabled: enabled }).eq('id', recipeId);
}

// ── Notifications ──

export async function createNotification(params: {
  user_id: string;
  type: string;
  actor_id?: string;
  actor_username?: string;
  recipe_id?: string;
  recipe_title?: string;
  comment_id?: string;
  message?: string;
  batch_count?: number;
}): Promise<void> {
  await supabase.from('notifications').insert(params);
}

export async function getNotifications(userId: string, type?: string): Promise<any[]> {
  let q = supabase.from('notifications').select('*').eq('user_id', userId).order('created_at', { ascending: false }).limit(50);
  if (type && type !== 'all') q = q.eq('type', type);
  const { data } = await q;
  return data ?? [];
}

export async function getUnreadCount(userId: string): Promise<number> {
  const { count } = await supabase.from('notifications').select('*', { count: 'exact', head: true }).eq('user_id', userId).eq('is_read', false);
  return count ?? 0;
}

export async function markNotificationRead(id: string): Promise<void> {
  await supabase.from('notifications').update({ is_read: true }).eq('id', id);
}

export async function markAllNotificationsRead(userId: string): Promise<void> {
  await supabase.from('notifications').update({ is_read: true }).eq('user_id', userId).eq('is_read', false);
}
