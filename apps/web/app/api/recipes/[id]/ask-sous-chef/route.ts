import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin, getRecipe, isRecipeSaved, getPersonalVersions, getUserPlanTier, PLAN_LIMITS } from '@chefsbook/db';
import { askSousChef } from '@chefsbook/ai';
import { logAiCall } from '@chefsbook/db';

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

  const body = await request.json();
  const { feedback, baseVersion } = body as { feedback: string; baseVersion: 'original' | 'v1' | 'v2' };

  if (!feedback?.trim()) {
    return NextResponse.json({ error: 'Feedback is required' }, { status: 400 });
  }

  const originalRecipe = await getRecipe(recipeId);
  if (!originalRecipe) {
    return NextResponse.json({ error: 'Recipe not found' }, { status: 404 });
  }

  const isOwner = originalRecipe.user_id === user.id;
  const isSaved = await isRecipeSaved(recipeId, user.id);
  if (!isOwner && !isSaved) {
    return NextResponse.json({ error: 'You must save this recipe first' }, { status: 403 });
  }

  let recipeToUse = originalRecipe;

  if (baseVersion === 'v1' || baseVersion === 'v2') {
    const slot = baseVersion === 'v1' ? 1 : 2;
    const versions = await getPersonalVersions(recipeId, user.id);
    const versionRecipe = versions.find(v => v.personal_version_slot === slot);
    if (!versionRecipe) {
      return NextResponse.json({ error: `Version ${slot} not found` }, { status: 404 });
    }
    recipeToUse = versionRecipe;
  }

  try {
    const startTime = Date.now();
    const regenerated = await askSousChef(recipeToUse, feedback);
    const durationMs = Date.now() - startTime;

    logAiCall({
      userId: user.id,
      action: 'ask_sous_chef',
      model: 'sonnet',
      recipeId,
      metadata: { baseVersion, feedbackLength: feedback.length },
      success: true,
      durationMs,
    });

    return NextResponse.json({ regenerated });
  } catch (error) {
    logAiCall({
      userId: user.id,
      action: 'ask_sous_chef',
      model: 'sonnet',
      recipeId,
      success: false,
      metadata: { error: String(error) },
    });
    return NextResponse.json({ error: 'Failed to generate response' }, { status: 500 });
  }
}
