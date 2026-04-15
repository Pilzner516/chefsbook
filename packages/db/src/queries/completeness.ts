import { supabaseAdmin } from '../client';

export interface CompletenessInput {
  title?: string | null;
  description?: string | null;
  ingredients?: Array<{
    quantity?: number | null;
    unit?: string | null;
    ingredient?: string | null;
    name?: string | null;
    amount?: number | null;
  }>;
  steps?: Array<{ instruction?: string | null }>;
  tags?: string[] | null;
}

export interface CompletenessResult {
  isComplete: boolean;
  missingFields: string[];
  ingredientCount: number;
  hasQuantities: boolean;
  stepCount: number;
}

export function checkRecipeCompleteness(recipe: CompletenessInput): CompletenessResult {
  const missing: string[] = [];

  if (!recipe.title || recipe.title.trim() === '') missing.push('title');
  if (!recipe.description || recipe.description.trim() === '') missing.push('description');

  const ingredients = recipe.ingredients ?? [];
  const ingredientsWithQty = ingredients.filter((i) => {
    const qty = i.quantity ?? i.amount;
    const name = i.ingredient ?? i.name;
    return qty !== null && qty !== undefined && qty > 0 && i.unit && name && name.trim() !== '';
  });

  if (ingredients.length < 2) missing.push('ingredients (minimum 2)');
  if (ingredientsWithQty.length < Math.min(2, ingredients.length)) {
    missing.push('ingredient quantities');
  }

  const steps = recipe.steps ?? [];
  if (steps.length < 1) missing.push('steps');

  const tags = recipe.tags ?? [];
  if (tags.length < 1) missing.push('tags');

  return {
    isComplete: missing.length === 0,
    missingFields: missing,
    ingredientCount: ingredients.length,
    hasQuantities: ingredientsWithQty.length >= 2,
    stepCount: steps.length,
  };
}

export async function fetchRecipeCompleteness(recipeId: string): Promise<CompletenessResult> {
  const { data: recipe } = await supabaseAdmin
    .from('recipes')
    .select('title, description, tags')
    .eq('id', recipeId)
    .single();
  const { data: ingredients } = await supabaseAdmin
    .from('recipe_ingredients')
    .select('quantity, unit, ingredient')
    .eq('recipe_id', recipeId);
  const { data: steps } = await supabaseAdmin
    .from('recipe_steps')
    .select('instruction')
    .eq('recipe_id', recipeId);
  return checkRecipeCompleteness({
    title: recipe?.title,
    description: recipe?.description,
    tags: recipe?.tags,
    ingredients: ingredients ?? [],
    steps: steps ?? [],
  });
}

export interface ImportAttemptLog {
  userId: string | null;
  url: string;
  domain: string;
  success: boolean;
  recipeId?: string | null;
  failureReason?: string | null;
  completeness?: CompletenessResult | null;
  aiVerdict?: 'complete' | 'incomplete' | 'not_a_recipe' | 'flagged' | null;
}

export function extractDomain(url: string): string {
  try {
    const u = new URL(url);
    return u.hostname.replace(/^www\./, '').toLowerCase();
  } catch {
    return '';
  }
}

export async function logImportAttempt(attempt: ImportAttemptLog): Promise<void> {
  const c = attempt.completeness;
  await supabaseAdmin.from('import_attempts').insert({
    user_id: attempt.userId,
    url: attempt.url,
    domain: attempt.domain,
    success: attempt.success,
    recipe_id: attempt.recipeId ?? null,
    failure_reason: attempt.failureReason ?? null,
    missing_title: c?.missingFields.includes('title') ?? false,
    missing_description: c?.missingFields.includes('description') ?? false,
    missing_ingredients: c?.missingFields.some((f) => f.includes('ingredient')) ?? false,
    missing_amounts: c?.missingFields.includes('ingredient quantities') ?? false,
    missing_steps: c?.missingFields.includes('steps') ?? false,
    ingredient_count: c?.ingredientCount ?? 0,
    step_count: c?.stepCount ?? 0,
    ai_completeness_verdict: attempt.aiVerdict ?? null,
  });

  await updateSiteTrackerFromAttempt(attempt.domain, attempt.success, c ?? null, attempt.url);
}

