import { supabase } from '../client';
import type { Recipe, RecipeIngredient, RecipeStep, RecipeWithDetails, ScannedRecipe } from '../types';

export async function getRecipe(id: string): Promise<RecipeWithDetails | null> {
  const { data: recipe } = await supabase
    .from('recipes')
    .select('*')
    .eq('id', id)
    .single();

  if (!recipe) return null;

  const [{ data: ingredients }, { data: steps }] = await Promise.all([
    supabase
      .from('recipe_ingredients')
      .select('*')
      .eq('recipe_id', id)
      .order('sort_order'),
    supabase
      .from('recipe_steps')
      .select('*')
      .eq('recipe_id', id)
      .order('step_number'),
  ]);

  return {
    ...recipe,
    ingredients: (ingredients ?? []) as RecipeIngredient[],
    steps: (steps ?? []) as RecipeStep[],
  } as RecipeWithDetails;
}

export async function getRecipeByShareToken(token: string): Promise<RecipeWithDetails | null> {
  const { data: recipe } = await supabase
    .from('recipes')
    .select('*')
    .eq('share_token', token)
    .single();

  if (!recipe) return null;

  const [{ data: ingredients }, { data: steps }] = await Promise.all([
    supabase
      .from('recipe_ingredients')
      .select('*')
      .eq('recipe_id', recipe.id)
      .order('sort_order'),
    supabase
      .from('recipe_steps')
      .select('*')
      .eq('recipe_id', recipe.id)
      .order('step_number'),
  ]);

  return {
    ...recipe,
    ingredients: (ingredients ?? []) as RecipeIngredient[],
    steps: (steps ?? []) as RecipeStep[],
  } as RecipeWithDetails;
}

export async function listRecipes(params?: {
  userId?: string;
  search?: string;
  cuisine?: string;
  course?: string;
  maxTime?: number;
  tags?: string[];
  sourceType?: string;
  includePublic?: boolean;
  favouritesOnly?: boolean;
  limit?: number;
  offset?: number;
}): Promise<Recipe[]> {
  // Use server-side search_recipes function for trgm-powered search
  if (params?.userId && (params?.search || params?.sourceType || params?.tags?.length || params?.includePublic || params?.cuisine || params?.course || params?.maxTime)) {
    const { data } = await supabase.rpc('search_recipes', {
      p_user_id: params.userId,
      p_query: params.search ?? null,
      p_cuisine: params.cuisine ?? null,
      p_course: params.course ?? null,
      p_max_time: params.maxTime ?? null,
      p_source_type: params.sourceType ?? null,
      p_tags: params.tags ?? null,
      p_include_public: params.includePublic ?? false,
      p_limit: params.limit ?? 50,
      p_offset: params.offset ?? 0,
    });
    return (data ?? []) as Recipe[];
  }

  // Fallback to standard query when no search term
  let query = supabase.from('recipes').select('*');

  if (params?.userId) query = query.eq('user_id', params.userId);
  if (params?.cuisine) query = query.eq('cuisine', params.cuisine);
  if (params?.course) query = query.eq('course', params.course);
  if (params?.maxTime) query = query.lte('total_minutes', params.maxTime);
  if (params?.tags?.length) query = query.overlaps('tags', params.tags);
  if (params?.favouritesOnly) query = query.eq('is_favourite', true);

  query = query
    .order('updated_at', { ascending: false })
    .range(params?.offset ?? 0, (params?.offset ?? 0) + (params?.limit ?? 50) - 1);

  const { data } = await query;
  const owned = (data ?? []) as Recipe[];

  // Also fetch saved (bookmarked) recipes for this user
  if (params?.userId && !params?.favouritesOnly) {
    const { data: savedRows } = await supabase
      .from('recipe_saves')
      .select('recipe_id')
      .eq('user_id', params.userId);
    if (savedRows && savedRows.length > 0) {
      const savedIds = savedRows.map((r: any) => r.recipe_id);
      const ownedIds = new Set(owned.map((r) => r.id));
      const missingIds = savedIds.filter((id: string) => !ownedIds.has(id));
      if (missingIds.length > 0) {
        const { data: savedRecipes } = await supabase
          .from('recipes')
          .select('*')
          .in('id', missingIds);
        if (savedRecipes) {
          return [...owned, ...(savedRecipes as Recipe[])];
        }
      }
    }
  }

  return owned;
}

