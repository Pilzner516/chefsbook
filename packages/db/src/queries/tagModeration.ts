import { supabaseAdmin } from '../client';
import { shouldExcludeFromModeration } from '../tagFilters';

// Module-level cache for blocked tags (refreshed every 5 minutes)
let blockedTagsCache: string[] = [];
let cacheLastRefreshed = 0;
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

/**
 * Get cached blocked tags list. Refreshes every 5 minutes.
 * Case-insensitive — all tags stored and returned in lowercase.
 */
export async function getBlockedTags(): Promise<string[]> {
  const now = Date.now();
  if (now - cacheLastRefreshed > CACHE_TTL_MS) {
    const { data } = await supabaseAdmin
      .from('blocked_tags')
      .select('tag');
    blockedTagsCache = (data ?? []).map(row => row.tag.toLowerCase());
    cacheLastRefreshed = now;
  }
  return blockedTagsCache;
}

/**
 * Force refresh the blocked tags cache.
 * Call after adding/removing blocked tags via admin.
 */
export function refreshBlockedTagsCache(): void {
  cacheLastRefreshed = 0;
}

/**
 * Check if a tag is in the blocked list (case-insensitive).
 * Source domain tags and system tags are never considered blocked.
 */
export async function isTagBlocked(tag: string): Promise<boolean> {
  // Source domain tags and system tags are never blocked
  if (shouldExcludeFromModeration(tag)) {
    return false;
  }
  const blocked = await getBlockedTags();
  return blocked.includes(tag.toLowerCase());
}

/**
 * Log a tag removal to tag_moderation_log.
 */
export async function logTagRemoval(
  recipeId: string,
  tag: string,
  removedBy: 'ai' | 'admin' | 'blocked_list',
  reason: string | null,
  userId: string | null,
): Promise<void> {
  const { error } = await supabaseAdmin.from('tag_moderation_log').insert({
    recipe_id: recipeId,
    tag,
    removed_by: removedBy,
    reason,
    user_id: userId,
  });
  if (error) {
    console.error('Failed to log tag removal:', error);
  }
}

/**
 * Add a tag to the blocked list.
 */
export async function blockTag(
  tag: string,
  reason: string | null,
  blockedBy: string,
): Promise<void> {
  await supabaseAdmin.from('blocked_tags').insert({
    tag: tag.toLowerCase(),
    reason,
    blocked_by: blockedBy,
  });
  refreshBlockedTagsCache();
}

/**
 * Remove a tag from the blocked list.
 */
export async function unblockTag(id: string): Promise<void> {
  await supabaseAdmin.from('blocked_tags').delete().eq('id', id);
  refreshBlockedTagsCache();
}

/**
 * Reinstate a removed tag — add it back to the recipe and mark log entry.
 */
export async function reinstateTag(
  logId: string,
  recipeId: string,
  tag: string,
  adminId: string,
): Promise<void> {
  // Get current tags
  const { data: recipe } = await supabaseAdmin
    .from('recipes')
    .select('tags')
    .eq('id', recipeId)
    .single();

  if (!recipe) throw new Error('Recipe not found');

  const currentTags = recipe.tags ?? [];
  if (!currentTags.includes(tag)) {
    // Add tag back
    await supabaseAdmin
      .from('recipes')
      .update({ tags: [...currentTags, tag] })
      .eq('id', recipeId);
  }

  // Mark log entry as reinstated
  await supabaseAdmin
    .from('tag_moderation_log')
    .update({
      reinstated: true,
      reinstated_by: adminId,
      reinstated_at: new Date().toISOString(),
    })
    .eq('id', logId);
}
