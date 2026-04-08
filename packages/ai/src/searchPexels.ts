export interface PexelsPhoto {
  id: number;
  thumbnail: string;   // medium size for preview
  fullUrl: string;     // large2x for upload
  alt: string;
  photographer: string;
}

export async function searchPexels(
  query: string,
  perPage = 3,
  apiKey?: string,
): Promise<PexelsPhoto[]> {
  const key = apiKey ||
    process.env.EXPO_PUBLIC_PEXELS_API_KEY ||
    process.env.PEXELS_API_KEY || '';
  if (!key || !query.trim()) {
    console.warn('[searchPexels] skipped: key=' + (key ? 'present' : 'MISSING') + ' query=' + JSON.stringify(query));
    return [];
  }

  const url = `https://api.pexels.com/v1/search?query=${encodeURIComponent(
    query + ' food',
  )}&per_page=${perPage}&orientation=landscape`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10_000);
  try {
    const res = await fetch(url, {
      headers: { Authorization: key },
      signal: controller.signal,
    });
    clearTimeout(timer);
    if (!res.ok) return [];

    const data = await res.json();
    return (data.photos ?? []).map((p: any) => ({
      id: p.id,
      thumbnail: p.src.medium,
      fullUrl: p.src.large2x,
      alt: p.alt ?? query,
      photographer: p.photographer ?? '',
    }));
  } catch {
    clearTimeout(timer);
    throw new Error('Pexels search failed');
  }
}