export async function listPublicRecipes(params?: {
  search?: string;
  cuisine?: string;
  course?: string;
  limit?: number;
  offset?: number;
}): Promise<Recipe[]> {
  let query = supabase
    .from('recipes')
    .select('*')
    .in('visibility', ['public', 'shared_link']);

  if (params?.search) query = query.ilike('title', `%${params.search}%`);
  if (params?.cuisine) query = query.eq('cuisine', params.cuisine);
  if (params?.course) query = query.eq('course', params.course);

  query = query
    .order('created_at', { ascending: false })
    .range(params?.offset ?? 0, (params?.offset ?? 0) + (params?.limit ?? 50) - 1);

  const { data } = await query;
  return (data ?? []) as Recipe[];
}

export async function createRecipe(
  userId: string,
  recipe: ScannedRecipe & {
    image_url?: string | null; source_url?: string; cookbook_id?: string; page_number?: number;
    youtube_video_id?: string; channel_name?: string; video_only?: boolean;
    source_image_url?: string | null; source_image_description?: string | null;
    source_language?: string | null; translated_from?: string | null;
  },
): Promise<RecipeWithDetails> {
  const { data: newRecipe, error } = await supabase
    .from('recipes')
    .insert({
      user_id: userId,
      title: recipe.title,
      description: recipe.description,
      servings: recipe.servings ?? 4,
      prep_minutes: recipe.prep_minutes,
      cook_minutes: recipe.cook_minutes,
      cuisine: recipe.cuisine,
      course: recipe.course,
      source_type: recipe.source_type,
      source_url: recipe.source_url,
      // Never store external image URLs (copyright risk) — only Supabase storage URLs
      image_url: recipe.image_url && (
        recipe.image_url.includes('100.110.47.62') ||
        recipe.image_url.includes('chefsbk.app') ||
        recipe.image_url.includes('supabase') ||
        recipe.image_url.includes('localhost')
      ) ? recipe.image_url : null,
      // Source image reference — used by levels 1-2 faithful image generation
      source_image_url: recipe.source_image_url ?? null,
      source_image_description: recipe.source_image_description ?? null,
      source_language: recipe.source_language ?? null,
      translated_from: recipe.translated_from ?? null,
      cookbook_id: recipe.cookbook_id,
      page_number: recipe.page_number,
      notes: recipe.notes,
      // tags from Claude extraction (JSON-LD fast path leaves this undefined;
      // saveWithModeration fires a fire-and-forget auto-tag post-insert if empty)
      tags: recipe.tags ?? [],
      youtube_video_id: recipe.youtube_video_id ?? null,
      channel_name: recipe.channel_name ?? null,
      video_only: recipe.video_only ?? false,
    })
    .select()
    .single();

  if (error || !newRecipe) throw error ?? new Error('Failed to create recipe');

  const ingredients = recipe.ingredients.map((ing, i) => ({
    recipe_id: newRecipe.id,
    user_id: userId,
    sort_order: i,
    quantity: ing.quantity,
    unit: ing.unit,
    ingredient: ing.ingredient,
    preparation: ing.preparation,
    optional: ing.optional,
    group_label: ing.group_label,
  }));

  const steps = recipe.steps.map((step) => ({
    recipe_id: newRecipe.id,
    user_id: userId,
    step_number: step.step_number,
    instruction: step.instruction,
    timer_minutes: step.timer_minutes,
    group_label: step.group_label,
    timestamp_seconds: (step as any).timestamp_seconds ?? null,
  }));

  const [{ data: savedIngredients }, { data: savedSteps }] = await Promise.all([
    ingredients.length
      ? supabase.from('recipe_ingredients').insert(ingredients).select()
      : { data: [] },
    steps.length
      ? supabase.from('recipe_steps').insert(steps).select()
      : { data: [] },
  ]);

  return {
    ...(newRecipe as Recipe),
    ingredients: (savedIngredients ?? []) as RecipeIngredient[],
    steps: (savedSteps ?? []) as RecipeStep[],
  };
}

export async function updateRecipe(
  id: string,
  updates: Partial<Omit<Recipe, 'id' | 'user_id' | 'created_at' | 'updated_at' | 'total_minutes' | 'share_token'>>,
): Promise<Recipe> {
  // Strip undefined values to avoid sending non-existent columns
  const cleaned = Object.fromEntries(
    Object.entries(updates).filter(([, v]) => v !== undefined),
  );
  const { data, error } = await supabase
    .from('recipes')
    .update(cleaned)
    .eq('id', id)
    .select()
    .single();

  if (error || !data) throw error ?? new Error('Failed to update recipe');
  return data as Recipe;
}

