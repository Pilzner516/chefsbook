import { supabaseAdmin } from '../client';

export interface KnowledgeGap {
  id: string;
  technique: string;
  ingredient_category: string | null;
  canonical_key: string;
  observation_count: number;
  priority: 'low' | 'medium' | 'high' | 'critical';
  status: 'detected' | 'approved' | 'active' | 'agent_hunting' | 'filled' | 'dismissed';
  request_title: string | null;
  request_body: string | null;
  fill_threshold: number;
  suggested_urls: any[];
  detected_at: string;
  approved_at: string | null;
  approved_by: string | null;
  filled_at: string | null;
  dismissed_at: string | null;
  dismissed_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface KnowledgeGapStats {
  total_gaps: number;
  active_requests: number;
  filled_this_month: number;
  avg_observations: number;
}

/**
 * List all knowledge gaps with optional status filter.
 */
export async function listKnowledgeGaps(statusFilter?: string) {
  let query = supabaseAdmin
    .from('knowledge_gaps')
    .select('*')
    .order('priority', { ascending: false })
    .order('detected_at', { ascending: false });

  if (statusFilter && statusFilter !== 'all') {
    query = query.eq('status', statusFilter);
  }

  const { data, error } = await query;
  if (error) throw error;
  return data as KnowledgeGap[];
}

/**
 * Get knowledge gap statistics for admin KPI cards.
 */
export async function getKnowledgeGapStats(): Promise<KnowledgeGapStats> {
  // Total gaps (not dismissed or filled)
  const { count: totalGaps } = await supabaseAdmin
    .from('knowledge_gaps')
    .select('id', { count: 'exact', head: true })
    .not('status', 'in', '(dismissed,filled)');

  // Active community requests
  const { count: activeRequests } = await supabaseAdmin
    .from('knowledge_gaps')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'active');

  // Filled this month
  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);

  const { count: filledThisMonth } = await supabaseAdmin
    .from('knowledge_gaps')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'filled')
    .gte('filled_at', startOfMonth.toISOString());

  // Average observations per gap
  const { data: avgData } = await supabaseAdmin
    .from('knowledge_gaps')
    .select('observation_count')
    .not('status', 'in', '(dismissed,filled)');

  const avgObservations = avgData && avgData.length > 0
    ? Math.round(avgData.reduce((sum, g) => sum + g.observation_count, 0) / avgData.length)
    : 0;

  return {
    total_gaps: totalGaps || 0,
    active_requests: activeRequests || 0,
    filled_this_month: filledThisMonth || 0,
    avg_observations: avgObservations,
  };
}

/**
 * Get a single knowledge gap by ID.
 */
export async function getKnowledgeGap(gapId: string) {
  const { data, error } = await supabaseAdmin
    .from('knowledge_gaps')
    .select('*')
    .eq('id', gapId)
    .single();

  if (error) throw error;
  return data as KnowledgeGap;
}

/**
 * Update a knowledge gap (approve, go live, dismiss, etc.).
 */
export async function updateKnowledgeGap(
  gapId: string,
  updates: Partial<KnowledgeGap>
) {
  const { data, error } = await supabaseAdmin
    .from('knowledge_gaps')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', gapId)
    .select()
    .single();

  if (error) throw error;
  return data as KnowledgeGap;
}

/**
 * Approve a gap for community request (detected → approved).
 */
export async function approveKnowledgeGap(
  gapId: string,
  adminUserId: string,
  requestTitle: string,
  requestBody: string,
  fillThreshold: number = 5
) {
  return updateKnowledgeGap(gapId, {
    status: 'approved',
    request_title: requestTitle,
    request_body: requestBody,
    fill_threshold: fillThreshold,
    approved_at: new Date().toISOString(),
    approved_by: adminUserId,
  });
}

/**
 * Make a gap active (show as community request card).
 */
export async function activateKnowledgeGap(gapId: string) {
  return updateKnowledgeGap(gapId, { status: 'active' });
}

/**
 * Dismiss a gap (admin decides not worth pursuing).
 */
export async function dismissKnowledgeGap(
  gapId: string,
  adminUserId: string
) {
  return updateKnowledgeGap(gapId, {
    status: 'dismissed',
    dismissed_at: new Date().toISOString(),
    dismissed_by: adminUserId,
  });
}

/**
 * Update suggested URLs for a gap (from agent discovery).
 */
export async function updateGapSuggestedUrls(
  gapId: string,
  suggestedUrls: any[]
) {
  return updateKnowledgeGap(gapId, { suggested_urls: suggestedUrls });
}

/**
 * Get a random active gap for community request card rotation.
 */
export async function getRandomActiveGap() {
  const { data, error } = await supabaseAdmin
    .from('knowledge_gaps')
    .select('*')
    .eq('status', 'active')
    .limit(10);

  if (error) throw error;
  if (!data || data.length === 0) return null;

  // Return random gap from the set
  return data[Math.floor(Math.random() * data.length)] as KnowledgeGap;
}
