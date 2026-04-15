import { NextRequest } from 'next/server';
import {
  supabase,
  supabaseAdmin,
  fetchRecipeCompleteness,
  applyCompletenessGate,
  applyAiVerdict,
  logImportAttempt,
  extractDomain,
} from '@chefsbook/db';
import { importFromUrl, stripHtml, extractJsonLdRecipe, checkJsonLdCompleteness, isActuallyARecipe } from '@chefsbook/ai';
import { fetchWithFallback } from '../../import/_utils';

/**
 * POST /api/recipes/refresh
 *
 * Body: { recipeId: string }
 *
 * Re-imports a recipe's source_url and merges into the existing row — only
 * fills fields that are currently empty, never overwrites user-entered data.
 * Returns `needsBrowserExtraction: true` if server-side fetch is blocked,
 * so the client can hand off to the Chrome extension.
 */
export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization') ?? '';
    if (!authHeader.startsWith('Bearer ')) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const token = authHeader.slice(7);
    const { data: { user } } = await supabase.auth.getUser(token);
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { recipeId } = await req.json();
    if (!recipeId) return Response.json({ error: 'recipeId required' }, { status: 400 });

    const { data: recipe } = await supabaseAdmin
      .from('recipes')
      .select('id, user_id, source_url, title, description, servings, prep_minutes, cook_minutes, cuisine, course, tags, visibility')
      .eq('id', recipeId)
      .single();
    if (!recipe) return Response.json({ error: 'recipe not found' }, { status: 404 });
    if (recipe.user_id !== user.id) {
      const { data: admin } = await supabaseAdmin.from('admin_users').select('role').eq('user_id', user.id).maybeSingle();
      if (!admin) return Response.json({ error: 'Forbidden' }, { status: 403 });
    }
    if (!recipe.source_url) {
      return Response.json({ error: 'Recipe has no source URL to refresh from' }, { status: 422 });
    }

    // 1. Fetch + extract
    let rawHtml = '';
    try {
      rawHtml = (await fetchWithFallback(recipe.source_url)).html;
    } catch (e: any) {
      return Response.json({
        error: String(e?.message ?? e),
        needsBrowserExtraction: true,
        sourceUrl: recipe.source_url,
        domain: extractDomain(recipe.source_url),
        message: 'This site blocks server imports. Install the ChefsBook browser extension and re-open this recipe to refresh.',
      }, { status: 206 });
    }

    const jsonLd = extractJsonLdRecipe(rawHtml);
    const { complete, available, missing } = checkJsonLdCompleteness(jsonLd);
    let fresh: any;
    if (complete && jsonLd) {
      fresh = jsonLd;
    } else {
      const text = stripHtml(rawHtml).slice(0, 25000);
      try {
        fresh = jsonLd
          ? await importFromUrl(text, recipe.source_url, {
              available,
              missing,
              jsonLdData: JSON.stringify(jsonLd, null, 2).slice(0, 3000),
            })
          : await importFromUrl(text, recipe.source_url);
        if (jsonLd?.ingredients?.length && available.includes('ingredients')) fresh.ingredients = jsonLd.ingredients;
        if (jsonLd?.steps?.length) fresh.steps = jsonLd.steps;
      } catch (e: any) {
        return Response.json({ error: `Extraction failed: ${e?.message ?? e}` }, { status: 500 });
      }
    }

    // 2. Merge — never overwrite existing complete fields
    const { data: existingIngredients } = await supabaseAdmin
      .from('recipe_ingredients')
      .select('id')
      .eq('recipe_id', recipeId);
    const { data: existingSteps } = await supabaseAdmin
      .from('recipe_steps')
      .select('id')
      .eq('recipe_id', recipeId);

    const update: Record<string, unknown> = { updated_at: new Date().toISOString() };
    let ingredientsAdded = 0;
    let stepsAdded = 0;

    if (!recipe.description && fresh.description) update.description = fresh.description;
    if (!recipe.servings && fresh.servings) update.servings = fresh.servings;
    if (!recipe.prep_minutes && fresh.prep_minutes) update.prep_minutes = fresh.prep_minutes;
    if (!recipe.cook_minutes && fresh.cook_minutes) update.cook_minutes = fresh.cook_minutes;
    if (!recipe.cuisine && fresh.cuisine) update.cuisine = fresh.cuisine;
    if (!recipe.course && fresh.course) update.course = fresh.course;
    if (fresh.tags?.length) {
      const merged = Array.from(new Set([...(recipe.tags ?? []), ...fresh.tags]));
      update.tags = merged;
    }

    if (Object.keys(update).length > 1) {
      await supabaseAdmin.from('recipes').update(update).eq('id', recipeId);
    }

    if (!existingIngredients?.length && fresh.ingredients?.length) {
      const rows = fresh.ingredients.map((ing: any, i: number) => ({
        recipe_id: recipeId,
        user_id: recipe.user_id,
        sort_order: i,
        quantity: ing.quantity ?? null,
        unit: ing.unit ?? null,
        ingredient: ing.ingredient ?? '',
        preparation: ing.preparation ?? null,
        optional: ing.optional ?? false,
        group_label: ing.group_label ?? null,
      }));
      await supabaseAdmin.from('recipe_ingredients').insert(rows);
      ingredientsAdded = rows.length;
    }

    if (!existingSteps?.length && fresh.steps?.length) {
      const rows = fresh.steps.map((s: any, i: number) => ({
        recipe_id: recipeId,
        user_id: recipe.user_id,
        step_number: s.step_number ?? i + 1,
        instruction: s.instruction ?? '',
        timer_minutes: s.timer_minutes ?? null,
        group_label: s.group_label ?? null,
      }));
      await supabaseAdmin.from('recipe_steps').insert(rows);
      stepsAdded = rows.length;
    }

    // 3. Re-run gate
    const completeness = await fetchRecipeCompleteness(recipeId);
    await applyCompletenessGate(recipeId, completeness, recipe.visibility);

    let aiVerdict: 'approved' | 'flagged' | 'not_a_recipe' = 'approved';
    if (completeness.isComplete) {
      try {
        const { data: ing } = await supabaseAdmin.from('recipe_ingredients').select('ingredient').eq('recipe_id', recipeId).limit(3);
        const { data: st } = await supabaseAdmin.from('recipe_steps').select('instruction').eq('recipe_id', recipeId).order('step_number').limit(1);
        const result = await isActuallyARecipe({
          title: recipe.title,
          description: (update.description as string) ?? recipe.description ?? '',
          ingredients: (ing ?? []).map((i: any) => i.ingredient),
          steps: (st ?? []).map((s: any) => s.instruction),
        });
        aiVerdict = result.verdict;
        await applyAiVerdict(recipeId, aiVerdict, result.reason, recipe.visibility);
      } catch {}
    }

    await logImportAttempt({
      userId: user.id,
      url: recipe.source_url,
      domain: extractDomain(recipe.source_url),
      success: completeness.isComplete && aiVerdict === 'approved',
      recipeId,
      completeness,
      aiVerdict: !completeness.isComplete
        ? 'incomplete'
        : aiVerdict === 'not_a_recipe'
          ? 'not_a_recipe'
          : aiVerdict === 'flagged'
            ? 'flagged'
            : 'complete',
    }).catch(() => {});

    return Response.json({
      ok: true,
      ingredientsAdded,
      stepsAdded,
      isComplete: completeness.isComplete,
      missingFields: completeness.missingFields,
      aiVerdict,
    });
  } catch (e: any) {
    return Response.json({ error: String(e?.message ?? e) }, { status: 500 });
  }
}
