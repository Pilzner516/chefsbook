import { supabase } from '../client';
import type { Technique, ScannedTechnique, TechniqueSourceType } from '../types';

export async function getTechnique(id: string): Promise<Technique | null> {
  const { data } = await supabase
    .from('techniques')
    .select('*')
    .eq('id', id)
    .single();
  return (data as Technique) ?? null;
}

export async function listTechniques(params?: {
  userId?: string;
  search?: string;
  difficulty?: string;
  limit?: number;
  offset?: number;
}): Promise<Technique[]> {
  let query = supabase.from('techniques').select('*');

  if (params?.userId) query = query.eq('user_id', params.userId);
  if (params?.search) query = query.ilike('title', `%${params.search}%`);
  if (params?.difficulty) query = query.eq('difficulty', params.difficulty);

  query = query
    .order('updated_at', { ascending: false })
    .range(params?.offset ?? 0, (params?.offset ?? 0) + (params?.limit ?? 50) - 1);

  const { data } = await query;
  return (data ?? []) as Technique[];
}

export async function createTechnique(
  userId: string,
  technique: ScannedTechnique & {
    source_url?: string;
    source_type?: TechniqueSourceType;
    youtube_video_id?: string;
    image_url?: string;
    related_recipe_ids?: string[];
    tags?: string[];
  },
): Promise<Technique> {
  const { data, error } = await supabase
    .from('techniques')
    .insert({
      user_id: userId,
      title: technique.title,
      description: technique.description,
      process_steps: technique.process_steps ?? [],
      tips: technique.tips ?? [],
      common_mistakes: technique.common_mistakes ?? [],
      tools_and_equipment: technique.tools_and_equipment ?? [],
      difficulty: technique.difficulty,
      source_url: technique.source_url ?? null,
      source_type: technique.source_type ?? null,
      youtube_video_id: technique.youtube_video_id ?? null,
      image_url: technique.image_url ?? null,
      related_recipe_ids: technique.related_recipe_ids ?? [],
      tags: technique.tags ?? [],
    })
    .select()
    .single();

  if (error || !data) throw error ?? new Error('Failed to create technique');
  return data as Technique;
}

export async function updateTechnique(
  id: string,
  updates: Partial<Omit<Technique, 'id' | 'user_id' | 'created_at' | 'updated_at' | 'share_token'>>,
): Promise<Technique> {
  const { data, error } = await supabase
    .from('techniques')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error || !data) throw error ?? new Error('Failed to update technique');
  return data as Technique;
}

export async function deleteTechnique(id: string): Promise<void> {
  const { error } = await supabase.from('techniques').delete().eq('id', id);
  if (error) throw error;
}
