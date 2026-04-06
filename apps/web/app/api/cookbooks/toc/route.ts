import { createClient } from '@supabase/supabase-js';
import { generateCookbookToc } from '@chefsbook/ai';

function getServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL ?? '',
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? '',
  );
}

export async function POST(req: Request) {
  const { cookbookId } = await req.json();
  if (!cookbookId) return Response.json({ error: 'cookbookId required' }, { status: 400 });

  const db = getServiceClient();

  const { data: cookbook } = await db.from('cookbooks').select('*').eq('id', cookbookId).single();
  if (!cookbook) return Response.json({ error: 'Cookbook not found' }, { status: 404 });

  // Generate TOC via AI
  const chapters = await generateCookbookToc(
    cookbook.title,
    cookbook.author,
    cookbook.year,
    cookbook.description,
  );

  // Flatten and insert
  const recipes: any[] = [];
  for (const ch of chapters) {
    for (const r of ch.recipes) {
      recipes.push({
        cookbook_id: cookbookId,
        title: r.title,
        page_number: r.page_estimate,
        chapter: ch.name,
        ai_generated: true,
      });
    }
  }

  if (recipes.length) {
    await db.from('cookbook_recipes').insert(recipes);
  }

  await db.from('cookbooks').update({
    toc_fetched: true,
    toc_fetched_at: new Date().toISOString(),
    total_recipes: recipes.length,
  }).eq('id', cookbookId);

  return Response.json({ chapters: chapters.length, recipes: recipes.length });
}
