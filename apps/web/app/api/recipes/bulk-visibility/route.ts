import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@chefsbook/db';
import { isRecipeComplete } from '@/lib/recipeCompleteness';

export async function POST(req: NextRequest) {
  try {
    // Get auth token from header (supabase.auth.getSession() doesn't work in API routes)
    const authHeader = req.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.slice(7);
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);

    if (authError || !user) {
      console.log('[bulk-visibility] Auth error:', authError);
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    console.log('[bulk-visibility] User ID from token:', user.id);

    const body = await req.json();
    const { ids, visibility, all } = body as { ids?: string[]; visibility: 'public' | 'private'; all?: boolean };

    if (visibility !== 'public' && visibility !== 'private') {
      return NextResponse.json({ error: 'Invalid visibility value' }, { status: 400 });
    }

    if (all) {
      // Update ALL user's recipes to the specified visibility
      const { error, count } = await supabaseAdmin
        .from('recipes')
        .update({ visibility })
        .eq('user_id', user.id);

      if (error) {
        console.error('Bulk visibility update error:', error);
        return NextResponse.json({ error: 'Failed to update recipes' }, { status: 500 });
      }

      return NextResponse.json({ success: true, updated: count ?? 0 });
    } else {
      // Update specific recipes by ID
      if (!ids || !Array.isArray(ids) || ids.length === 0) {
        return NextResponse.json({ error: 'No recipe IDs provided' }, { status: 400 });
      }

      console.log('[bulk-visibility] Looking for recipes with IDs:', ids, 'owned by user:', user.id);

      // Fetch full recipes with ownership check + ingredients + steps (for enforcement)
      const { data: ownedRecipes, error: queryError } = await supabaseAdmin
        .from('recipes')
        .select(`
          id,
          title,
          description,
          moderation_status,
          copyright_review_pending,
          ai_recipe_verdict,
          recipe_ingredients:recipe_ingredients(quantity, ingredient),
          recipe_steps:recipe_steps(id)
        `)
        .eq('user_id', user.id)
        .in('id', ids);

      console.log('[bulk-visibility] Query result:', { found: ownedRecipes?.length ?? 0, error: queryError });

      // Debug: check what user_id these recipes actually have
      if (!ownedRecipes || ownedRecipes.length === 0) {
        const { data: debugRecipes } = await supabaseAdmin
          .from('recipes')
          .select('id, user_id, title')
          .in('id', ids);
        console.log('[bulk-visibility] DEBUG - Actual recipe owners:', debugRecipes?.map(r => ({ id: r.id, user_id: r.user_id, title: r.title })));
      }

      // Count how many weren't owned (for reporting)
      const notOwnedCount = ids.length - (ownedRecipes?.length ?? 0);

      if (!ownedRecipes || ownedRecipes.length === 0) {
        return NextResponse.json({ error: 'None of the selected recipes belong to you' }, { status: 403 });
      }

      // If making public, filter out incomplete and flagged recipes
      let validIds = ids;
      let skippedCount = 0;

      if (visibility === 'public') {
        validIds = ownedRecipes
          .filter((recipe: any) => {
            // Skip if flagged/under review
            const isUnderReview = recipe.copyright_review_pending === true ||
              (recipe.moderation_status && recipe.moderation_status !== 'clean') ||
              recipe.ai_recipe_verdict === 'flagged';
            if (isUnderReview) return false;

            // Skip if incomplete
            const complete = isRecipeComplete({
              title: recipe.title,
              description: recipe.description,
              ingredients: recipe.recipe_ingredients || [],
              steps: recipe.recipe_steps || []
            });
            return complete;
          })
          .map((r: any) => r.id);

        skippedCount = ids.length - validIds.length;
      }

      // Update only valid recipes
      if (validIds.length > 0) {
        const { error } = await supabaseAdmin
          .from('recipes')
          .update({ visibility })
          .eq('user_id', user.id)
          .in('id', validIds);

        if (error) {
          console.error('Bulk visibility update error:', error);
          return NextResponse.json({ error: 'Failed to update recipes' }, { status: 500 });
        }
      }

      return NextResponse.json({
        success: true,
        updated: validIds.length,
        skipped: skippedCount,
        notOwned: notOwnedCount
      });
    }
  } catch (error: any) {
    console.error('Bulk visibility route error:', error);
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}
