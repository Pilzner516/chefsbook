import { supabase } from '../client';
import type { Cookbook } from '../types';

export async function getCookbook(id: string): Promise<Cookbook | null> {
  const { data } = await supabase
    .from('cookbooks')
    .select('*')
    .eq('id', id)
    .single();
  return data as Cookbook | null;
}

export async function listCookbooks(userId: string): Promise<Cookbook[]> {
  const { data } = await supabase
    .from('cookbooks')
    .select('*')
    .eq('user_id', userId)
    .order('title');
  return (data ?? []) as Cookbook[];
}

export async function createCookbook(
  userId: string,
  cookbook: Omit<Cookbook, 'id' | 'user_id' | 'created_at'>,
): Promise<Cookbook> {
  const { data, error } = await supabase
    .from('cookbooks')
    .insert({ ...cookbook, user_id: userId })
    .select()
    .single();
  if (error || !data) throw error ?? new Error('Failed to create cookbook');
  return data as Cookbook;
}

export async function updateCookbook(
  id: string,
  updates: Partial<Omit<Cookbook, 'id' | 'user_id' | 'created_at'>>,
): Promise<Cookbook> {
  const { data, error } = await supabase
    .from('cookbooks')
    .update(updates)
    .eq('id', id)
    .select()
    .single();
  if (error || !data) throw error ?? new Error('Failed to update cookbook');
  return data as Cookbook;
}

export async function deleteCookbook(id: string): Promise<void> {
  const { error } = await supabase.from('cookbooks').delete().eq('id', id);
  if (error) throw error;
}
