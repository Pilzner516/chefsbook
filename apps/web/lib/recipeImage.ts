const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
const CHEFS_HAT = '/images/chefs-hat.png';

/**
 * Get the best image URL for a recipe, with proxy for Supabase storage URLs.
 * Priority: primaryPhotoUrl > imageUrl > null
 */
export function getRecipeImageUrl(
  primaryPhotoUrl: string | null | undefined,
  imageUrl: string | null | undefined,
): string | null {
  const url = primaryPhotoUrl ?? imageUrl ?? null;
  if (!url) return null;
  return proxyIfNeeded(url);
}

/**
 * Wrap Supabase storage URLs in the /api/image proxy (apikey required).
 * External URLs are returned as-is.
 */
export function proxyIfNeeded(url: string): string {
  const isSupabase = SUPABASE_URL && url.startsWith(SUPABASE_URL);
  const isLocalIp = url.includes('100.110.47.62:8000');
  if (isSupabase || isLocalIp) {
    return `/api/image?url=${encodeURIComponent(url)}`;
  }
  return url;
}

export const CHEFS_HAT_URL = CHEFS_HAT;
