import { NextRequest, NextResponse } from 'next/server';
import { supabase, supabaseAdmin, getRecipe, getPersonalVersions, getPersonalVersionCount, isRecipeSaved, upsertRecipeModifier, getUserPlanTier, PLAN_LIMITS } from '@chefsbook/db';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: recipeId } = await params;

  const authHeader = request.headers.get('authorization');
  const token = authHeader?.replace('Bearer ', '');
  if (!token) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const versions = await getPersonalVersions(recipeId, user.id);
  return NextResponse.json({ versions });
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: recipeId } = await params;

  const authHeader = request.headers.get('authorization');
  const token = authHeader?.replace('Bearer ', '');
  if (!token) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const tier = await getUserPlanTier(user.id);
  const limits = PLAN_LIMITS[tier];
  if (!limits.canAI) {
    return NextResponse.json({ error: 'PLAN_REQUIRED', requiredPlan: 'chef' }, { status: 403 });
  }

  const isSaved = await isRecipeSaved(recipeId, user.id);
  if (!isSaved) {
    return NextResponse.json({ error: 'You must save this recipe first' }, { status: 403 });
  }

  const count = await getPersonalVersionCount(recipeId, user.id);
  if (count >= 2) {
    return NextResponse.json({ error: 'SLOTS_FULL' }, { status: 409 });
  }

  const slot = count === 0 ? 1 : 2;

  const body = await request.json();
  const { title, description, ingredients, steps, notes } = body as {
    title: string;
    description: string;
    ingredients: Array<{ name: string; quantity: string; unit: string; group?: string }>;
    steps: Array<{ instruction: string; duration_minutes?: number }>;
    notes?: string;
  };

  const originalRecipe = await getRecipe(recipeId);
  if (!originalRecipe) {
    return NextResponse.json({ error: 'Original recipe not found' }, { status: 404 });
  }

  const { data: profile } = await supabaseAdmin
    .from('user_profiles')
    .select('username')
    .eq('id', user.id)
    .single();
  const username = profile?.username ?? 'chef';

  const { data: newRecipe, error: createError } = await supabaseAdmin
    .from('recipes')
    .insert({
      user_id: user.id,
      title: title || `My Version ${slot}`,
      description,
      notes,
      visibility: 'private',
      is_personal_version: true,
      personal_version_of: recipeId,
      personal_version_slot: slot,
      original_submitter_id: user.id,
      original_submitter_username: username,
      cuisine: originalRecipe.cuisine,
      course: originalRecipe.course,
      tags: originalRecipe.tags,
      source_type: 'personal_version',
    })
    .select()
    .single();

  if (createError || !newRecipe) {
    return NextResponse.json({ error: 'Failed to create version' }, { status: 500 });
  }

  const ingredientRows = ingredients.map((ing, i) => ({
    recipe_id: newRecipe.id,
    user_id: user.id,
    sort_order: i,
    quantity: parseFloat(ing.quantity) || null,
    unit: ing.unit || null,
    ingredient: ing.name,
    preparation: null,
    optional: false,
    group_label: ing.group || null,
  }));

  const stepRows = steps.map((step, i) => ({
    recipe_id: newRecipe.id,
    user_id: user.id,
    step_number: i + 1,
    instruction: step.instruction,
    timer_minutes: step.duration_minutes || null,
    group_label: null,
  }));

  await Promise.all([
    ingredientRows.length
      ? supabaseAdmin.from('recipe_ingredients').insert(ingredientRows)
      : Promise.resolve(),
    stepRows.length
      ? supabaseAdmin.from('recipe_steps').insert(stepRows)
      : Promise.resolve(),
  ]);

  await upsertRecipeModifier(recipeId, user.id, username);

  return NextResponse.json({ version: newRecipe });
}
