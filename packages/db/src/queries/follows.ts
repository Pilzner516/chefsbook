import { supabase } from '../client';
import type { Follow, UserProfile, Recipe } from '../types';

export async function followUser(followerId: string, followingId: string): Promise<void> {
  const { error } = await supabase
    .from('user_follows')
    .insert({ follower_id: followerId, following_id: followingId });
  if (error) throw error;
}

export async function unfollowUser(followerId: string, followingId: string): Promise<void> {
  const { error } = await supabase
    .from('user_follows')
    .delete()
    .eq('follower_id', followerId)
    .eq('following_id', followingId);
  if (error) throw error;
}

export async function isFollowing(followerId: string, followingId: string): Promise<boolean> {
  const { count } = await supabase
    .from('user_follows')
    .select('*', { count: 'exact', head: true })
    .eq('follower_id', followerId)
    .eq('following_id', followingId);
  return (count ?? 0) > 0;
}

export async function getFollowers(userId: string): Promise<UserProfile[]> {
  const { data } = await supabase
    .from('user_follows')
    .select('follower_id')
    .eq('following_id', userId);

  if (!data || data.length === 0) return [];
  const ids = data.map((r: any) => r.follower_id);
  const { data: profiles } = await supabase
    .from('user_profiles')
    .select('*')
    .in('id', ids);
  return (profiles ?? []) as UserProfile[];
}

export async function getFollowing(userId: string): Promise<UserProfile[]> {
  const { data } = await supabase
    .from('user_follows')
    .select('following_id')
    .eq('follower_id', userId);

  if (!data || data.length === 0) return [];
  const ids = data.map((r: any) => r.following_id);
  const { data: profiles } = await supabase
    .from('user_profiles')
    .select('*')
    .in('id', ids);
  return (profiles ?? []) as UserProfile[];
}

export async function getFollowingCount(userId: string): Promise<number> {
  const { count } = await supabase
    .from('user_follows')
    .select('*', { count: 'exact', head: true })
    .eq('follower_id', userId);
  return count ?? 0;
}

export async function getFollowedRecipes(
  userId: string,
  limit = 50,
): Promise<(Recipe & { author_username: string | null; author_avatar: string | null })[]> {
  // Get who the user follows
  const { data: followRows } = await supabase
    .from('user_follows')
    .select('following_id')
    .eq('follower_id', userId);

  if (!followRows || followRows.length === 0) return [];
  const followingIds = followRows.map((r: any) => r.following_id);

  // Get public recipes from followed users
  const { data: recipes } = await supabase
    .from('recipes')
    .select('*')
    .in('user_id', followingIds)
    .in('visibility', ['public', 'shared_link'])
    .is('parent_recipe_id', null)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (!recipes || recipes.length === 0) return [];

  // Get author profiles
  const authorIds = [...new Set(recipes.map((r: any) => r.user_id))];
  const { data: profiles } = await supabase
    .from('user_profiles')
    .select('id, username, avatar_url')
    .in('id', authorIds);

  const profileMap = new Map((profiles ?? []).map((p: any) => [p.id, p]));

  return recipes.map((r: any) => {
    const profile = profileMap.get(r.user_id);
    return {
      ...r,
      author_username: profile?.username ?? null,
      author_avatar: profile?.avatar_url ?? null,
    };
  });
}
