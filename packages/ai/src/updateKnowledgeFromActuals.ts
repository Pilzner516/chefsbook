import { supabaseAdmin } from '@chefsbook/db';

interface StepActualData {
  technique: string | null;
  ingredient_category: string | null;
  actual_duration_seconds: number;
  planned_duration_min: number | null;
  planned_duration_max: number | null;
}

/**
 * Updates the cooking_action_timings knowledge graph with actual cooking data.
 * Called fire-and-forget after each step_actual is recorded.
 *
 * Logic:
 * 1. Skip if technique is null (nothing to learn)
 * 2. Look up existing entry by canonical_key (technique:ingredient_category)
 * 3. If found: recalculate weighted average, increment observations
 * 4. If not found: insert new entry from actuals
 * 5. Update related knowledge_gaps if observations meet threshold
 *
 * Always wrapped in try/catch - never throws, only logs errors.
 */
export async function updateKnowledgeFromActuals(
  stepActual: StepActualData
): Promise<void> {
  try {
    // Step 1: Skip if no technique to learn from
    if (!stepActual.technique) {
      return;
    }

    const actualMinutes = stepActual.actual_duration_seconds / 60;
    const canonical_key = stepActual.ingredient_category
      ? `${stepActual.technique}:${stepActual.ingredient_category}`
      : `${stepActual.technique}:_none`;

    // Step 2: Look up existing entry
    const { data: existing, error: lookupError } = await supabaseAdmin
      .from('cooking_action_timings')
      .select('*')
      .eq('canonical_key', canonical_key)
      .single();

    if (lookupError && lookupError.code !== 'PGRST116') {
      // PGRST116 = not found, which is fine
      console.error('[updateKnowledgeFromActuals] Lookup error:', lookupError);
      return;
    }

    if (existing) {
      // Step 3: Update existing entry with weighted average
      const currentCount = existing.observations_count || 0;
      const newCount = currentCount + 1;

      // Weighted average: (old_avg * old_count + new_value) / new_count
      const currentMin = existing.duration_min || actualMinutes;
      const currentMax = existing.duration_max || actualMinutes;

      const newMin = (currentMin * currentCount + actualMinutes) / newCount;
      const newMax = (currentMax * currentCount + actualMinutes) / newCount;

      // Update confidence based on observation count
      let confidence: 'low' | 'medium' | 'high' = 'low';
      if (newCount >= 10) confidence = 'high';
      else if (newCount >= 5) confidence = 'medium';

      const { error: updateError } = await supabaseAdmin
        .from('cooking_action_timings')
        .update({
          duration_min: Math.round(newMin),
          duration_max: Math.round(newMax),
          observations_count: newCount,
          confidence,
          updated_at: new Date().toISOString(),
        })
        .eq('canonical_key', canonical_key);

      if (updateError) {
        console.error('[updateKnowledgeFromActuals] Update error:', updateError);
        return;
      }
    } else {
      // Step 4: Insert new entry
      const { error: insertError } = await supabaseAdmin
        .from('cooking_action_timings')
        .insert({
          canonical_key,
          technique: stepActual.technique,
          ingredient_category: stepActual.ingredient_category || null,
          duration_min: Math.round(actualMinutes),
          duration_max: Math.round(actualMinutes),
          is_passive: false, // Default, will be refined with more data
          uses_oven: false, // Default, will be refined with more data
          oven_temp_celsius: null,
          phase: 'cook', // Default
          confidence: 'low',
          source: 'step_actuals',
          observations_count: 1,
        });

      if (insertError) {
        console.error('[updateKnowledgeFromActuals] Insert error:', insertError);
        return;
      }
    }

    // Step 5: Update knowledge_gaps if this fills a gap
    const newCount = existing ? (existing.observations_count || 0) + 1 : 1;

    // Check if any gap exists for this canonical_key and should be marked filled
    const { data: gaps } = await supabaseAdmin
      .from('knowledge_gaps')
      .select('id, fill_threshold')
      .eq('canonical_key', canonical_key)
      .eq('status', 'open');

    if (gaps && gaps.length > 0) {
      for (const gap of gaps) {
        if (newCount >= (gap.fill_threshold || 3)) {
          await supabaseAdmin
            .from('knowledge_gaps')
            .update({
              status: 'filled',
              filled_at: new Date().toISOString(),
              observations_when_filled: newCount,
            })
            .eq('id', gap.id);
        }
      }
    }
  } catch (error) {
    // Never throw - this is fire-and-forget background processing
    console.error('[updateKnowledgeFromActuals] Unexpected error:', error);
  }
}
