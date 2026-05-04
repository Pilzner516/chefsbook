import { supabaseAdmin } from '../client';

/**
 * Create a gap contribution record when a user imports a recipe to fill a knowledge gap.
 */
export async function createGapContribution(params: {
  gap_id: string;
  recipe_id: string;
  user_id: string;
  points_awarded: number;
}) {
  const { data, error } = await supabaseAdmin
    .from('gap_contributions')
    .insert({
      gap_id: params.gap_id,
      recipe_id: params.recipe_id,
      user_id: params.user_id,
      points_awarded: params.points_awarded,
      is_double_points: true,
    })
    .select('id')
    .single();

  if (error) throw error;
  return data;
}

/**
 * Check if a gap should be marked as filled based on current observations.
 */
export async function checkGapFillStatus(gapId: string): Promise<boolean> {
  // Get the gap's canonical_key and fill_threshold
  const { data: gap } = await supabaseAdmin
    .from('knowledge_gaps')
    .select('canonical_key, fill_threshold')
    .eq('id', gapId)
    .single();

  if (!gap) return false;

  // Check if cooking_action_timings has enough high-confidence observations
  const { data: timing } = await supabaseAdmin
    .from('cooking_action_timings')
    .select('observed_count, confidence')
    .eq('canonical_key', gap.canonical_key)
    .single();

  if (!timing) return false;

  const isFilled =
    timing.observed_count >= gap.fill_threshold &&
    (timing.confidence === 'high' || timing.confidence === 'very_high');

  if (isFilled) {
    // Mark gap as filled
    await supabaseAdmin
      .from('knowledge_gaps')
      .update({ status: 'filled', filled_at: new Date().toISOString() })
      .eq('id', gapId);
  }

  return isFilled;
}

/**
 * Get user's gap contribution count (for badge checking).
 */
export async function getUserGapContributionCount(userId: string): Promise<number> {
  const { count } = await supabaseAdmin
    .from('gap_contributions')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId);

  return count || 0;
}
