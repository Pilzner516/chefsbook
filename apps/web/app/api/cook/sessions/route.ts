import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@chefsbook/db';
import { generateChefBriefing } from '@chefsbook/ai';
import { createCookingPlan } from '@chefsbook/ui';
import type { ChefSetup, MenuWithSteps } from '@chefsbook/ui';

export async function POST(request: NextRequest) {
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

    const body = await request.json();
    const { recipe_id, setup } = body as { recipe_id: string; setup: ChefSetup };

    if (!recipe_id || !setup) {
      return NextResponse.json(
        { error: 'Missing recipe_id or setup' },
        { status: 400 }
      );
    }

    // Fetch recipe with steps
    const { data: recipe, error: recipeError } = await supabaseAdmin
      .from('recipes')
      .select(
        `
        id,
        title,
        recipe_steps (
          id,
          recipe_id,
          step_number,
          instruction,
          duration_min,
          duration_max,
          is_passive,
          uses_oven,
          oven_temp_celsius,
          phase,
          timing_confidence
        )
      `
      )
      .eq('id', recipe_id)
      .single();

    if (recipeError || !recipe) {
      return NextResponse.json({ error: 'Recipe not found' }, { status: 404 });
    }

    // Build menu structure for scheduler
    const menuWithSteps: MenuWithSteps = {
      id: recipe_id,
      menu_items: [
        {
          course: 'main' as const,
          recipe: {
            id: recipe.id,
            title: recipe.title,
            recipe_steps: (recipe.recipe_steps as any[]).map((step) => ({
              id: step.id,
              recipe_id: step.recipe_id,
              step_number: step.step_number,
              instruction: step.instruction,
              duration_min: step.duration_min,
              duration_max: step.duration_max,
              is_passive: step.is_passive || false,
              uses_oven: step.uses_oven || false,
              oven_temp_celsius: step.oven_temp_celsius,
              phase: step.phase || 'cook',
              timing_confidence: step.timing_confidence || 'low',
            })),
          },
        },
      ],
    };

    // Generate cooking plan
    const plan = createCookingPlan(menuWithSteps, setup);

    // Generate briefing
    const briefing = await generateChefBriefing(plan);

    // Create cooking session
    const { data: session, error: sessionError } = await supabaseAdmin
      .from('cooking_sessions')
      .insert({
        menu_id: recipe_id, // Single recipe, so menu_id = recipe_id
        user_id: user.id,
        setup,
        plan,
        status: 'briefing',
        current_step_index: 0,
        version: 1,
      })
      .select('id')
      .single();

    if (sessionError || !session) {
      console.error('[cook/sessions] Session create error:', sessionError);
      return NextResponse.json(
        { error: 'Failed to create session' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      sessionId: session.id,
      plan,
      briefing,
    });
  } catch (error) {
    console.error('[cook/sessions] Unexpected error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
