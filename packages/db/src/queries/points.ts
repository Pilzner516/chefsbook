import { supabaseAdmin } from '../client';

export interface AwardPointsResult {
  newBalance: number;
  newBadges: string[];
}

/**
 * Award points to a user for an action.
 *
 * @param userId - User ID to award points to
 * @param action - Action type (e.g., 'recipe_import', 'gap_contribution')
 * @param points - Number of points to award
 * @param referenceId - Optional reference to the object (recipe_id, etc.)
 * @param description - Human-readable description
 * @returns New balance and any newly earned badges
 */
export async function awardPoints(
  userId: string,
  action: string,
  points: number,
  referenceId: string | null,
  description: string
): Promise<AwardPointsResult> {
  // Insert points transaction
  await supabaseAdmin.from('user_points').insert({
    user_id: userId,
    points,
    action,
    reference_id: referenceId,
    description,
  });

  // Update or insert balance
  const { data: currentBalance } = await supabaseAdmin
    .from('user_points_balance')
    .select('total_points')
    .eq('user_id', userId)
    .single();

  const newBalance = (currentBalance?.total_points || 0) + points;

  await supabaseAdmin
    .from('user_points_balance')
    .upsert({
      user_id: userId,
      total_points: newBalance,
      updated_at: new Date().toISOString(),
    });

  // Check for newly earned badges
  const newBadges = await checkAndAwardBadges(userId);

  return { newBalance, newBadges };
}

/**
 * Check if user has earned any new badges and award them.
 *
 * @param userId - User ID to check
 * @returns Array of newly earned badge IDs
 */
export async function checkAndAwardBadges(userId: string): Promise<string[]> {
  const newBadges: string[] = [];

  // Get all badge definitions
  const { data: badges } = await supabaseAdmin
    .from('badge_definitions')
    .select('*')
    .eq('is_active', true);

  if (!badges) return newBadges;

  // Get already earned badges
  const { data: earnedBadges } = await supabaseAdmin
    .from('user_badges')
    .select('badge_id')
    .eq('user_id', userId);

  const earnedBadgeIds = new Set((earnedBadges || []).map(b => b.badge_id));

  for (const badge of badges) {
    // Skip if already earned
    if (earnedBadgeIds.has(badge.id)) continue;

    // Check threshold based on badge category
    let qualified = false;

    if (badge.category === 'contribution') {
      // Count gap contributions
      const { count } = await supabaseAdmin
        .from('gap_contributions')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', userId);

      qualified = (count || 0) >= (badge.threshold || 0);
    } else if (badge.category === 'milestone') {
      // Count recipe imports
      const { count } = await supabaseAdmin
        .from('recipes')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', userId);

      qualified = (count || 0) >= (badge.threshold || 0);
    }

    if (qualified) {
      // Award badge
      const { error } = await supabaseAdmin.from('user_badges').insert({
        user_id: userId,
        badge_id: badge.id,
      });

      if (!error) {
        newBadges.push(badge.id);
      }
    }
  }

  return newBadges;
}

/**
 * Get user's current points balance.
 */
export async function getUserPointsBalance(userId: string): Promise<number> {
  const { data } = await supabaseAdmin
    .from('user_points_balance')
    .select('total_points')
    .eq('user_id', userId)
    .single();

  return data?.total_points || 0;
}

/**
 * Get user's recent point history.
 */
export async function getUserPointsHistory(userId: string, limit = 10) {
  const { data } = await supabaseAdmin
    .from('user_points')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit);

  return data || [];
}

/**
 * Get user's earned badges.
 */
export async function getUserBadges(userId: string) {
  const { data } = await supabaseAdmin
    .from('user_badges')
    .select(`
      badge_id,
      earned_at,
      badge_definitions (
        name,
        description,
        icon,
        category
      )
    `)
    .eq('user_id', userId)
    .order('earned_at', { ascending: false });

  return data || [];
}
