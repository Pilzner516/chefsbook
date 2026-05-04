import { supabaseAdmin } from '@chefsbook/db';

export interface GapDetectionResult {
  detected: number;
  updated: number;
  filled: number;
}

/**
 * Detects knowledge gaps in the cooking action timings graph.
 *
 * Finds technique+ingredient combinations that either:
 * 1. Have low confidence/observations in cooking_action_timings
 * 2. Appear frequently in recipe_steps but don't exist in cooking_action_timings
 *
 * Priority scoring:
 * - critical: 0 observations AND appears in >10 recipe_steps
 * - high: <3 observations AND appears in >5 recipe_steps
 * - medium: <5 observations
 * - low: ≥5 observations but confidence='low'
 */
export async function detectKnowledgeGaps(): Promise<GapDetectionResult> {
  const result: GapDetectionResult = { detected: 0, updated: 0, filled: 0 };

  // STEP 1: Find gaps from cooking_action_timings (low confidence/observations)
  const { data: timingGaps } = await supabaseAdmin
    .from('cooking_action_timings')
    .select('canonical_key, technique, ingredient_category, observed_count, confidence')
    .or('observed_count.lt.5,confidence.eq.low');

  if (timingGaps) {
    for (const gap of timingGaps) {
      const priority = calculatePriority(gap.observed_count, 0); // frequency unknown for existing entries
      await upsertGap({
        canonical_key: gap.canonical_key,
        technique: gap.technique,
        ingredient_category: gap.ingredient_category,
        observation_count: gap.observed_count,
        priority,
      });
      result.detected++;
    }
  }

  // STEP 2: Find high-frequency technique+ingredient combos NOT in cooking_action_timings
  // Query recipe_steps for common technique+ingredient_category pairs
  // Note: This is a simplified version. A full implementation would use an RPC
  // to efficiently count technique+ingredient frequencies in recipe_steps.
  // For now, we'll skip this step and rely on manual admin gap creation.
  // TODO: Add RPC function get_step_technique_frequency() for automatic gap detection

  // STEP 3: Mark gaps as filled where threshold is met
  const { data: filledGaps } = await supabaseAdmin
    .from('knowledge_gaps')
    .select('id, canonical_key, fill_threshold')
    .in('status', ['active', 'agent_hunting', 'approved']);

  if (filledGaps) {
    for (const gap of filledGaps) {
      const { data: timing } = await supabaseAdmin
        .from('cooking_action_timings')
        .select('observed_count, confidence')
        .eq('canonical_key', gap.canonical_key)
        .single();

      if (timing &&
          timing.observed_count >= gap.fill_threshold &&
          (timing.confidence === 'high' || timing.confidence === 'very_high')) {
        await supabaseAdmin
          .from('knowledge_gaps')
          .update({ status: 'filled', filled_at: new Date().toISOString() })
          .eq('id', gap.id);
        result.filled++;
      }
    }
  }

  return result;
}

/**
 * Calculate gap priority based on observation count and frequency in recipe_steps.
 */
function calculatePriority(observationCount: number, frequency: number): 'critical' | 'high' | 'medium' | 'low' {
  if (observationCount === 0 && frequency > 10) return 'critical';
  if (observationCount < 3 && frequency > 5) return 'high';
  if (observationCount < 5) return 'medium';
  return 'low';
}

/**
 * Upsert a knowledge gap. If it exists, update observation_count and priority.
 */
async function upsertGap(gap: {
  canonical_key: string;
  technique: string;
  ingredient_category: string | null;
  observation_count: number;
  priority: string;
}) {
  const { data: existing } = await supabaseAdmin
    .from('knowledge_gaps')
    .select('id')
    .eq('canonical_key', gap.canonical_key)
    .single();

  if (existing) {
    // Update existing gap
    await supabaseAdmin
      .from('knowledge_gaps')
      .update({
        observation_count: gap.observation_count,
        priority: gap.priority,
        updated_at: new Date().toISOString(),
      })
      .eq('id', existing.id);
  } else {
    // Insert new gap
    await supabaseAdmin.from('knowledge_gaps').insert({
      canonical_key: gap.canonical_key,
      technique: gap.technique,
      ingredient_category: gap.ingredient_category,
      observation_count: gap.observation_count,
      priority: gap.priority,
      status: 'detected',
    });
  }
}
