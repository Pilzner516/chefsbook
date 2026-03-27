export async function POST(req: Request) {
  const { url } = await req.json();

  if (!url || typeof url !== 'string') {
    return Response.json({ error: 'URL is required' }, { status: 400 });
  }

  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Chefsbook/1.0 (recipe importer)',
      },
    });

    if (!response.ok) {
      return Response.json({ error: `Failed to fetch URL: ${response.status}` }, { status: 502 });
    }

    const html = await response.text();
    // Strip HTML to just text content for the AI to parse
    const text = html
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 10000);

    return Response.json({ html: text });
  } catch (e: any) {
    return Response.json({ error: e.message }, { status: 500 });
  }
}
