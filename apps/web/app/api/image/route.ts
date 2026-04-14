import { NextRequest, NextResponse } from 'next/server';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '';

const ALLOWED_HOSTS = [
  '100.110.47.62',        // RPi5 Supabase direct
  'api.chefsbk.app',      // Cloudflare tunnel
  'img.logo.dev',         // Store logos
  'images.pexels.com',    // Pexels photos
  'photos.pexels.com',    // Pexels photos alt domain
  'images.unsplash.com',  // Unsplash photos
];

function isAllowedUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return ALLOWED_HOSTS.some(
      (host) => parsed.hostname === host || parsed.hostname.endsWith('.' + host),
    );
  } catch {
    return false;
  }
}

export async function GET(req: NextRequest) {
  const url = req.nextUrl.searchParams.get('url');
  if (!url) return NextResponse.json({ error: 'Missing url param' }, { status: 400 });

  // Security: only proxy URLs from allowed hosts
  if (!isAllowedUrl(url)) {
    return new Response('Forbidden', { status: 403 });
  }

  // Supabase storage URLs need the apikey header
  const isSupabase = url.startsWith(SUPABASE_URL) || url.includes('100.110.47.62');
  const headers: Record<string, string> = isSupabase ? { apikey: SUPABASE_ANON_KEY } : {};

  try {
    const response = await fetch(url, { headers });

    if (!response.ok) {
      return NextResponse.json({ error: `Upstream ${response.status}` }, { status: response.status });
    }

    const body = response.body;
    const contentType = response.headers.get('Content-Type') ?? 'image/jpeg';

    return new Response(body, {
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=86400, immutable',
      },
    });
  } catch {
    return NextResponse.json({ error: 'Failed to fetch image' }, { status: 502 });
  }
}
