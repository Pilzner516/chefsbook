import { createClient } from '@supabase/supabase-js';
import { generateMealPlan } from '@chefsbook/ai';
import type { MealPlanPreferences } from '@chefsbook/ai';
import { logAiCall } from '@chefsbook/db';

function getServiceClient() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL ?? '', process.env.SUPABASE_SERVICE_ROLE_KEY ?? '');
}

export async function POST(req: Request) {
  const db = getServiceClient();
  const authHeader = req.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) return Response.json({ error: 'Unauthorized' }, { status: 401 });
  const { data: { user } } = await db.auth.getUser(authHeader.slice(7));
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const preferences = await req.json() as MealPlanPreferences;

  // Fetch user's recipes for context
  const { data: recipes } = await db
    .from('recipes')
    .select('id, title, cuisine, course, tags, total_minutes')
    .eq('user_id', user.id)
    .order('updated_at', { ascending: false })
    .limit(50);

  const userRecipes = (recipes ?? []).map((r: any) => ({
    id: r.id,
    title: r.title,
    cuisine: r.cuisine,
    course: r.course,
    tags: r.tags ?? [],
    total_minutes: r.total_minutes,
  }));

  const t0 = Date.now();
  const plan = await generateMealPlan(preferences, userRecipes);

  logAiCall({ userId: user?.id, action: 'generate_meal_plan', model: 'sonnet', durationMs: Date.now() - t0, success: true }).catch(() => {});

  return Response.json({ plan });
}
