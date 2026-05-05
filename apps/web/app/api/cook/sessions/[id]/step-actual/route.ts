import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@chefsbook/db';
import { updateKnowledgeFromActuals } from '@chefsbook/ai';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Verify authentication
    const authHeader = request.headers.get('authorization');
    if (!authHeader) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.replace('Bearer ', '');
    const {
      data: { user },
      error: authError,
    } = await supabaseAdmin.auth.getUser(token);

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id: sessionId } = await params;
    const body = await request.json();
    const {
      recipe_id,
      recipe_step_id,
      planned_duration_min,
      planned_duration_max,
      actual_duration_seconds,
      step_index,
      technique,
      ingredient_category,
      is_passive,
      was_paused,
    } = body;

    if (
      !recipe_id ||
      !recipe_step_id ||
      actual_duration_seconds === undefined ||
      step_index === undefined
    ) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Insert step_actual
    const { error: insertError } = await supabaseAdmin
      .from('step_actuals')
      .insert({
        cooking_session_id: sessionId,
        recipe_id,
        recipe_step_id,
        user_id: user.id,
        planned_duration_min,
        planned_duration_max,
        actual_duration_seconds,
        step_index,
        technique: technique || null,
        ingredient_category: ingredient_category || null,
        is_passive: is_passive || false,
        was_paused: was_paused || false,
      });

    if (insertError) {
      console.error('[step-actual] Insert error:', insertError);
      return NextResponse.json(
        { error: 'Failed to record step actual' },
        { status: 500 }
      );
    }

    // Fire-and-forget: update knowledge graph
    updateKnowledgeFromActuals({
      technique: technique || null,
      ingredient_category: ingredient_category || null,
      actual_duration_seconds,
      planned_duration_min,
      planned_duration_max,
    }).catch((err) => {
      console.error('[step-actual] Knowledge update error:', err);
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('[step-actual] Unexpected error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
