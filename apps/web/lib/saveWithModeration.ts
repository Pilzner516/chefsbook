import { createRecipe, updateRecipe, freezeUserRecipes, supabase, supabaseAdmin } from '@chefsbook/db';
import type { RecipeWithDetails, ScannedRecipe, Recipe } from '@chefsbook/db';
import { moderateRecipe, rewriteRecipeSteps } from '@chefsbook/ai';
import type { RecipeModerationResult } from '@chefsbook/ai';

export type SaveResult = {
  recipe: RecipeWithDetails;
  moderation: RecipeModerationResult;
  completeness?: {
    isComplete: boolean;
    missingFields: string[];
    aiVerdict: 'approved' | 'flagged' | 'not_a_recipe';
    aiReason: string;
    needsReview: boolean;
  };
};

async function finalizeRecipe(
  recipeId: string,
  userId: string,
  sourceUrl: string | undefined,
  source: string,
  isNewDiscovery?: boolean,
) {
  try {
    const res = await fetch('/api/recipes/finalize', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ recipeId, userId, url: sourceUrl, source, isNewDiscovery }),
    });
    if (!res.ok) return undefined;
    return (await res.json()) as SaveResult['completeness'];
  } catch {
    return undefined;
  }
}

/**
 * Create recipe + run AI moderation. Returns the saved recipe + moderation result.
 * Moderation failures are swallowed — recipe is always saved.
 */
export async function createRecipeWithModeration(
  userId: string,
  recipe: ScannedRecipe & {
    image_url?: string | null; source_url?: string; cookbook_id?: string;
    page_number?: number; youtube_video_id?: string; channel_name?: string; video_only?: boolean;
    is_new_discovery?: boolean;
    source_image_url?: string | null; source_image_description?: string | null;
    source_language?: string | null; translated_from?: string | null;
  },
): Promise<SaveResult> {
  const created = await createRecipe(userId, recipe);

  // Fire-and-forget: translate recipe title into 4 languages via server-side route
  if (recipe.title) {
    supabase.auth.getSession().then(({ data }) => {
      const token = data.session?.access_token;
      if (!token) return;
      fetch('/api/recipes/translate-title', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ recipeId: created.id, title: recipe.title }),
      }).catch(() => {});
    }).catch(() => {});
  }

  let moderation: RecipeModerationResult = { verdict: 'clean' };
  try {
    moderation = await moderateRecipe({
      title: recipe.title,
      description: recipe.description,
      ingredients: recipe.ingredients?.map((i) => ({ ingredient: i.ingredient })),
      steps: recipe.steps?.map((s) => ({ instruction: s.instruction })),
      notes: recipe.notes,
    });

    if (moderation.verdict !== 'clean') {
      // Check if AI auto-moderation is enabled
      let aiAutoEnabled = true;
      try {
        const { data: setting } = await supabaseAdmin
          .from('system_settings')
          .select('value')
          .eq('key', 'ai_auto_moderation_enabled')
          .single();
        aiAutoEnabled = setting?.value === 'true';
      } catch { /* default to enabled if setting missing */ }

      // Always record the moderation status
      const updates: Partial<Recipe> = {
        moderation_status: moderation.verdict === 'mild' ? 'flagged_mild' : 'flagged_serious',
        moderation_flag_reason: moderation.reason ?? null,
        moderation_flagged_at: new Date().toISOString(),
      };

      // Auto-act ONLY on serious + toggle ON. Mild = flag only, never auto-hide.
      if (moderation.verdict === 'serious' && aiAutoEnabled) {
        updates.visibility = 'private';
        await updateRecipe(created.id, updates);
        await freezeUserRecipes(userId, moderation.reason ?? 'Serious recipe violation');
      } else {
        // Flag only — no visibility change, no freeze
        await updateRecipe(created.id, updates);
      }
    }
  } catch {
    // Moderation failure should not block recipe creation
  }

  // Fire-and-forget: rewrite imported steps to avoid verbatim copying (URL/extension imports only)
  const isUrlImport = recipe.source_url && ['url', 'extension'].includes(recipe.source_type ?? '');
  if (isUrlImport && recipe.steps && recipe.steps.length > 0) {
    rewriteRecipeSteps(
      recipe.steps.map((s, i) => ({ step_number: i + 1, instruction: s.instruction })),
      recipe.title,
      recipe.cuisine,
    )
      .then(async (rewritten) => {
        // Update steps in DB using admin client (bypasses RLS)
        await supabaseAdmin.from('recipe_steps').delete().eq('recipe_id', created.id);
        if (rewritten.length > 0) {
          await supabaseAdmin.from('recipe_steps').insert(
            rewritten.map((s) => ({
              recipe_id: created.id,
              user_id: userId,
              step_number: s.step_number,
              instruction: s.instruction,
              timer_minutes: s.timer_minutes ?? null,
              group_label: s.group_label ?? null,
            })),
          );
        }
        await supabaseAdmin
          .from('recipes')
          .update({
            steps_rewritten: true,
            steps_rewritten_at: new Date().toISOString(),
          })
          .eq('id', created.id);
      })
      .catch(() => {
        // Silent fail — original steps kept if rewrite fails
      });
  }

  const completeness = await finalizeRecipe(
    created.id,
    userId,
    recipe.source_url,
    recipe.source_type ?? 'manual',
    recipe.is_new_discovery,
  );

  return { recipe: created, moderation, completeness };
}
