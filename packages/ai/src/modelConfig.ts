/**
 * AI Model Config helper — reads from ai_model_config table at call time,
 * falling back to hardcoded defaults if the DB is unreachable.
 */

import { createClient } from '@supabase/supabase-js';

// Fallback model map — matches seed data in migration 053
// Keys MUST match the task column in ai_model_config
export const MODEL_FALLBACKS: Record<string, string> = {
  nutrition: 'claude-haiku-4-5-20251001',
  moderation: 'claude-haiku-4-5-20251001',
  classification: 'claude-haiku-4-5-20251001',
  translation: 'claude-sonnet-4-20250514',
  import_extraction: 'claude-sonnet-4-20250514',
  meal_plan: 'claude-sonnet-4-20250514',
  dish_recipe: 'claude-sonnet-4-20250514',
  cookbook_toc: 'claude-sonnet-4-20250514',
  speak_recipe: 'claude-sonnet-4-20250514',
  image_generation: 'replicate/flux-schnell',
};

// In-memory cache to avoid repeated DB queries within short intervals
let modelCache: Map<string, { model: string; fetchedAt: number }> = new Map();
const CACHE_TTL_MS = 60_000; // 1 minute

function getSupabaseUrl(): string {
  return (
    process.env.SUPABASE_URL ??
    process.env.NEXT_PUBLIC_SUPABASE_URL ??
    process.env.EXPO_PUBLIC_SUPABASE_URL ??
    ''
  );
}

function getServiceRoleKey(): string {
  return process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';
}

/**
 * Get the configured model for a given task.
 * Reads from ai_model_config table, falls back silently on any error.
 * Never throws — nutrition generation must not fail because config is unavailable.
 */
export async function getModelForTask(task: string): Promise<string> {
  const fallback = MODEL_FALLBACKS[task] ?? MODEL_FALLBACKS.nutrition;

  // Check in-memory cache first
  const cached = modelCache.get(task);
  if (cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) {
    return cached.model;
  }

  const url = getSupabaseUrl();
  const key = getServiceRoleKey();

  // If no service role key, can't query admin table — use fallback
  if (!url || !key) {
    return fallback;
  }

  try {
    const supabase = createClient(url, key);
    const { data, error } = await supabase
      .from('ai_model_config')
      .select('model')
      .eq('task', task)
      .single();

    if (error || !data?.model) {
      return fallback;
    }

    // Update cache
    modelCache.set(task, { model: data.model, fetchedAt: Date.now() });
    return data.model;
  } catch {
    // Silently fall back on any error
    return fallback;
  }
}

/**
 * Clear the model cache (useful for tests or after admin updates)
 */
export function clearModelCache(): void {
  modelCache.clear();
}
