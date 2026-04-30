import { createClient } from '@supabase/supabase-js';
import { generateMealPlan, consumeLastUsage } from '@chefsbook/ai';
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

  // Fetch recipes based on source preference
  let allRecipes: { id: string; title: string; cuisine: string | null; course: string | null; tags: string[]; total_minutes: number | null }[] = [];

  if (preferences.source === 'my_recipes' || preferences.source === 'mix') {
    const { data: userRecipesData } = await db
      .from('recipes')
      .select('id, title, cuisine, course, tags, total_minutes')
      .eq('user_id', user.id)
      .order('updated_at', { ascending: false })
      .limit(100);
    allRecipes = (userRecipesData ?? []).map((r: any) => ({
      id: r.id,
      title: r.title,
      cuisine: r.cuisine,
      course: r.course,
      tags: r.tags ?? [],
      total_minutes: r.total_minutes,
    }));
  }

  if (preferences.source === 'community' || preferences.source === 'mix') {
    const { data: communityData } = await db
      .from('recipes')
      .select('id, title, cuisine, course, tags, total_minutes')
      .neq('user_id', user.id)
      .in('visibility', ['public', 'shared_link'])
      .order('updated_at', { ascending: false })
      .limit(preferences.source === 'community' ? 150 : 50);
    const communityRecipes = (communityData ?? []).map((r: any) => ({
      id: r.id,
      title: r.title,
      cuisine: r.cuisine,
      course: r.course,
      tags: r.tags ?? [],
      total_minutes: r.total_minutes,
    }));
    allRecipes = [...allRecipes, ...communityRecipes];
  }

  // Build a set of valid recipe IDs for validation
  const validRecipeIds = new Set(allRecipes.map((r) => r.id));

  const t0 = Date.now();
  const result = await generateMealPlan(preferences, allRecipes);

  // Validate AI response: remove any entries with phantom recipe IDs
  const validatedPlan = result.plan.filter((entry) => {
    if (!entry.recipe_id) return true; // null recipe_id is allowed (empty slot)
    if (validRecipeIds.has(entry.recipe_id)) return true;
    // Phantom recipe detected - remove from plan
    console.warn(`Meal plan validation: removed phantom recipe_id ${entry.recipe_id} (title: ${entry.title})`);
    return false;
  });

  const u = consumeLastUsage();
  logAiCall({ userId: user?.id, action: 'generate_meal_plan', model: 'sonnet', durationMs: Date.now() - t0, tokensIn: u?.inputTokens, tokensOut: u?.outputTokens, success: true }).catch(() => {});

  return Response.json({ plan: validatedPlan, daily_summaries: result.daily_summaries });
}
