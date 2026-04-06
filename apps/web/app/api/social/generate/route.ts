import { generateSocialPost, generateHashtags } from '@chefsbook/ai';

export async function POST(req: Request) {
  const { title, description, cuisine, course, tags, ingredients, platform, type } = await req.json();

  if (!title) return Response.json({ error: 'Title required' }, { status: 400 });

  try {
    if (type === 'hashtags') {
      const hashtags = await generateHashtags({ title, cuisine, course, tags: tags ?? [], ingredients: ingredients ?? [] });
      return Response.json({ hashtags });
    }

    const text = await generateSocialPost({
      title,
      description,
      cuisine,
      ingredients: ingredients ?? [],
      platform: platform ?? 'instagram',
    });
    return Response.json({ text });
  } catch (e: any) {
    return Response.json({ error: e.message }, { status: 500 });
  }
}
