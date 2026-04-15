import { NextRequest } from 'next/server';
import {
  supabaseAdmin,
  fetchRecipeCompleteness,
  logImportAttempt,
  applyCompletenessGate,
  applyAiVerdict,
  extractDomain,
} from '@chefsbook/db';
import { isActuallyARecipe } from '@chefsbook/ai';

export async function POST(req: NextRequest) {
  try {
    const { recipeId, userId, url, source } = await req.json();
    if (!recipeId) return Response.json({ error: 'recipeId required' }, { status: 400 });

    const { data: recipe } = await supabaseAdmin
      .from('recipes')
      .select('title, description, visibility, tags')
      .eq('id', recipeId)
      .single();
    if (!recipe) return Response.json({ error: 'recipe not found' }, { status: 404 });

    const completeness = await fetchRecipeCompleteness(recipeId);
    const intendedVisibility = recipe.visibility;

    await applyCompletenessGate(recipeId, completeness, intendedVisibility);

    let aiVerdict: 'approved' | 'flagged' | 'not_a_recipe' = 'approved';
    let aiReason = '';
    if (completeness.isComplete) {
      const { data: ingredients } = await supabaseAdmin
        .from('recipe_ingredients')
        .select('ingredient')
        .eq('recipe_id', recipeId)
        .order('sort_order')
        .limit(3);
      const { data: steps } = await supabaseAdmin
        .from('recipe_steps')
        .select('instruction')
        .eq('recipe_id', recipeId)
        .order('step_number')
        .limit(1);
      const result = await isActuallyARecipe({
        title: recipe.title,
        description: recipe.description ?? '',
        ingredients: (ingredients ?? []).map((i) => i.ingredient),
        steps: (steps ?? []).map((s) => s.instruction),
      });
      aiVerdict = result.verdict;
      aiReason = result.reason;
      await applyAiVerdict(recipeId, aiVerdict, aiReason, intendedVisibility);
    }

    if (url) {
      await logImportAttempt({
        userId: userId ?? null,
        url,
        domain: extractDomain(url),
        success: completeness.isComplete && aiVerdict === 'approved',
        recipeId,
        failureReason: !completeness.isComplete
          ? completeness.missingFields.join(', ')
          : aiVerdict !== 'approved'
            ? aiReason
            : null,
        completeness,
        aiVerdict: !completeness.isComplete
          ? 'incomplete'
          : aiVerdict === 'not_a_recipe'
            ? 'not_a_recipe'
            : aiVerdict === 'flagged'
              ? 'flagged'
              : 'complete',
      });
    }

    return Response.json({
      isComplete: completeness.isComplete,
      missingFields: completeness.missingFields,
      aiVerdict,
      aiReason,
      needsReview: !completeness.isComplete || aiVerdict !== 'approved',
      source: source ?? null,
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'unknown error';
    return Response.json({ error: msg }, { status: 500 });
  }
}
