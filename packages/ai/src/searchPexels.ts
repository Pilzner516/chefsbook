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
): Promise<PexelsPhoto[]> {
  const key =
    process.env.EXPO_PUBLIC_PEXELS_API_KEY ??
    process.env.PEXELS_API_KEY ?? '';
  if (!key || !query.trim()) return [];

  const url = `https://api.pexels.com/v1/search?query=${encodeURIComponent(
    query + ' food',
  )}&per_page=${perPage}&orientation=landscape`;

  const res = await fetch(url, {
    headers: { Authorization: key },
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) return [];

  const data = await res.json();
  return (data.photos ?? []).map((p: any) => ({
    id: p.id,
    thumbnail: p.src.medium,
    fullUrl: p.src.large2x,
    alt: p.alt ?? query,
    photographer: p.photographer ?? '',
  }));
}
