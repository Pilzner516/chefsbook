const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
const CHEFS_HAT = '/images/chefs-hat.png';

/**
 * Get the YouTube thumbnail URL for a video ID.
 * Try maxresdefault first (1080p), fall back to hqdefault (720p) if not available.
 * Note: maxresdefault may not exist for all videos, but we can't pre-check.
 * The browser will handle the fallback via onerror.
 */
export function getYouTubeThumbnail(videoId: string): string {
  return `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`;
}

/**
 * Get the fallback YouTube thumbnail (720p) for videos without maxresdefault.
 */
export function getYouTubeThumbnailFallback(videoId: string): string {
  return `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`;
}

/**
 * Get the best image URL for a recipe, with proxy for Supabase storage URLs.
 * Priority: primaryPhotoUrl > imageUrl > YouTube thumbnail > null
 */
export function getRecipeImageUrl(
  primaryPhotoUrl: string | null | undefined,
  imageUrl: string | null | undefined,
  youtubeVideoId?: string | null | undefined,
): string | null {
  const url = primaryPhotoUrl ?? imageUrl ?? null;
  if (url) return proxyIfNeeded(url);

  // Fallback to YouTube thumbnail if available
  if (youtubeVideoId) {
    return getYouTubeThumbnail(youtubeVideoId);
  }

  return null;
}

/**
 * Wrap Supabase storage URLs in the /api/image proxy (apikey required).
 * External URLs are returned as-is.
 */
export function proxyIfNeeded(url: string): string {
  const isSupabase = SUPABASE_URL && url.startsWith(SUPABASE_URL);
  const isLocalIp = url.includes('100.83.66.51:8000') || url.includes('100.110.47.62:8000');
  if (isSupabase || isLocalIp) {
    return `/api/image?url=${encodeURIComponent(url)}`;
  }
  return url;
}

export const CHEFS_HAT_URL = CHEFS_HAT;