export async function replaceIngredients(
  recipeId: string,
  userId: string,
  ingredients: { quantity: number | null; unit: string | null; ingredient: string; preparation: string | null; optional: boolean; group_label: string | null }[],
): Promise<RecipeIngredient[]> {
  await supabase.from('recipe_ingredients').delete().eq('recipe_id', recipeId);
  if (ingredients.length === 0) return [];
  const rows = ingredients.map((ing, i) => ({
    recipe_id: recipeId,
    user_id: userId,
    sort_order: i,
    quantity: ing.quantity,
    unit: ing.unit,
    ingredient: ing.ingredient,
    preparation: ing.preparation,
    optional: ing.optional,
    group_label: ing.group_label,
  }));
  const { data } = await supabase.from('recipe_ingredients').insert(rows).select();
  // Invalidate translation cache
  await supabase.from('recipe_translations').delete().eq('recipe_id', recipeId);
  return (data ?? []) as RecipeIngredient[];
}

export async function replaceSteps(
  recipeId: string,
  userId: string,
  steps: { step_number: number; instruction: string; timer_minutes: number | null; group_label: string | null }[],
): Promise<RecipeStep[]> {
  await supabase.from('recipe_steps').delete().eq('recipe_id', recipeId);
  if (steps.length === 0) return [];
  const rows = steps.map((step) => ({
    recipe_id: recipeId,
    user_id: userId,
    step_number: step.step_number,
    instruction: step.instruction,
    timer_minutes: step.timer_minutes,
    group_label: step.group_label,
  }));
  const { data } = await supabase.from('recipe_steps').insert(rows).select();
  // Invalidate translation cache
  await supabase.from('recipe_translations').delete().eq('recipe_id', recipeId);
  return (data ?? []) as RecipeStep[];
}

export async function deleteRecipe(id: string): Promise<void> {
  const { error } = await supabase.from('recipes').delete().eq('id', id);
  if (error) throw error;
}

export async function toggleFavourite(id: string, isFavourite: boolean): Promise<void> {
  await supabase.from('recipes').update({ is_favourite: isFavourite }).eq('id', id);
}

export async function saveRecipe(recipeId: string, userId: string): Promise<void> {
  await supabase.from('recipe_saves').upsert({ recipe_id: recipeId, user_id: userId }, { onConflict: 'recipe_id,user_id' });
}

export async function unsaveRecipe(recipeId: string, userId: string): Promise<void> {
  await supabase.from('recipe_saves').delete().eq('recipe_id', recipeId).eq('user_id', userId);
}

export async function isRecipeSaved(recipeId: string, userId: string): Promise<boolean> {
  const { count } = await supabase.from('recipe_saves').select('*', { count: 'exact', head: true }).eq('recipe_id', recipeId).eq('user_id', userId);
  return (count ?? 0) > 0;
}

export async function cloneRecipe(
  sourceRecipeId: string,
  targetUserId: string,
  sharedByUsername?: string | null,
): Promise<string> {
  const { data, error } = await supabase.rpc('clone_recipe', {
    p_source_recipe_id: sourceRecipeId,
    p_target_user_id: targetUserId,
  });
  if (error) throw error;
  const newId = data as string;

  // Set shared_by if provided (from ?ref= param on share links)
  if (sharedByUsername) {
    const { data: sharerProfile } = await supabase
      .from('user_profiles')
      .select('id, username')
      .eq('username', sharedByUsername.toLowerCase())
      .single();
    if (sharerProfile) {
      await supabase.from('recipes').update({
        shared_by_id: sharerProfile.id,
        shared_by_username: sharerProfile.username,
      }).eq('id', newId);
    }
  }

  return newId;
}

export async function removeSharedBy(recipeId: string): Promise<void> {
  await supabase.from('recipes').update({
    shared_by_id: null,
    shared_by_username: null,
  }).eq('id', recipeId);
}

export async function updateRecipeMetadata(
  id: string,
  fields: {
    cuisine?: string | null;
    course?: string | null;
    tags?: string[];
    dietary_flags?: string[];
  },
): Promise<void> {
  // Strip undefined values so we only send fields that were explicitly provided
  const cleaned = Object.fromEntries(
    Object.entries(fields).filter(([, v]) => v !== undefined),
  );
  if (Object.keys(cleaned).length === 0) return;
  const { error } = await supabase.from('recipes').update(cleaned).eq('id', id);
  if (error) throw error;
}

