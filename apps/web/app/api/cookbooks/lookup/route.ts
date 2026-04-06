import { lookupIsbn, readBookCover } from '@chefsbook/ai';

export async function POST(req: Request) {
  const { isbn, imageBase64, imageMimeType } = await req.json();

  if (isbn) {
    const result = await lookupIsbn(isbn);
    if (!result) return Response.json({ error: 'Book not found' }, { status: 404 });
    return Response.json(result);
  }

  if (imageBase64) {
    const result = await readBookCover(imageBase64, imageMimeType ?? 'image/jpeg');
    if (!result) return Response.json({ error: 'Could not read cover' }, { status: 422 });
    // Search Google Books by title+author
    const searchUrl = `https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(result.title + (result.author ? ' ' + result.author : ''))}&maxResults=1`;
    try {
      const res = await fetch(searchUrl, { signal: AbortSignal.timeout(10000) });
      if (res.ok) {
        const data = await res.json();
        const item = data.items?.[0];
        if (item?.volumeInfo) {
          const v = item.volumeInfo;
          return Response.json({
            title: v.title ?? result.title,
            author: v.authors?.join(', ') ?? result.author,
            publisher: v.publisher ?? null,
            year: v.publishedDate ? parseInt(v.publishedDate) || null : null,
            description: v.description ?? null,
            coverUrl: v.imageLinks?.thumbnail?.replace('http:', 'https:') ?? null,
            isbn: v.industryIdentifiers?.find((i: any) => i.type === 'ISBN_13')?.identifier ?? null,
            googleBooksId: item.id,
          });
        }
      }
    } catch {}
    return Response.json({ title: result.title, author: result.author });
  }

  return Response.json({ error: 'Provide isbn or imageBase64' }, { status: 400 });
}
