#!/usr/bin/env node
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load .env.local from monorepo root
dotenv.config({ path: path.join(__dirname, '..', '.env.local') });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

function getConfidenceFromCount(count) {
  if (count >= 25) return 'very_high';
  if (count >= 10) return 'high';
  if (count >= 5) return 'medium';
  return 'low';
}

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const minObsIndex = args.indexOf('--min-observations');
  const minObservations = minObsIndex !== -1 ? parseInt(args[minObsIndex + 1], 10) : 2;

  console.log('📊 Aggregating classified recipe steps...\n');
  console.log(`Min observations threshold: ${minObservations}\n`);

  // Aggregation query with percentiles and modes
  const { data: aggregated, error } = await supabase.rpc('aggregate_step_timings', {
    min_obs: minObservations,
  });

  if (error) {
    // If the RPC doesn't exist, fall back to raw SQL via pg
    console.log('⚠️  RPC not found, using direct SQL query...\n');

    const query = `
      SELECT
        technique,
        ingredient_category,
        technique || ':' || COALESCE(ingredient_category, '_none') AS canonical_key,
        COUNT(*)                                    AS observation_count,
        PERCENTILE_CONT(0.25) WITHIN GROUP
          (ORDER BY duration_min)::INTEGER          AS duration_min_agg,
        PERCENTILE_CONT(0.75) WITHIN GROUP
          (ORDER BY duration_max)::INTEGER          AS duration_max_agg,
        MODE() WITHIN GROUP (ORDER BY is_passive)   AS is_passive_agg,
        MODE() WITHIN GROUP (ORDER BY uses_oven)    AS uses_oven_agg,
        MODE() WITHIN GROUP
          (ORDER BY oven_temp_celsius
           NULLS LAST)                              AS oven_temp_agg,
        MODE() WITHIN GROUP (ORDER BY phase)        AS phase_agg,
        AVG(CASE
          WHEN timing_confidence = 'high' THEN 0.9
          WHEN timing_confidence = 'medium' THEN 0.6
          ELSE 0.3
        END)                                        AS avg_confidence_score
      FROM recipe_steps
      WHERE technique IS NOT NULL
        AND timings_inferred_at IS NOT NULL
        AND timing_confidence IS NOT NULL
      GROUP BY technique, ingredient_category
      HAVING COUNT(*) >= ${minObservations}
      ORDER BY COUNT(*) DESC
    `;

    const { data: rawData, error: rawError } = await supabase.rpc('exec_sql', { sql: query });

    if (rawError) {
      console.error('❌ Aggregation query failed:', rawError.message);
      console.log('\nTrying direct postgres query via docker...\n');

      // This won't work from local dev, but will work when run on slux
      console.error('❌ Cannot run postgres query from local script.');
      console.error('📝 Run this script on slux instead, or create the RPC function first.');
      process.exit(1);
    }
  }

  // For now, we'll use a simpler approach: fetch all classified steps and aggregate in JS
  console.log('📦 Fetching all classified steps for aggregation...\n');

  const { data: steps, error: fetchError } = await supabase
    .from('recipe_steps')
    .select('technique, ingredient_category, duration_min, duration_max, is_passive, uses_oven, oven_temp_celsius, phase, timing_confidence')
    .not('technique', 'is', null)
    .not('timings_inferred_at', 'is', null);

  if (fetchError) {
    console.error('❌ Error fetching steps:', fetchError.message);
    process.exit(1);
  }

  if (!steps || steps.length === 0) {
    console.log('✅ No classified steps found.');
    process.exit(0);
  }

  console.log(`Found ${steps.length} classified steps.\n`);

  // Group by canonical_key
  const groups = {};
  for (const step of steps) {
    const key = `${step.technique}:${step.ingredient_category || '_none'}`;
    if (!groups[key]) {
      groups[key] = [];
    }
    groups[key].push(step);
  }

  // Aggregate each group
  const aggregations = [];
  for (const [key, items] of Object.entries(groups)) {
    if (items.length < minObservations) continue;

    const durations_min = items.map(s => s.duration_min).filter(d => d !== null).sort((a, b) => a - b);
    const durations_max = items.map(s => s.duration_max).filter(d => d !== null).sort((a, b) => a - b);

    const duration_min_agg = durations_min.length > 0
      ? Math.round(durations_min[Math.floor(durations_min.length * 0.25)])
      : null;

    const duration_max_agg = durations_max.length > 0
      ? Math.round(durations_max[Math.floor(durations_max.length * 0.75)])
      : null;

    // Mode for boolean and categorical fields
    const mode = (arr) => {
      const counts = {};
      for (const val of arr) {
        counts[val] = (counts[val] || 0) + 1;
      }
      return Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0];
    };

    const is_passive_agg = mode(items.map(s => s.is_passive)) === 'true';
    const uses_oven_agg = mode(items.map(s => s.uses_oven)) === 'true';
    const phase_agg = mode(items.map(s => s.phase));
    const oven_temps = items.map(s => s.oven_temp_celsius).filter(t => t !== null);
    const oven_temp_agg = oven_temps.length > 0 ? mode(oven_temps) : null;

    const confidence_scores = items.map(s => {
      if (s.timing_confidence === 'high') return 0.9;
      if (s.timing_confidence === 'medium') return 0.6;
      return 0.3;
    });
    const avg_confidence_score = confidence_scores.reduce((a, b) => a + b, 0) / confidence_scores.length;

    aggregations.push({
      canonical_key: key,
      technique: items[0].technique,
      ingredient_category: items[0].ingredient_category,
      observation_count: items.length,
      duration_min_agg,
      duration_max_agg,
      is_passive_agg,
      uses_oven_agg,
      oven_temp_agg: oven_temp_agg ? parseInt(oven_temp_agg, 10) : null,
      phase_agg,
      confidence: getConfidenceFromCount(items.length),
    });
  }

  console.log(`📈 Aggregated ${aggregations.length} canonical keys.\n`);

  if (dryRun) {
    console.log('🔎 DRY RUN - Top 10 aggregations:\n');
    for (const agg of aggregations.slice(0, 10)) {
      console.log(`${agg.canonical_key} (${agg.observation_count} obs) → ${agg.duration_min_agg}-${agg.duration_max_agg}min, ${agg.confidence}`);
    }
    process.exit(0);
  }

  // Upsert into cooking_action_timings
  let inserted = 0;
  let updated = 0;
  let wikipediaEnriched = 0;

  for (const agg of aggregations) {
    // Check if exists
    const { data: existing } = await supabase
      .from('cooking_action_timings')
      .select('source, observations_count')
      .eq('canonical_key', agg.canonical_key)
      .maybeSingle();

    if (existing) {
      // Update only if new observation count is higher
      if (agg.observation_count > (existing.observations_count || 0)) {
        const newSource = existing.source === 'wikipedia'
          ? 'wikipedia+recipe_steps'
          : 'recipe_steps_promotion';

        const { error: updateError } = await supabase
          .from('cooking_action_timings')
          .update({
            duration_min: agg.duration_min_agg,
            duration_max: agg.duration_max_agg,
            is_passive: agg.is_passive_agg,
            uses_oven: agg.uses_oven_agg,
            oven_temp_celsius: agg.oven_temp_agg,
            phase: agg.phase_agg,
            confidence: agg.confidence,
            observations_count: agg.observation_count,
            source: newSource,
          })
          .eq('canonical_key', agg.canonical_key);

        if (!updateError) {
          updated++;
          if (existing.source === 'wikipedia') {
            wikipediaEnriched++;
          }
        }
      }
    } else {
      // Insert new entry
      const { error: insertError } = await supabase
        .from('cooking_action_timings')
        .insert({
          canonical_key: agg.canonical_key,
          technique: agg.technique,
          ingredient_category: agg.ingredient_category,
          duration_min: agg.duration_min_agg,
          duration_max: agg.duration_max_agg,
          is_passive: agg.is_passive_agg,
          uses_oven: agg.uses_oven_agg,
          oven_temp_celsius: agg.oven_temp_agg,
          phase: agg.phase_agg,
          confidence: agg.confidence,
          source: 'recipe_steps_promotion',
          observations_count: agg.observation_count,
        });

      if (!insertError) {
        inserted++;
      }
    }
  }

  // Get final count
  const { count: finalCount } = await supabase
    .from('cooking_action_timings')
    .select('*', { count: 'exact', head: true });

  console.log('\n━━━ Promotion Complete ━━━');
  console.log(`📊 Canonical keys processed: ${aggregations.length}`);
  console.log(`➕ New entries inserted:     ${inserted}`);
  console.log(`♻️  Existing entries updated:  ${updated} (of which ${wikipediaEnriched} were Wikipedia entries)`);
  console.log(`📈 cooking_action_timings total rows: ${finalCount || 'unknown'}`);
}

main().catch(console.error);
