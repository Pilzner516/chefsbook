import { NextRequest, NextResponse } from 'next/server';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '';

export async function GET(req: NextRequest) {
  const url = req.nextUrl.searchParams.get('url');
  if (!url) return NextResponse.json({ error: 'Missing url param' }, { status: 400 });

  // Only allow Supabase storage URLs
  const isSupabase = url.startsWith(SUPABASE_URL) || url.includes('100.110.47.62');
  if (!isSupabase) {
    return new Response('Forbidden', { status: 403 });
  }

  try {
    const response = await fetch(url, {
      headers: { apikey: SUPABASE_ANON_KEY },
    });

    if (!response.ok) {
      return NextResponse.json({ error: `Upstream ${response.status}` }, { status: response.status });
    }

    const body = response.body;

    return new Response(body, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': 'inline',
        'Cache-Control': 'private, max-age=3600',
      },
    });
  } catch {
    return NextResponse.json({ error: 'Failed to fetch PDF' }, { status: 502 });
  }
}
