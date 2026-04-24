import { callClaude, extractJSON, HAIKU } from './client';

export interface BookMetadata {
  title: string;
  author: string | null;
  publisher: string | null;
  year: number | null;
  description: string | null;
  coverUrl: string | null;
  isbn: string | null;
  googleBooksId: string | null;
}

/**
 * Look up a book by ISBN using Google Books, then OpenLibrary fallback.
 */
export async function lookupIsbn(isbn: string): Promise<BookMetadata | null> {
  const clean = isbn.replace(/[-\s]/g, '');

  // Google Books
  const apiKey = process.env.GOOGLE_BOOKS_API_KEY;
  const gbUrl = apiKey
    ? `https://www.googleapis.com/books/v1/volumes?q=isbn:${clean}&key=${apiKey}`
    : `https://www.googleapis.com/books/v1/volumes?q=isbn:${clean}`;

  try {
    const res = await fetch(gbUrl, { signal: AbortSignal.timeout(10000) });
    if (res.ok) {
      const data = await res.json();
      const item = data.items?.[0];
      if (item?.volumeInfo) {
        const v = item.volumeInfo;
        return {
          title: v.title ?? '',
          author: v.authors?.join(', ') ?? null,
          publisher: v.publisher ?? null,
          year: v.publishedDate ? parseInt(v.publishedDate) || null : null,
          description: v.description ?? null,
          coverUrl: v.imageLinks?.thumbnail?.replace('http:', 'https:') ?? null,
          isbn: clean,
          googleBooksId: item.id,
        };
      }
    }
  } catch {}

  // OpenLibrary fallback
  try {
    const res = await fetch(`https://openlibrary.org/isbn/${clean}.json`, { signal: AbortSignal.timeout(10000) });
    if (res.ok) {
      const data = await res.json();
      return {
        title: data.title ?? '',
        author: null, // would need another call to /authors/
        publisher: data.publishers?.[0] ?? null,
        year: data.publish_date ? parseInt(data.publish_date) || null : null,
        description: typeof data.description === 'string' ? data.description : data.description?.value ?? null,
        coverUrl: data.covers?.[0] ? `https://covers.openlibrary.org/b/id/${data.covers[0]}-L.jpg` : null,
        isbn: clean,
        googleBooksId: null,
      };
    }
  } catch {}

  return null;
}

/**
 * Read book title + author from a cover photo using Claude vision.
 */
export async function readBookCover(imageBase64: string, mimeType: string = 'image/jpeg'): Promise<{ title: string; author: string | null } | null> {
  const prompt = 'Read the title and author from this book cover. Return ONLY JSON: { "title": "string", "author": "string | null" }';
  const text = await callClaude({ prompt, imageBase64, imageMimeType: mimeType, maxTokens: 200, model: HAIKU });
  try {
    return extractJSON<{ title: string; author: string | null }>(text);
  } catch {
    return null;
  }
}

export interface AiTocChapter {
  name: string;
  recipes: { title: string; page_estimate: number | null }[];
}

/**
 * Generate an AI-estimated table of contents for a cookbook.
 */
export async function generateCookbookToc(
  title: string,
  author: string | null,
  year: number | null,
  description: string | null,
): Promise<AiTocChapter[]> {
  const prompt = `Based on this cookbook: "${title}"${author ? ` by ${author}` : ''}${year ? `, published ${year}` : ''}.
${description ? `Description: ${description}` : ''}

Suggest a realistic table of contents with chapter names and representative recipe titles (5-10 recipes per chapter).
Only suggest recipes that would actually appear in this type of cookbook.

Return ONLY a JSON array:
[{ "name": "chapter name", "recipes": [{ "title": "recipe name", "page_estimate": number_or_null }] }]`;

  const text = await callClaude({ prompt, maxTokens: 4000 });
  try {
    return extractJSON<AiTocChapter[]>(text);
  } catch {
    return [];
  }
}
