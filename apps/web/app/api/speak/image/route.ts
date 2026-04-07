export async function POST(req: Request) {
  const { title, cuisine, page } = await req.json();
  if (!title) return Response.json({ error: 'Title required' }, { status: 400 });

  const pageNum = page ?? 1;

  // Try Pexels API (keyword search, free)
  const pexelsKey = process.env.EXPO_PUBLIC_PEXELS_API_KEY ?? process.env.PEXELS_API_KEY;
  if (pexelsKey) {
    try {
      const res = await fetch(
        `https://api.pexels.com/v1/search?query=${encodeURIComponent(title + ' food')}&per_page=1&page=${pageNum}&orientation=landscape`,
        { headers: { Authorization: pexelsKey }, signal: AbortSignal.timeout(10000) },
      );
      if (res.ok) {
        const data = await res.json();
        const photo = data.photos?.[0];
        if (photo) return Response.json({ url: photo.src.large });
      }
    } catch {}
  }

  // Try Unsplash API
  const unsplashKey = process.env.UNSPLASH_ACCESS_KEY;
  if (unsplashKey) {
    try {
      const res = await fetch(
        `https://api.unsplash.com/search/photos?query=${encodeURIComponent(title + ' food')}&per_page=1&page=${pageNum}&orientation=landscape`,
        { headers: { Authorization: `Client-ID ${unsplashKey}` }, signal: AbortSignal.timeout(10000) },
      );
      if (res.ok) {
        const data = await res.json();
        const photo = data.results?.[0];
        if (photo) return Response.json({ url: photo.urls.regular });
      }
    } catch {}
  }

  return Response.json({ url: null });
}