export async function searchByIngredient(
  term: string,
  userId?: string,
): Promise<Recipe[]> {
  let query = supabase
    .from('recipe_ingredients')
    .select('recipe_id')
    .ilike('ingredient', `%${term}%`);

  const { data: matches } = await query;
  if (!matches || matches.length === 0) return [];

  const recipeIds = [...new Set(matches.map((m) => m.recipe_id))];

  let recipeQuery = supabase
    .from('recipes')
    .select('*')
    .in('id', recipeIds)
    .order('created_at', { ascending: false });

  if (userId) {
    recipeQuery = recipeQuery.eq('user_id', userId);
  }

  const { data } = await recipeQuery;
  return (data ?? []) as Recipe[];
}

export async function getPublicProfile(
  username: string,
): Promise<{ profile: any; recipes: Recipe[] } | null> {
  const { data: profile } = await supabase
    .from('user_profiles')
    .select('*')
    .eq('username', username)
    .single();

  if (!profile) return null;

  const { data: recipes } = await supabase
    .from('recipes')
    .select('*')
    .eq('user_id', profile.id)
    .in('visibility', ['public', 'shared_link'])
    .order('created_at', { ascending: false });

  return { profile, recipes: (recipes ?? []) as Recipe[] };
}

export async function getPublicFeed(params?: {
  limit?: number;
  offset?: number;
  cuisineFilter?: string;
}): Promise<(Recipe & { author_name: string; author_avatar: string | null })[]> {
  const { data, error } = await supabase.rpc('get_public_feed', {
    p_limit: params?.limit ?? 20,
    p_offset: params?.offset ?? 0,
    p_cuisine_filter: params?.cuisineFilter ?? null,
  });
  if (error) throw error;
  return (data ?? []) as (Recipe & { author_name: string; author_avatar: string | null })[];
}

// ── Recipe versioning ──

export async function getRecipeVersions(parentId: string): Promise<Recipe[]> {
  const { data, error } = await supabase
    .from('recipes')
    .select('*')
    .or(`id.eq.${parentId},parent_recipe_id.eq.${parentId}`)
    .order('version_number');
  if (error) throw error;
  return (data ?? []) as Recipe[];
}

export async function getVersionCount(parentId: string): Promise<number> {
  const { count, error } = await supabase
    .from('recipes')
    .select('*', { count: 'exact', head: true })
    .eq('parent_recipe_id', parentId);
  if (error) throw error;
  return (count ?? 0) + 1; // +1 for parent itself
}

export async function createRecipeVersion(
  userId: string,
  parentId: string,
  data: Partial<Recipe> & { title: string },
): Promise<Recipe> {
  // Count existing versions
  const versionCount = await getVersionCount(parentId);

  // Mark parent as is_parent
  await supabase.from('recipes').update({ is_parent: true }).eq('id', parentId);

  // Create child version
  const { data: created, error } = await supabase
    .from('recipes')
    .insert({
      ...data,
      user_id: userId,
      parent_recipe_id: parentId,
      version_number: versionCount + 1,
      is_parent: false,
    })
    .select()
    .single();
  if (error || !created) throw error ?? new Error('Failed to create version');
  return created as Recipe;
}

export async function freezeUserRecipes(userId: string, reason: string): Promise<void> {
  await supabase
    .from('user_profiles')
    .update({
      recipes_frozen: true,
      recipes_frozen_reason: reason,
      recipes_frozen_at: new Date().toISOString(),
    })
    .eq('id', userId);

  // Hide all their public recipes
  await supabase
    .from('recipes')
    .update({ visibility: 'private' })
    .eq('user_id', userId)
    .eq('visibility', 'public');
}

export async function unfreezeUserRecipes(userId: string): Promise<void> {
  await supabase
    .from('user_profiles')
    .update({
      recipes_frozen: false,
      recipes_frozen_reason: null,
      recipes_frozen_at: null,
    })
    .eq('id', userId);
}

export async function approveRecipeModeration(recipeId: string, reviewerId: string): Promise<void> {
  await supabase
    .from('recipes')
    .update({
      moderation_status: 'approved',
      moderation_reviewed_by: reviewerId,
      moderation_reviewed_at: new Date().toISOString(),
    })
    .eq('id', recipeId);
}

export async function rejectRecipeModeration(recipeId: string, reviewerId: string): Promise<void> {
  await supabase
    .from('recipes')
    .update({
      moderation_status: 'rejected',
      visibility: 'private',
      moderation_reviewed_by: reviewerId,
      moderation_reviewed_at: new Date().toISOString(),
    })
    .eq('id', recipeId);
}
