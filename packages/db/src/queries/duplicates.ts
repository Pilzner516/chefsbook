import { supabaseAdmin } from '../client';

// Tracking params to strip from URLs
const TRACKING_PARAMS = new Set([
  'utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content',
  'fbclid', 'gclid', 'ref', 'share', 'mc_cid', 'mc_eid',
]);

/**
 * Normalize a source URL for duplicate comparison.
 * Strips tracking params, trailing slashes, www prefix, protocol, and lowercases.
 */
export function normalizeSourceUrl(url: string): string {
  try {
    const u = new URL(url);
    // Strip tracking params
    for (const key of [...u.searchParams.keys()]) {
      if (TRACKING_PARAMS.has(key.toLowerCase())) {
        u.searchParams.delete(key);
      }
    }
    let normalized = u.hostname.replace(/^www\./, '').toLowerCase();
    // Add pathname, strip trailing slash
    let path = u.pathname.replace(/\/+$/, '');
    if (path) normalized += path;
    // Add remaining non-tracking query params if any
    const qs = u.searchParams.toString();
    if (qs) normalized += '?' + qs;
    return normalized;
  } catch {
    return url.toLowerCase().trim();
  }
}

/**
 * Find a public recipe with the same normalized URL.
 */
export async function findDuplicateByUrl(
  normalizedUrl: string,
  excludeRecipeId?: string,
): Promise<{ id: string; title: string; user_id: string } | null> {
  let query = supabaseAdmin
    .from('recipes')
    .select('id, title, user_id')
    .eq('source_url_normalized', normalizedUrl)
    .in('visibility', ['public', 'shared_link'])
    .limit(1);
  if (excludeRecipeId) query = query.neq('id', excludeRecipeId);
  const { data } = await query.maybeSingle();
  return data ?? null;
}

/**
 * Find public recipes with similar titles using pg_trgm.
 * Returns up to 3 matches with similarity > 0.85.
 */
export async function findDuplicateByTitle(
  title: string,
  excludeRecipeId?: string,
): Promise<Array<{ id: string; title: string; user_id: string; similarity: number }>> {
  const { data } = await supabaseAdmin.rpc('find_similar_recipes', {
    p_title: title,
    p_threshold: 0.85,
    p_exclude_id: excludeRecipeId ?? null,
    p_limit: 3,
  });
  return (data ?? []) as Array<{ id: string; title: string; user_id: string; similarity: number }>;
}

/**
 * Mark a recipe as a duplicate of a canonical recipe.
 */
export async function markAsDuplicate(recipeId: string, canonicalId: string): Promise<void> {
  await supabaseAdmin
    .from('recipes')
    .update({
      duplicate_of: canonicalId,
      is_canonical: false,
      duplicate_checked_at: new Date().toISOString(),
    })
    .eq('id', recipeId);
}

/**
 * Mark a recipe as canonical (the "original" public version).
 */
export async function markAsCanonical(recipeId: string): Promise<void> {
  await supabaseAdmin
    .from('recipes')
    .update({
      is_canonical: true,
      duplicate_of: null,
      duplicate_checked_at: new Date().toISOString(),
    })
    .eq('id', recipeId);
}

/**
 * Run both URL and title duplicate checks on a recipe.
 * Returns whether a duplicate was found and the canonical recipe ID.
 */
export async function checkAndMarkDuplicate(
  recipeId: string,
): Promise<{ isDuplicate: boolean; canonicalId?: string }> {
  // Fetch the recipe's normalized URL and title
  const { data: recipe } = await supabaseAdmin
    .from('recipes')
    .select('source_url_normalized, title')
    .eq('id', recipeId)
    .single();
  if (!recipe) return { isDuplicate: false };

  // 1. URL-based check (exact match — strongest signal)
  if (recipe.source_url_normalized) {
    const urlMatch = await findDuplicateByUrl(recipe.source_url_normalized, recipeId);
    if (urlMatch) {
      await markAsDuplicate(recipeId, urlMatch.id);
      // Ensure the match is marked canonical
      await markAsCanonical(urlMatch.id);
      return { isDuplicate: true, canonicalId: urlMatch.id };
    }
  }

  // 2. Title-based check (fuzzy — only if URL didn't match)
  if (recipe.title) {
    const titleMatches = await findDuplicateByTitle(recipe.title, recipeId);
    if (titleMatches.length > 0) {
      const best = titleMatches[0];
      await markAsDuplicate(recipeId, best.id);
      await markAsCanonical(best.id);
      return { isDuplicate: true, canonicalId: best.id };
    }
  }

  // No duplicate found — stamp the check time
  await supabaseAdmin
    .from('recipes')
    .update({ duplicate_checked_at: new Date().toISOString() })
    .eq('id', recipeId);

  return { isDuplicate: false };
}
