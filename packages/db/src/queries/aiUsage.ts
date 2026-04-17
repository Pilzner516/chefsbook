import { supabase, supabaseAdmin } from '../client';

// Cost per model — keep in sync with ai-cost.md in CLAUDE.md
const MODEL_COSTS: Record<string, { input?: number; output?: number; fixed?: number }> = {
  haiku: { input: 0.0000008, output: 0.000004 },
  sonnet: { input: 0.000003, output: 0.000015 },
  'flux-schnell': { fixed: 0.003 },
  'flux-dev': { fixed: 0.025 },
};

export interface AiCallLog {
  userId?: string | null;
  action: string;
  model: string;
  tokensIn?: number;
  tokensOut?: number;
  recipeId?: string | null;
  metadata?: Record<string, unknown>;
  success?: boolean;
  durationMs?: number | null;
}

/**
 * Log an AI API call with cost tracking.
 * Fire-and-forget — never blocks the caller.
 */
export async function logAiCall(params: AiCallLog): Promise<number> {
  const { userId, action, model, tokensIn = 0, tokensOut = 0, recipeId, metadata = {}, success = true, durationMs } = params;

  const costs = MODEL_COSTS[model] ?? MODEL_COSTS.haiku;
  const costUsd = costs.fixed ?? (tokensIn * (costs.input ?? 0) + tokensOut * (costs.output ?? 0));

  try {
    await supabaseAdmin.from('ai_usage_log').insert({
      user_id: userId ?? null,
      action,
      model,
      tokens_in: tokensIn,
      tokens_out: tokensOut,
      cost_usd: costUsd,
      recipe_id: recipeId ?? null,
      metadata,
      success,
      duration_ms: durationMs ?? null,
    });
  } catch { /* logging failure must never block AI calls */ }

  // Check throttle after logging (non-blocking)
  if (userId) {
    checkAndUpdateThrottle(userId).catch(() => {});
  }

  return costUsd;
}

/**
 * Log an AI call from a client context (mobile or web browser) using the
 * anon supabase client under the user's JWT. Additive helper — does NOT change
 * behaviour of the existing server-side `logAiCall`. Fire-and-forget; silent on
 * failure so client AI flows never break due to logging edge cases (RLS, network).
 *
 * Intended for paths where no server route is available, e.g. mobile's direct
 * @chefsbook/ai Claude calls. If RLS denies the insert the function resolves 0
 * silently — mobile AI calls historically haven't been logged, this is additive
 * best-effort coverage for new flows like scan_guided_generation.
 */
export async function logAiCallFromClient(params: AiCallLog): Promise<number> {
  const { userId, action, model, tokensIn = 0, tokensOut = 0, recipeId, metadata = {}, success = true, durationMs } = params;
  const costs = MODEL_COSTS[model] ?? MODEL_COSTS.haiku;
  const costUsd = costs.fixed ?? (tokensIn * (costs.input ?? 0) + tokensOut * (costs.output ?? 0));
  try {
    await supabase.from('ai_usage_log').insert({
      user_id: userId ?? null,
      action,
      model,
      tokens_in: tokensIn,
      tokens_out: tokensOut,
      cost_usd: costUsd,
      recipe_id: recipeId ?? null,
      metadata,
      success,
      duration_ms: durationMs ?? null,
    });
  } catch { /* silent — logging must never break AI flows */ }
  return costUsd;
}

/**
 * Get throttle settings from system_settings.
 */
export async function getThrottleSettings() {
  const { data } = await supabaseAdmin.from('system_settings').select('key, value');
  const map = new Map((data ?? []).map((r) => [r.key, r.value]));
  return {
    enabled: map.get('throttle_enabled') === 'true',
    yellowPct: parseInt(map.get('throttle_yellow_pct') ?? '150', 10),
    redPct: parseInt(map.get('throttle_red_pct') ?? '300', 10),
    graceDays: parseInt(map.get('throttle_grace_days') ?? '30', 10),
    windowDays: parseInt(map.get('throttle_window_days') ?? '7', 10),
    expectedCosts: {
      free: parseFloat(map.get('throttle_expected_cost_free') ?? '0.05'),
      chef: parseFloat(map.get('throttle_expected_cost_chef') ?? '0.20'),
      family: parseFloat(map.get('throttle_expected_cost_family') ?? '0.71'),
      pro: parseFloat(map.get('throttle_expected_cost_pro') ?? '0.44'),
    } as Record<string, number>,
  };
}

/**
 * Check if a user is throttled (red level).
 */
export async function isUserThrottled(userId: string): Promise<boolean> {
  try {
    const { data } = await supabaseAdmin
      .from('user_throttle')
      .select('is_throttled, admin_override')
      .eq('user_id', userId)
      .maybeSingle();
    if (data?.admin_override) return false;
    return data?.is_throttled ?? false;
  } catch {
    return false; // never block on throttle check failure
  }
}

/**
 * Check user's rolling window cost and update throttle state.
 */
export async function checkAndUpdateThrottle(userId: string): Promise<void> {
  try {
    const settings = await getThrottleSettings();
    if (!settings.enabled) return;

    // Check admin override
    const { data: existing } = await supabaseAdmin
      .from('user_throttle')
      .select('admin_override, throttle_level')
      .eq('user_id', userId)
      .maybeSingle();
    if (existing?.admin_override) return;

    // Get user's plan and registration date
    const { data: profile } = await supabaseAdmin
      .from('user_profiles')
      .select('plan_tier, created_at')
      .eq('id', userId)
      .single();
    if (!profile) return;

    // Grace period
    const daysSinceRegistration = (Date.now() - new Date(profile.created_at).getTime()) / 86400000;
    if (daysSinceRegistration < settings.graceDays) return;

    // Rolling window cost
    const windowStart = new Date(Date.now() - settings.windowDays * 86400000).toISOString();
    const { data: usage } = await supabaseAdmin
      .from('ai_usage_log')
      .select('cost_usd')
      .eq('user_id', userId)
      .gte('created_at', windowStart);

    const windowCost = (usage ?? []).reduce((sum, r) => sum + parseFloat(String(r.cost_usd)), 0);

    // Expected cost for the window
    const expectedMonthly = settings.expectedCosts[profile.plan_tier] ?? 0.20;
    const expectedWindow = expectedMonthly * (settings.windowDays / 30);

    const yellowThreshold = expectedWindow * (settings.yellowPct / 100);
    const redThreshold = expectedWindow * (settings.redPct / 100);

    let newLevel: 'yellow' | 'red' | null = null;
    if (windowCost >= redThreshold) newLevel = 'red';
    else if (windowCost >= yellowThreshold) newLevel = 'yellow';

    await supabaseAdmin.from('user_throttle').upsert({
      user_id: userId,
      is_throttled: newLevel === 'red',
      throttle_level: newLevel,
      throttled_at: newLevel ? new Date().toISOString() : null,
      throttled_reason: newLevel
        ? `${settings.windowDays}-day cost $${windowCost.toFixed(4)} exceeds ${newLevel} threshold $${(newLevel === 'red' ? redThreshold : yellowThreshold).toFixed(4)}`
        : null,
      monthly_cost_usd: windowCost,
      monthly_cost_updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id' });
  } catch { /* throttle check failure must never block */ }
}
