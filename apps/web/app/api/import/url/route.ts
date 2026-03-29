import { importFromUrl, stripHtml } from '@chefsbook/ai';

/**
 * Extract the best image URL from raw HTML.
 * Priority: og:image > schema.org/Recipe image > first large <img>.
 */
function extractImageUrl(html: string, pageUrl: string): string | null {
  // 1. og:image
  const ogMatch = html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i)
    ?? html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i);
  if (ogMatch?.[1]) return resolveUrl(ogMatch[1], pageUrl);

  // 2. Schema.org Recipe image
  const schemaMatch = html.match(/"image"\s*:\s*"([^"]+)"/);
  if (schemaMatch?.[1] && schemaMatch[1].startsWith('http')) return schemaMatch[1];

  // 3. Schema.org image array
  const schemaArrayMatch = html.match(/"image"\s*:\s*\[\s*"([^"]+)"/);
  if (schemaArrayMatch?.[1] && schemaArrayMatch[1].startsWith('http')) return schemaArrayMatch[1];

  return null;
}

function resolveUrl(src: string, base: string): string {
  try {
    return new URL(src, base).href;
  } catch {
    return src;
  }
}

export async function POST(req: Request) {
  const { url } = await req.json();

  if (!url || typeof url !== 'string') {
    return Response.json({ error: 'URL is required' }, { status: 400 });
  }

  try {
    // Fetch the page server-side (avoids CORS issues)
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
      },
      signal: AbortSignal.timeout(15000),
    });

    if (!response.ok) {
      return Response.json(
        { error: `Failed to fetch URL: ${response.status}` },
        { status: 502 },
      );
    }

    const rawHtml = await response.text();

    // Extract image before stripping HTML
    const imageUrl = extractImageUrl(rawHtml, url);

    const text = stripHtml(rawHtml).slice(0, 10000);

    if (text.length < 100) {
      return Response.json(
        { error: 'Page has no meaningful content' },
        { status: 422 },
      );
    }

    // Run AI extraction server-side (Anthropic API blocks browser CORS)
    const recipe = await importFromUrl(text, url);

    return Response.json({ recipe, imageUrl });
  } catch (e: any) {
    return Response.json({ error: e.message }, { status: 500 });
  }
}
