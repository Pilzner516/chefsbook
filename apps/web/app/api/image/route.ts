import { NextRequest, NextResponse } from 'next/server';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '';

export async function GET(req: NextRequest) {
  const url = req.nextUrl.searchParams.get('url');
  if (!url) return NextResponse.json({ error: 'Missing url param' }, { status: 400 });

  // Only proxy Supabase storage URLs (security — don't become an open proxy)
  const isSupabase = url.startsWith(SUPABASE_URL) || url.includes('100.110.47.62:8000');
  if (!isSupabase) {
    return NextResponse.redirect(url);
  }

  try {
    const response = await fetch(url, {
      headers: { apikey: SUPABASE_ANON_KEY },
    });

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
