import { NextRequest } from 'next/server';
import { supabase, supabaseAdmin, logAiCall } from '@chefsbook/db';
import { generateMissingIngredients, consumeLastUsage } from '@chefsbook/ai';

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: recipeId } = await params;

  // Auth
  const authHeader = req.headers.get('authorization') ?? '';
  if (!authHeader.startsWith('Bearer ')) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const token = authHeader.slice(7);
  const { data: { user } } = await supabase.auth.getUser(token);
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  // Fetch recipe
  const { data: recipe } = await supabaseAdmin
    .from('recipes')
    .select('id, user_id, title, description, servings, cuisine, tags')
    .eq('id', recipeId)
    .single();

  if (!recipe) return Response.json({ error: 'Recipe not found' }, { status: 404 });

  // Must own the recipe or be admin
  if (recipe.user_id !== user.id) {
    const { data: admin } = await supabaseAdmin.from('admin_users').select('role').eq('user_id', user.id).maybeSingle();
    if (!admin) return Response.json({ error: 'Forbidden' }, { status: 403 });
  }

  // Fetch steps
  const { data: steps } = await supabaseAdmin
    .from('recipe_steps')
    .select('instruction')
    .eq('recipe_id', recipeId)
    .order('step_number');

  if (!steps || steps.length === 0) {
    return Response.json({ error: 'Recipe has no steps — cannot generate ingredients without them' }, { status: 422 });
  }

  try {
    const t0 = Date.now();
    const generated = await generateMissingIngredients({
      title: recipe.title,
      description: recipe.description,
      steps: steps.map((s) => s.instruction),
      servings: recipe.servings,
      cuisine: recipe.cuisine,
      tags: recipe.tags,
    });

    const u = consumeLastUsage();
    logAiCall({ userId: user.id, action: 'generate_ingredients', model: 'sonnet', recipeId, durationMs: Date.now() - t0, tokensIn: u?.inputTokens, tokensOut: u?.outputTokens, success: true }).catch(() => {});

    return Response.json({
      ingredients: generated,
      count: generated.length,
      recipeId,
    });
  } catch (err: any) {
    return Response.json({ error: err.message }, { status: 500 });
  }
}
