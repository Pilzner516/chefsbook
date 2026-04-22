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

  // Check ingredient names (required)
  const ingredientsWithName = ingredients.filter((i) => {
    const name = i.ingredient ?? i.name;
    return name && name.trim() !== '';
  });

  if (ingredientsWithName.length < 2) missing.push('ingredients (minimum 2)');

  // Check for bulk missing quantities pattern (75%+ threshold)
  // Flag as incomplete if EITHER:
  // - 75%+ of ingredients have quantity = 0 or null
  // - 75%+ of ingredients have BOTH quantity = 0/null AND no unit
  // Unit-less alone never flags; only the 75% bulk pattern triggers
  if (ingredients.length >= 2) {
    const threshold = Math.ceil(ingredients.length * 0.75);

    // Count ingredients with missing/zero quantity
    const missingQty = ingredients.filter((i) => {
      const qty = i.quantity ?? i.amount;
      return qty === null || qty === undefined || qty === 0;
    }).length;

    // Count ingredients with BOTH missing/zero quantity AND no unit
    const missingQtyAndUnit = ingredients.filter((i) => {
      const qty = i.quantity ?? i.amount;
      return (qty === null || qty === undefined || qty === 0) && !i.unit;
    }).length;

    if (missingQty >= threshold || missingQtyAndUnit >= threshold) {
      missing.push('ingredient quantities');
    }
  }

  const steps = recipe.steps ?? [];
  if (steps.length < 1) missing.push('steps');

  return {
    isComplete: missing.length === 0,
    missingFields: missing,
    ingredientCount: ingredients.length,
    hasQuantities: !missing.includes('ingredient quantities'),
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
  isNewDiscovery?: boolean;
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
    is_new_discovery: attempt.isNewDiscovery ?? false,
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

  // Always recalculate rating from aggregate data
  await recalculateRating(domain);
}

/** Recalculate a site's star rating from its aggregate success data.
 *  ≥80% = 5★, 60-79% = 4★, 40-59% = 3★, 20-39% = 2★, <20% = 1★, no data = NULL */
export async function recalculateRating(domain: string): Promise<number | null> {
  const { data } = await supabaseAdmin
    .from('import_site_tracker')
    .select('id, total_attempts, successful_attempts')
    .eq('domain', domain)
    .maybeSingle();
  if (!data) return null;

  let rating: number | null = null;
  if (data.total_attempts > 0) {
    const rate = data.successful_attempts / data.total_attempts;
    rating = rate >= 0.8 ? 5 : rate >= 0.6 ? 4 : rate >= 0.4 ? 3 : rate >= 0.2 ? 2 : 1;
  }

  await supabaseAdmin
    .from('import_site_tracker')
    .update({ rating, updated_at: new Date().toISOString() })
    .eq('id', data.id);

  return rating;
}

/** Recalculate ratings for ALL tracked domains. Returns count updated. */
export async function recalculateAllRatings(): Promise<number> {
  const { data: allSites } = await supabaseAdmin
    .from('import_site_tracker')
    .select('id, domain, total_attempts, successful_attempts');

  let updated = 0;
  for (const site of allSites ?? []) {
    let rating: number | null = null;
    if (site.total_attempts > 0) {
      const rate = site.successful_attempts / site.total_attempts;
      rating = rate >= 0.8 ? 5 : rate >= 0.6 ? 4 : rate >= 0.4 ? 3 : rate >= 0.2 ? 2 : 1;
    }
    await supabaseAdmin
      .from('import_site_tracker')
      .update({ rating, updated_at: new Date().toISOString() })
      .eq('id', site.id);
    updated++;
  }
  return updated;
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

/**
 * Record a first-time domain discovery. Returns true if the domain was truly
 * new (i.e. this call inserted the tracker row) so callers can surface the
 * warm "thank you" message to the user.
 */
export async function recordSiteDiscovery(
  domain: string,
  userId: string | null,
): Promise<{ isNewDiscovery: boolean; discoveryCount: number }> {
  if (!domain) return { isNewDiscovery: false, discoveryCount: 0 };

  const { data: existing } = await supabaseAdmin
    .from('import_site_tracker')
    .select('id, is_user_discovered, discovery_count, review_status')
    .eq('domain', domain)
    .maybeSingle();

  if (existing) {
    // Known or already-discovered site: bump discovery_count only if flagged
    // as a user-discovered (not officially curated) entry.
    if (existing.is_user_discovered) {
      const newCount = (existing.discovery_count ?? 0) + 1;
      await supabaseAdmin
        .from('import_site_tracker')
        .update({ discovery_count: newCount })
        .eq('id', existing.id);
      return { isNewDiscovery: false, discoveryCount: newCount };
    }
    return { isNewDiscovery: false, discoveryCount: 0 };
  }

  const { error } = await supabaseAdmin.from('import_site_tracker').insert({
    domain,
    status: 'unknown',
    is_user_discovered: true,
    discovery_count: 1,
    first_discovered_at: new Date().toISOString(),
    first_discovered_by: userId,
    review_status: 'pending',
    auto_test_enabled: true,
    total_attempts: 0,
    successful_attempts: 0,
    notes: 'Discovered via user import',
  });

  if (error) {
    // Race: another request inserted first — treat as existing.
    return { isNewDiscovery: false, discoveryCount: 0 };
  }

  if (userId) {
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

  return { isNewDiscovery: true, discoveryCount: 1 };
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
  sitesDiscovered: number;
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
  const { data: profile } = await supabaseAdmin
    .from('user_profiles')
    .select('sites_discovered_count')
    .eq('id', userId)
    .maybeSingle();
  return {
    imported,
    withIssues,
    flagged: flagged ?? 0,
    sitesDiscovered: profile?.sites_discovered_count ?? 0,
  };
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

/**
 * System-enforced visibility on every save (Prompt L).
 * Re-checks completeness and enforces:
 * - If incomplete + public → set private, system_locked = true
 * - If complete + system_locked → restore user's default visibility, clear lock
 * - If complete + not locked → leave visibility unchanged
 */
export async function enforceCompleteness(recipeId: string, userId: string): Promise<void> {
  // Fetch recipe data including current visibility and system_locked status
  const { data: recipe } = await supabaseAdmin
    .from('recipes')
    .select('id, visibility, system_locked')
    .eq('id', recipeId)
    .single();

  if (!recipe) return;

  // Re-run completeness check
  const completeness = await fetchRecipeCompleteness(recipeId);

  const update: Record<string, unknown> = {
    is_complete: completeness.isComplete,
    missing_fields: completeness.missingFields,
    completeness_checked_at: new Date().toISOString(),
  };

  if (!completeness.isComplete) {
    // Recipe fails completeness
    if (recipe.visibility === 'public') {
      // Force private and lock
      update.visibility = 'private';
      update.system_locked = true;
    }
    // If already private, just update missing_fields (don't change lock status)
  } else {
    // Recipe passes completeness
    if (recipe.system_locked) {
      // Auto-restore visibility from user's default preference
      const { data: profile } = await supabaseAdmin
        .from('user_profiles')
        .select('default_visibility')
        .eq('id', userId)
        .maybeSingle();

      const userDefault = profile?.default_visibility ?? 'public';
      update.visibility = userDefault;
      update.system_locked = false;
    }
    // If not system_locked, leave visibility unchanged (user-chosen)
  }

  await supabaseAdmin.from('recipes').update(update).eq('id', recipeId);
}
