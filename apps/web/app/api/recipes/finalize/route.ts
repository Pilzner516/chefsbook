import { NextRequest } from 'next/server';
import {
  supabaseAdmin,
  fetchRecipeCompleteness,
  logImportAttempt,
  applyCompletenessGate,
  applyAiVerdict,
  extractDomain,
  logAiCall,
} from '@chefsbook/db';
import { isActuallyARecipe, consumeLastUsage } from '@chefsbook/ai';

export async function POST(req: NextRequest) {
  try {
    const { recipeId, userId, url, source, isNewDiscovery } = await req.json();
    if (!recipeId) return Response.json({ error: 'recipeId required' }, { status: 400 });

    const { data: recipe } = await supabaseAdmin
      .from('recipes')
      .select('title, description, visibility, tags, user_id')
      .eq('id', recipeId)
      .single();
    if (!recipe) return Response.json({ error: 'recipe not found' }, { status: 404 });

    const completeness = await fetchRecipeCompleteness(recipeId);

    // Get user's default visibility preference (defaults to 'public' if not set)
    const { data: profile } = await supabaseAdmin
      .from('user_profiles')
      .select('default_visibility')
      .eq('id', recipe.user_id)
      .maybeSingle();
    const userDefaultVisibility = profile?.default_visibility ?? 'public';

    await applyCompletenessGate(recipeId, completeness, userDefaultVisibility);

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
      const t0 = Date.now();
      const result = await isActuallyARecipe({
        title: recipe.title,
        description: recipe.description ?? '',
        ingredients: (ingredients ?? []).map((i) => i.ingredient),
        steps: (steps ?? []).map((s) => s.instruction),
      });
      aiVerdict = result.verdict;
      aiReason = result.reason;
      await applyAiVerdict(recipeId, aiVerdict, aiReason, userDefaultVisibility);

      const u = consumeLastUsage();
      logAiCall({ userId, action: 'moderate_recipe', model: 'haiku', recipeId, durationMs: Date.now() - t0, tokensIn: u?.inputTokens, tokensOut: u?.outputTokens, success: true }).catch(() => {});
    }

    if (url) {
      const domain = extractDomain(url);
      await logImportAttempt({
        userId: userId ?? null,
        url,
        domain,
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
        isNewDiscovery: !!isNewDiscovery,
      });

      // Attribute + auto-promote successful unknown-site discoveries.
      if (isNewDiscovery && domain) {
        if (userId) {
          await supabaseAdmin
            .from('import_site_tracker')
            .update({ first_discovered_by: userId })
            .eq('domain', domain)
            .is('first_discovered_by', null);
          const { data: profile } = await supabaseAdmin
            .from('user_profiles')
            .select('sites_discovered_count')
            .eq('id', userId)
            .maybeSingle();
          await supabaseAdmin
            .from('user_profiles')
            .update({ sites_discovered_count: (profile?.sites_discovered_count ?? 0) + 1 })
            .eq('id', userId);
        }
        if (completeness.isComplete && aiVerdict === 'approved') {
          await supabaseAdmin
            .from('import_site_tracker')
            .update({ review_status: 'added_to_list', rating: 4, status: 'working' })
            .eq('domain', domain);
        }
      }
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
