import { createClient } from '@supabase/supabase-js';
import { callClaude, extractJSON } from '@chefsbook/ai';

function getServiceClient() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL ?? '', process.env.SUPABASE_SERVICE_ROLE_KEY ?? '');
}

const TAG_PROMPT = `Analyze this recipe and return cuisine, course, and tags.

Rules for course:
- Waffles, pancakes, eggs, french toast, oatmeal, granola → breakfast
- Sandwiches, wraps, light soups, salads → lunch
- Pasta, roasts, stews, grills, curries, heavy proteins → dinner
- Lamb, beef roast, whole chicken, prime rib → dinner
- Cakes, cookies, pies, ice cream, pudding → dessert
- Chips, dips, nuts, energy bites → snack
- Smoothies, cocktails, coffee drinks → drink
- Rice dishes, potato dishes, vegetable sides → side
- Appetizers, bruschetta, small bites → starter
- Breads, rolls, focaccia, biscuits, pretzels → bread
- If lunch/dinner ambiguous, pick the more likely one

Return ONLY JSON:
{ "cuisine": "string", "course": "string", "tags": ["string"] }

Tags should be 5-8 lowercase strings covering: main protein (chicken, beef, fish, vegetarian, vegan), cooking method (baked, grilled, fried, slow-cooked, no-knead), characteristics (quick, one-pot, meal-prep, comfort-food), diet flags (gluten-free, dairy-free) if applicable.`;

export async function POST(req: Request) {
  const db = getServiceClient();

  const authHeader = req.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) return Response.json({ error: 'Unauthorized' }, { status: 401 });
  const { data: { user } } = await db.auth.getUser(authHeader.slice(7));
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  // Find recipes needing tags
  const { data: recipes } = await db
    .from('recipes')
    .select('id, title, description, cuisine, course, tags')
    .eq('user_id', user.id)
    .or('cuisine.is.null,cuisine.eq.,course.is.null,course.eq.');

  // Also find recipes with too few tags
  const { data: lowTags } = await db
    .from('recipes')
    .select('id, title, description, cuisine, course, tags')
    .eq('user_id', user.id)
    .not('id', 'in', `(${(recipes ?? []).map((r) => `'${r.id}'`).join(',') || "'none'"})`);

  const allNeedingWork = [
    ...(recipes ?? []),
    ...(lowTags ?? []).filter((r) => !r.tags || r.tags.length < 3),
  ];

  const total = allNeedingWork.length;
  if (total === 0) return Response.json({ total: 0, updated: 0 });

  // Get ingredients for each recipe
  let updated = 0;
  const batchSize = 5;

  for (let i = 0; i < allNeedingWork.length; i += batchSize) {
    const batch = allNeedingWork.slice(i, i + batchSize);

    for (const recipe of batch) {
      try {
        const { data: ings } = await db.from('recipe_ingredients').select('ingredient').eq('recipe_id', recipe.id).limit(10);
        const ingList = (ings ?? []).map((i: any) => i.ingredient).join(', ');

        const prompt = `${TAG_PROMPT}\n\nTitle: ${recipe.title}\nDescription: ${recipe.description ?? ''}\nIngredients: ${ingList}`;
        const text = await callClaude({ prompt, maxTokens: 300 });
        const result = extractJSON(text) as any;

        const updates: any = {};
        if ((!recipe.cuisine || recipe.cuisine === '') && result.cuisine) updates.cuisine = result.cuisine;
        if ((!recipe.course || recipe.course === '') && result.course) {
          const course = Array.isArray(result.course) ? result.course[0] : result.course;
          updates.course = course?.toLowerCase();
        }
        if (result.tags?.length) {
          const existing = recipe.tags ?? [];
          const newTags = result.tags.map((t: string) => t.toLowerCase().trim()).filter((t: string) => !existing.includes(t));
          if (newTags.length > 0) updates.tags = [...existing, ...newTags];
        }

        if (Object.keys(updates).length > 0) {
          await db.from('recipes').update(updates).eq('id', recipe.id);
          updated++;
        }
      } catch {}
    }

    // Small delay between batches
    if (i + batchSize < allNeedingWork.length) {
      await new Promise((r) => setTimeout(r, 1000));
    }
  }

  return Response.json({ total, updated });
}

// GET to check how many need tagging
export async function GET(req: Request) {
  const db = getServiceClient();
  const authHeader = req.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) return Response.json({ error: 'Unauthorized' }, { status: 401 });
  const { data: { user } } = await db.auth.getUser(authHeader.slice(7));
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const { count } = await db.from('recipes').select('*', { count: 'exact', head: true })
    .eq('user_id', user.id)
    .or('cuisine.is.null,cuisine.eq.,course.is.null,course.eq.');

  return Response.json({ needsTagging: count ?? 0 });
}
