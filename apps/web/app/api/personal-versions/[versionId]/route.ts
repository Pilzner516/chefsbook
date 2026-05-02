import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin, getRecipe, getPersonalVersionCount, removeRecipeModifier, replaceIngredients, replaceSteps } from '@chefsbook/db';

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ versionId: string }> }
) {
  const { versionId } = await params;

  const authHeader = request.headers.get('authorization');
  const token = authHeader?.replace('Bearer ', '');
  if (!token) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { data: version } = await supabaseAdmin
    .from('recipes')
    .select('*')
    .eq('id', versionId)
    .eq('is_personal_version', true)
    .single();

  if (!version) {
    return NextResponse.json({ error: 'Version not found' }, { status: 404 });
  }

  if (version.user_id !== user.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const body = await request.json();
  const { title, description, ingredients, steps, notes } = body as {
    title?: string;
    description?: string;
    ingredients?: Array<{ name: string; quantity: string; unit: string; group?: string }>;
    steps?: Array<{ instruction: string; duration_minutes?: number }>;
    notes?: string;
  };

  const updates: Record<string, unknown> = {};
  if (title !== undefined) updates.title = title;
  if (description !== undefined) updates.description = description;
  if (notes !== undefined) updates.notes = notes;

  if (Object.keys(updates).length > 0) {
    await supabaseAdmin.from('recipes').update(updates).eq('id', versionId);
  }

  if (ingredients) {
    const ingRows = ingredients.map((ing, i) => ({
      quantity: parseFloat(ing.quantity) || null,
      unit: ing.unit || null,
      ingredient: ing.name,
      preparation: null,
      optional: false,
      group_label: ing.group || null,
    }));
    await replaceIngredients(versionId, user.id, ingRows);
  }

  if (steps) {
    const stepRows = steps.map((step, i) => ({
      step_number: i + 1,
      instruction: step.instruction,
      timer_minutes: step.duration_minutes || null,
      group_label: null,
    }));
    await replaceSteps(versionId, user.id, stepRows);
  }

  const { data: updated } = await supabaseAdmin
    .from('recipes')
    .select('*')
    .eq('id', versionId)
    .single();

  return NextResponse.json({ version: updated });
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ versionId: string }> }
) {
  const { versionId } = await params;

  const authHeader = request.headers.get('authorization');
  const token = authHeader?.replace('Bearer ', '');
  if (!token) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { data: version } = await supabaseAdmin
    .from('recipes')
    .select('*')
    .eq('id', versionId)
    .eq('is_personal_version', true)
    .single();

  if (!version) {
    return NextResponse.json({ error: 'Version not found' }, { status: 404 });
  }

  if (version.user_id !== user.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const originalRecipeId = version.personal_version_of;

  await supabaseAdmin.from('recipe_ingredients').delete().eq('recipe_id', versionId);
  await supabaseAdmin.from('recipe_steps').delete().eq('recipe_id', versionId);
  await supabaseAdmin.from('recipe_user_photos').delete().eq('recipe_id', versionId);
  await supabaseAdmin.from('recipes').delete().eq('id', versionId);

  const remainingCount = await getPersonalVersionCount(originalRecipeId, user.id);
  if (remainingCount === 0 && originalRecipeId) {
    await removeRecipeModifier(originalRecipeId, user.id);
  }

  return NextResponse.json({ success: true });
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ versionId: string }> }
) {
  const { versionId } = await params;
  const url = new URL(request.url);
  const action = url.searchParams.get('action');

  if (action !== 'promote') {
    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  }

  const authHeader = request.headers.get('authorization');
  const token = authHeader?.replace('Bearer ', '');
  if (!token) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { data: version } = await supabaseAdmin
    .from('recipes')
    .select('*')
    .eq('id', versionId)
    .eq('is_personal_version', true)
    .single();

  if (!version) {
    return NextResponse.json({ error: 'Version not found' }, { status: 404 });
  }

  if (version.user_id !== user.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const originalRecipeId = version.personal_version_of;
  const originalRecipe = originalRecipeId ? await getRecipe(originalRecipeId) : null;

  let newDescription = version.description || '';
  if (originalRecipe) {
    const attribution = `\n\nOriginally a version of "${originalRecipe.title}" by @${originalRecipe.original_submitter_username || 'chef'}.`;
    newDescription = newDescription + attribution;
  }

  await supabaseAdmin.from('recipes').update({
    is_personal_version: false,
    personal_version_of: null,
    personal_version_slot: null,
    description: newDescription,
    visibility: 'private',
    source_type: 'manual',
  }).eq('id', versionId);

  const remainingCount = await getPersonalVersionCount(originalRecipeId!, user.id);
  if (remainingCount === 0 && originalRecipeId) {
    await removeRecipeModifier(originalRecipeId, user.id);
  }

  const { data: promotedRecipe } = await supabaseAdmin
    .from('recipes')
    .select('*')
    .eq('id', versionId)
    .single();

  return NextResponse.json({ promotedRecipe });
}
