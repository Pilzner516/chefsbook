import { createRecipe, updateRecipe, freezeUserRecipes } from '@chefsbook/db';
import type { RecipeWithDetails, ScannedRecipe, Recipe } from '@chefsbook/db';
import { moderateRecipe } from '@chefsbook/ai';
import type { RecipeModerationResult } from '@chefsbook/ai';

export type SaveResult = {
  recipe: RecipeWithDetails;
  moderation: RecipeModerationResult;
};

/**
 * Create recipe + run AI moderation. Returns the saved recipe + moderation result.
 * Moderation failures are swallowed — recipe is always saved.
 */
export async function createRecipeWithModeration(
  userId: string,
  recipe: ScannedRecipe & {
    image_url?: string | null; source_url?: string; cookbook_id?: string;
    page_number?: number; youtube_video_id?: string; channel_name?: string; video_only?: boolean;
  },
): Promise<SaveResult> {
  const created = await createRecipe(userId, recipe);

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
      const updates: Partial<Recipe> = {
        moderation_status: moderation.verdict === 'mild' ? 'flagged_mild' : 'flagged_serious',
        moderation_flag_reason: moderation.reason ?? null,
        moderation_flagged_at: new Date().toISOString(),
        visibility: 'private',
      };
      await updateRecipe(created.id, updates);

      if (moderation.verdict === 'serious') {
        await freezeUserRecipes(userId, moderation.reason ?? 'Serious recipe violation');
      }
    }
  } catch {
    // Moderation failure should not block recipe creation
  }

  return { recipe: created, moderation };
}
