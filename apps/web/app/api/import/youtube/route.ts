import { importFromYouTube, importFromUrl, stripHtml, classifyContent, importTechniqueFromYouTube } from '@chefsbook/ai';
import { YoutubeTranscript } from 'youtube-transcript';
import { fetchWithFallback } from '../_utils';

const YT_URL_PATTERNS = [
  /(?:youtube\.com\/watch\?.*v=|youtu\.be\/|youtube\.com\/shorts\/)([\w-]{11})/,
];

function extractVideoId(url: string): string | null {
  for (const pattern of YT_URL_PATTERNS) {
    const match = url.match(pattern);
    if (match?.[1]) return match[1];
  }
  return null;
}

interface YouTubeSnippet {
  title: string;
  description: string;
  channelTitle: string;
  tags?: string[];
  thumbnails: { maxres?: { url: string }; high?: { url: string }; default?: { url: string } };
}

async function fetchVideoMetadata(videoId: string): Promise<YouTubeSnippet | null> {
  const apiKey = process.env.YOUTUBE_API_KEY;
  if (!apiKey) {
    // Fallback: use oembed for basic metadata (no API key needed)
    try {
      const res = await fetch(
        `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`,
        { signal: AbortSignal.timeout(10000) },
      );
      if (!res.ok) return null;
      const data = await res.json();
      return {
        title: data.title ?? '',
        description: '',
        channelTitle: data.author_name ?? '',
        thumbnails: { high: { url: `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg` } },
      };
    } catch {
      return null;
    }
  }

  try {
    const res = await fetch(
      `https://www.googleapis.com/youtube/v3/videos?part=snippet&id=${videoId}&key=${apiKey}`,
      { signal: AbortSignal.timeout(10000) },
    );
    if (!res.ok) return null;
    const data = await res.json();
    return data.items?.[0]?.snippet ?? null;
  } catch {
    return null;
  }
}

async function fetchTranscript(videoId: string): Promise<string> {
  try {
    const entries = await YoutubeTranscript.fetchTranscript(videoId);
    return entries
      .map((e) => `[${Math.round(e.offset / 1000)}s] ${e.text}`)
      .join('\n');
  } catch {
    return '';
  }
}

/**
 * Scan a YouTube description for recipe URLs.
 * Patterns: "RECIPE: url", "Full recipe: url", URLs containing /recipe
 */
function findRecipeUrlInDescription(description: string): string | null {
  // Explicit recipe link patterns
  const explicitPatterns = [
    /(?:recipe|full recipe|get the recipe|printable recipe)\s*[:|\-|–]\s*(https?:\/\/\S+)/i,
    /(?:recipe|full recipe|get the recipe)\s+(https?:\/\/\S+)/i,
  ];
  for (const pattern of explicitPatterns) {
    const match = description.match(pattern);
    if (match?.[1]) return match[1].replace(/[,.)]+$/, '');
  }

  // Any URL containing /recipe
  const urlPattern = /https?:\/\/\S+/g;
  let m;
  while ((m = urlPattern.exec(description)) !== null) {
    const u = m[0].replace(/[,.)]+$/, '');
    if (/\/recipes?[/-]/i.test(u) || /[-_]recipe/i.test(u)) return u;
  }

  return null;
}

function extractImageUrl(html: string, pageUrl: string): string | null {
  const ogMatch = html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i)
    ?? html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i);
  if (ogMatch?.[1]) { try { return new URL(ogMatch[1], pageUrl).href; } catch { return ogMatch[1]; } }
  return null;
}

export async function POST(req: Request) {
  const { url, forceType, classifyOnly } = await req.json();

  if (!url || typeof url !== 'string') {
    return Response.json({ error: 'URL is required' }, { status: 400 });
  }

  const videoId = extractVideoId(url);
  if (!videoId) {
    return Response.json({ error: 'Not a valid YouTube URL' }, { status: 400 });
  }

  try {
    // Step 1: Fetch metadata
    const snippet = await fetchVideoMetadata(videoId);
    if (!snippet) {
      return Response.json({ error: 'Could not fetch video metadata' }, { status: 502 });
    }

    const thumbnail =
      snippet.thumbnails.maxres?.url ??
      snippet.thumbnails.high?.url ??
      snippet.thumbnails.default?.url ??
      `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;

    // Step 2: Check for recipe URL in description
    const recipeUrl = findRecipeUrlInDescription(snippet.description);
    if (recipeUrl) {
      try {
        const { html } = await fetchWithFallback(recipeUrl);
        const pageImage = extractImageUrl(html, recipeUrl);
        const text = stripHtml(html).slice(0, 10000);
        if (text.length > 500) {
          const recipe = await importFromUrl(text, recipeUrl);
          if (recipe?.title && recipe?.ingredients?.length) {
            return Response.json({
              contentType: 'recipe',
              videoOnly: false,
              videoId,
              channelName: snippet.channelTitle,
              thumbnail: pageImage ?? thumbnail,
              recipe,
              linkedRecipeUrl: recipeUrl,
            });
          }
        }
      } catch {
        // Link follow failed — fall back to transcript extraction
      }
    }

    // Step 3: Fetch transcript
    const transcript = await fetchTranscript(videoId);

    // Step 4: Classify content
    const classifyText = `${snippet.title}\n${snippet.description}`.slice(0, 1000);
    const contentType = forceType ?? (await classifyContent(classifyText, url)).content_type;

    // If classify-only mode, return classification without extraction
    if (classifyOnly) {
      return Response.json({
        contentType,
        videoId,
        title: snippet.title,
        description: snippet.description?.slice(0, 500) || null,
        channelName: snippet.channelTitle,
        thumbnail,
      });
    }

    if (contentType === 'technique') {
      const technique = await importTechniqueFromYouTube({
        videoTitle: snippet.title,
        description: snippet.description,
        transcript,
      });

      if (!technique) {
        return Response.json({
          contentType: 'technique',
          videoOnly: true,
          videoId,
          title: snippet.title,
          description: snippet.description?.slice(0, 500) || null,
          channelName: snippet.channelTitle,
          thumbnail,
          tags: snippet.tags?.slice(0, 10) ?? [],
        });
      }

      return Response.json({
        contentType: 'technique',
        videoOnly: false,
        videoId,
        channelName: snippet.channelTitle,
        thumbnail,
        technique,
      });
    }

    // Default: recipe extraction
    const recipe = await importFromYouTube({
      videoTitle: snippet.title,
      description: snippet.description,
      transcript,
    });

    if (!recipe) {
      return Response.json({
        contentType: 'recipe',
        videoOnly: true,
        videoId,
        title: snippet.title,
        description: snippet.description?.slice(0, 500) || null,
        channelName: snippet.channelTitle,
        thumbnail,
        tags: snippet.tags?.slice(0, 10) ?? [],
      });
    }

    return Response.json({
      contentType: 'recipe',
      videoOnly: false,
      videoId,
      channelName: snippet.channelTitle,
      thumbnail,
      recipe,
    });
  } catch (e: any) {
    return Response.json({ error: e.message }, { status: 500 });
  }
}
