import { supabase } from '../client';
import type { UserProfile } from '../types';

export async function getProfileById(userId: string): Promise<UserProfile | null> {
  const { data } = await supabase
    .from('user_profiles')
    .select('*')
    .eq('id', userId)
    .single();
  return (data as UserProfile) ?? null;
}

export async function getProfileByUsername(username: string): Promise<UserProfile | null> {
  const { data } = await supabase
    .from('user_profiles')
    .select('*')
    .eq('username', username.toLowerCase())
    .single();
  return (data as UserProfile) ?? null;
}

export async function checkUsernameAvailable(username: string): Promise<boolean> {
  const { count } = await supabase
    .from('user_profiles')
    .select('*', { count: 'exact', head: true })
    .eq('username', username.toLowerCase());
  return (count ?? 0) === 0;
}

export async function setUsername(userId: string, username: string): Promise<void> {
  const { error } = await supabase
    .from('user_profiles')
    .update({ username: username.toLowerCase() })
    .eq('id', userId);
  if (error) throw error;
}

export async function updateProfile(
  userId: string,
  fields: { display_name?: string | null; bio?: string | null; avatar_url?: string | null; is_searchable?: boolean },
): Promise<UserProfile> {
  const { data, error } = await supabase
    .from('user_profiles')
    .update(fields)
    .eq('id', userId)
    .select()
    .single();
  if (error || !data) throw error ?? new Error('Failed to update profile');
  return data as UserProfile;
}

export async function searchUsers(
  query: string,
  limit = 10,
): Promise<UserProfile[]> {
  const q = query.replace(/^@/, '').toLowerCase().trim();
  if (!q) return [];
  const { data } = await supabase
    .from('user_profiles')
    .select('*')
    .eq('is_searchable', true)
    .not('username', 'is', null)
    .ilike('username', `%${q}%`)
    .limit(limit);
  return (data ?? []) as UserProfile[];
}
