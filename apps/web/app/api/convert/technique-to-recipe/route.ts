import { NextRequest, NextResponse } from 'next/server';
import { supabase, supabaseAdmin, fetchRecipeCompleteness } from '@chefsbook/db';

/**
 * POST /api/convert/technique-to-recipe
 * Converts a technique to a recipe. User must own the technique.
 * Copies: title, description, process_steps→recipe_steps, tools_and_equipment→ingredients,
 *         tags, image_url, youtube_video_id, source_url
 * Original technique is deleted after successful conversion.
 */
export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization') ?? '';
    if (!authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }
    const token = authHeader.slice(7);
    const { data: { user } } = await supabase.auth.getUser(token);
    if (!user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const body = await req.json();
    const techniqueId = body.techniqueId;
    if (!techniqueId) {
      return NextResponse.json({ error: 'Missing techniqueId' }, { status: 400 });
    }

    // Fetch technique with ownership check
    const { data: technique, error: techErr } = await supabaseAdmin
      .from('techniques')
      .select('*')
      .eq('id', techniqueId)
      .single();

    if (techErr || !technique) {
      return NextResponse.json({ error: 'Technique not found' }, { status: 404 });
    }

    if (technique.user_id !== user.id) {
      return NextResponse.json({ error: 'Not authorized' }, { status: 403 });
    }

    // Create recipe
    const { data: recipe, error: createErr } = await supabaseAdmin
      .from('recipes')
      .insert({
        user_id: user.id,
        title: technique.title,
        description: technique.description,
        notes: null,
        tags: technique.tags ?? [],
        image_url: technique.image_url ?? null,
        youtube_video_id: technique.youtube_video_id ?? null,
        source_url: technique.source_url ?? null,
        source_type: technique.source_type ?? 'manual',
        visibility: 'private',
        is_complete: false,
        servings: 4,
      })
      .select()
      .single();

    if (createErr || !recipe) {
      console.error('[convert/technique-to-recipe] Create failed:', createErr);
      return NextResponse.json(
        { error: 'Failed to create recipe' },
        { status: 500 }
      );
    }

    // Convert process_steps JSONB to recipe_steps rows
    const processSteps = (technique.process_steps ?? []) as Array<{
      step_number: number;
      instruction: string;
    }>;
    if (processSteps.length > 0) {
      const stepRows = processSteps.map((s) => ({
        recipe_id: recipe.id,
        user_id: user.id,
        step_number: s.step_number,
        instruction: s.instruction,
      }));
      const { error: stepsErr } = await supabaseAdmin
        .from('recipe_steps')
        .insert(stepRows);
      if (stepsErr) {
        console.error('[convert/technique-to-recipe] Steps insert failed:', stepsErr);
        // Rollback: delete recipe
        await supabaseAdmin.from('recipes').delete().eq('id', recipe.id);
        return NextResponse.json(
          { error: 'Failed to create recipe steps' },
          { status: 500 }
        );
      }
    }

    // Convert tools_and_equipment TEXT[] to recipe_ingredients rows
    const tools = (technique.tools_and_equipment ?? []) as string[];
    if (tools.length > 0) {
      const ingredientRows = tools.map((tool, idx) => ({
        recipe_id: recipe.id,
        user_id: user.id,
        sort_order: idx,
        ingredient: tool,
        quantity: null,
        unit: null,
        preparation: null,
        optional: false,
      }));
      const { error: ingredientsErr } = await supabaseAdmin
        .from('recipe_ingredients')
        .insert(ingredientRows);
      if (ingredientsErr) {
        console.error('[convert/technique-to-recipe] Ingredients insert failed:', ingredientsErr);
        // Rollback: delete recipe (cascades steps)
        await supabaseAdmin.from('recipes').delete().eq('id', recipe.id);
        return NextResponse.json(
          { error: 'Failed to create recipe ingredients' },
          { status: 500 }
        );
      }
    }

    // Run completeness check on the new recipe
    const completeness = await fetchRecipeCompleteness(recipe.id);
    await supabaseAdmin
      .from('recipes')
      .update({
        is_complete: completeness.isComplete,
        missing_fields: completeness.missingFields,
        completeness_checked_at: new Date().toISOString(),
      })
      .eq('id', recipe.id);

    // Delete original technique
    const { error: deleteErr } = await supabaseAdmin
      .from('techniques')
      .delete()
      .eq('id', techniqueId);

    if (deleteErr) {
      // Rollback: delete the newly created recipe
      await supabaseAdmin.from('recipes').delete().eq('id', recipe.id);
      console.error('[convert/technique-to-recipe] Delete failed:', deleteErr);
      return NextResponse.json(
        { error: 'Failed to delete original technique' },
        { status: 500 }
      );
    }

    return NextResponse.json({ recipeId: recipe.id });
  } catch (e: any) {
    console.error('[convert/technique-to-recipe] Error:', e);
    return NextResponse.json(
      { error: e?.message ?? 'Conversion failed' },
      { status: 500 }
    );
  }
}
