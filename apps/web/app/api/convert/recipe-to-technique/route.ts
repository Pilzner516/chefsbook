import { NextRequest, NextResponse } from 'next/server';
import { supabase, supabaseAdmin } from '@chefsbook/db';

/**
 * POST /api/convert/recipe-to-technique
 * Converts a recipe to a technique. User must own the recipe.
 * Copies: title, description, steps→process_steps, ingredients→tools_and_equipment,
 *         tags, image_url, youtube_video_id, source_url
 * Original recipe is deleted after successful conversion.
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
    const recipeId = body.recipeId;
    if (!recipeId) {
      return NextResponse.json({ error: 'Missing recipeId' }, { status: 400 });
    }

    // Fetch recipe with ownership check
    const { data: recipe, error: recipeErr } = await supabaseAdmin
      .from('recipes')
      .select('*')
      .eq('id', recipeId)
      .single();

    if (recipeErr || !recipe) {
      return NextResponse.json({ error: 'Recipe not found' }, { status: 404 });
    }

    if (recipe.user_id !== user.id) {
      return NextResponse.json({ error: 'Not authorized' }, { status: 403 });
    }

    // Fetch ingredients
    const { data: ingredients } = await supabaseAdmin
      .from('recipe_ingredients')
      .select('ingredient, quantity, unit, sort_order')
      .eq('recipe_id', recipeId)
      .order('sort_order');

    // Fetch steps
    const { data: steps } = await supabaseAdmin
      .from('recipe_steps')
      .select('step_number, instruction')
      .eq('recipe_id', recipeId)
      .order('step_number');

    // Fetch user photos (to get primary image URL)
    const { data: photos } = await supabaseAdmin
      .from('recipe_user_photos')
      .select('url, is_primary')
      .eq('recipe_id', recipeId)
      .order('sort_order');

    // Determine best image: primary photo > recipe.image_url
    const primaryPhoto = photos?.find((p) => p.is_primary);
    const imageUrl = primaryPhoto?.url ?? recipe.image_url ?? null;

    // Convert ingredients to tools_and_equipment (array of strings)
    const toolsAndEquipment = (ingredients ?? []).map((i) => {
      if (i.quantity && i.unit) {
        return `${i.quantity} ${i.unit} ${i.ingredient}`;
      } else if (i.quantity) {
        return `${i.quantity} ${i.ingredient}`;
      }
      return i.ingredient;
    });

    // Convert steps to process_steps JSONB
    const processSteps = (steps ?? []).map((s) => ({
      step_number: s.step_number,
      instruction: s.instruction,
      tip: null,
      common_mistake: null,
    }));

    // Create technique
    const { data: technique, error: createErr } = await supabaseAdmin
      .from('techniques')
      .insert({
        user_id: user.id,
        title: recipe.title,
        description: recipe.description,
        process_steps: processSteps,
        tools_and_equipment: toolsAndEquipment,
        tips: [],
        common_mistakes: [],
        difficulty: null,
        tags: recipe.tags ?? [],
        image_url: imageUrl,
        youtube_video_id: recipe.youtube_video_id ?? null,
        source_url: recipe.source_url ?? null,
        source_type: recipe.source_type ?? 'manual',
        visibility: 'private',
      })
      .select()
      .single();

    if (createErr || !technique) {
      console.error('[convert/recipe-to-technique] Create failed:', createErr);
      return NextResponse.json(
        { error: 'Failed to create technique' },
        { status: 500 }
      );
    }

    // Delete original recipe (cascades ingredients, steps, photos, etc.)
    const { error: deleteErr } = await supabaseAdmin
      .from('recipes')
      .delete()
      .eq('id', recipeId);

    if (deleteErr) {
      // Rollback: delete the newly created technique
      await supabaseAdmin.from('techniques').delete().eq('id', technique.id);
      console.error('[convert/recipe-to-technique] Delete failed:', deleteErr);
      return NextResponse.json(
        { error: 'Failed to delete original recipe' },
        { status: 500 }
      );
    }

    return NextResponse.json({ techniqueId: technique.id });
  } catch (e: any) {
    console.error('[convert/recipe-to-technique] Error:', e);
    return NextResponse.json(
      { error: e?.message ?? 'Conversion failed' },
      { status: 500 }
    );
  }
}