async function updateSiteTrackerFromAttempt(
  domain: string,
  success: boolean,
  completeness: CompletenessResult | null,
  failingUrl: string
): Promise<void> {
  if (!domain) return;

  const { data: existing } = await supabaseAdmin
    .from('import_site_tracker')
    .select('*')
    .eq('domain', domain)
    .maybeSingle();

  const totalAttempts = (existing?.total_attempts ?? 0) + 1;
  const successfulAttempts = (existing?.successful_attempts ?? 0) + (success ? 1 : 0);
  const failureTaxonomy: Record<string, number> = { ...(existing?.failure_taxonomy ?? {}) };
  let sampleFailing: string[] = existing?.sample_failing_urls ?? [];

  if (!success && completeness) {
    for (const f of completeness.missingFields) {
      const key = f.includes('ingredient quantit')
        ? 'missing_amounts'
        : f.includes('ingredient')
          ? 'missing_ingredients'
          : `missing_${f.split(' ')[0]}`;
      failureTaxonomy[key] = (failureTaxonomy[key] ?? 0) + 1;
    }
  }

  if (!success) {
    sampleFailing = [failingUrl, ...sampleFailing.filter((u) => u !== failingUrl)].slice(0, 5);
  }

  const successRate = totalAttempts > 0 ? successfulAttempts / totalAttempts : 0;
  const status = successRate >= 0.8 ? 'working' : successRate >= 0.4 ? 'partial' : 'broken';

  if (existing) {
    await supabaseAdmin
      .from('import_site_tracker')
      .update({
        total_attempts: totalAttempts,
        successful_attempts: successfulAttempts,
        failure_taxonomy: failureTaxonomy,
        sample_failing_urls: sampleFailing,
        status,
        last_attempt_at: new Date().toISOString(),
      })
      .eq('domain', domain);
  } else {
    await supabaseAdmin.from('import_site_tracker').insert({
      domain,
      total_attempts: totalAttempts,
      successful_attempts: successfulAttempts,
      failure_taxonomy: failureTaxonomy,
      sample_failing_urls: sampleFailing,
      status,
      last_attempt_at: new Date().toISOString(),
    });
  }
}

export async function applyCompletenessGate(
  recipeId: string,
  completeness: CompletenessResult,
  currentVisibility?: string
): Promise<void> {
  const update: Record<string, unknown> = {
    is_complete: completeness.isComplete,
    missing_fields: completeness.missingFields,
    completeness_checked_at: new Date().toISOString(),
  };
  if (!completeness.isComplete) {
    update.visibility = 'private';
  } else if (currentVisibility) {
    update.visibility = currentVisibility;
  }
  await supabaseAdmin.from('recipes').update(update).eq('id', recipeId);
}

export async function applyAiVerdict(
  recipeId: string,
  verdict: 'approved' | 'flagged' | 'not_a_recipe',
  reason: string,
  intendedVisibility?: string
): Promise<void> {
  await supabaseAdmin
    .from('recipes')
    .update({
      ai_recipe_verdict: verdict,
      ai_verdict_reason: reason,
      ai_verdict_at: new Date().toISOString(),
      visibility: verdict === 'approved' ? (intendedVisibility ?? 'public') : 'private',
    })
    .eq('id', recipeId);
}

export async function getSiteBlockStatus(domain: string): Promise<{
  is_blocked: boolean;
  block_reason: string | null;
  rating: number | null;
  status: string | null;
} | null> {
  if (!domain) return null;
  const { data } = await supabaseAdmin
    .from('import_site_tracker')
    .select('is_blocked, block_reason, rating, status')
    .eq('domain', domain)
    .maybeSingle();
  return data as {
    is_blocked: boolean;
    block_reason: string | null;
    rating: number | null;
    status: string | null;
  } | null;
}

export async function getUserImportStats(userId: string): Promise<{
  imported: number;
  withIssues: number;
  flagged: number;
}> {
  const { data: attempts } = await supabaseAdmin
    .from('import_attempts')
    .select('success, ai_completeness_verdict')
    .eq('user_id', userId);
  const rows = attempts ?? [];
  const imported = rows.filter((r) => r.success).length;
  const withIssues = rows.filter(
    (r) => r.success && r.ai_completeness_verdict === 'incomplete'
  ).length;
  const { count: flagged } = await supabaseAdmin
    .from('recipes')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .in('ai_recipe_verdict', ['flagged', 'not_a_recipe']);
  return { imported, withIssues, flagged: flagged ?? 0 };
}

export async function getUserIncompleteRecipes(userId: string): Promise<
  Array<{ id: string; title: string; missing_fields: string[]; created_at: string }>
> {
  const { data } = await supabaseAdmin
    .from('recipes')
    .select('id, title, missing_fields, created_at')
    .eq('user_id', userId)
    .eq('is_complete', false)
    .order('created_at', { ascending: false });
  return (data ?? []) as Array<{
    id: string;
    title: string;
    missing_fields: string[];
    created_at: string;
  }>;
}
