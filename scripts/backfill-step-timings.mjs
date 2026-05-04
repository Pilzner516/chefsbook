#!/usr/bin/env node
/**
 * Backfill: infer timings for recipe steps that don't have them yet.
 * Used by Kitchen Conductor for scheduling. Uses Haiku (~$0.0003/step).
 *
 * Usage: node scripts/backfill-step-timings.mjs [--limit N]
 * Environment: requires SUPABASE_SERVICE_ROLE_KEY and ANTHROPIC_API_KEY
 */

import { createClient } from '@supabase/supabase-js';

// Use slux IP directly - env vars may have stale Pi IP
const SUPABASE_URL = process.env.SUPABASE_URL || 'http://100.83.66.51:8000';
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const API_KEY = process.env.ANTHROPIC_API_KEY || process.env.EXPO_PUBLIC_ANTHROPIC_API_KEY;

if (!SERVICE_KEY) { console.error('SUPABASE_SERVICE_ROLE_KEY required'); process.exit(1); }
if (!API_KEY) { console.error('ANTHROPIC_API_KEY required'); process.exit(1); }

const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

const HAIKU = 'claude-haiku-4-5-20251001';

const INFER_STEP_TIMINGS_PROMPT = `You are extracting cooking step timing metadata. Respond ONLY with valid JSON, no explanation.

Recipe step text: "{instruction}"

Return exactly this JSON structure:
{
  "duration_min": <integer minutes or null>,
  "duration_max": <integer minutes or null>,
  "is_passive": <true if chef can walk away, false if active attention required>,
  "uses_oven": <true/false>,
  "oven_temp_celsius": <integer or null>,
  "phase": <"prep" | "cook" | "rest" | "plate">,
  "timing_confidence": <"high" if explicit time stated, "medium" if implied, "low" if vague>
}

Rules:
- duration_min/max: extract explicit times first ("bake for 30 minutes" → min:30, max:30).
  For ranges ("10-15 minutes") use both. For vague steps ("cook until done") return null.
- is_passive: simmering/baking/resting = true. Searing/stirring/folding/kneading = false.
  "Stir occasionally" = passive (occasional ≠ continuous attention).
- uses_oven: true only for steps requiring the oven. Stovetop = false.
- oven_temp_celsius: extract if stated. Convert F to C. Null if not stated.
- phase: prep = no heat, cutting/measuring/mixing. cook = heat on. rest = waiting/resting/marinating.
  plate = plating/garnishing/serving.
- timing_confidence: high = explicit minutes stated. medium = method implies typical time
  (e.g. "sear" implies 2-4 min). low = completely vague ("cook until done", "season to taste").`;

async function callClaude(prompt) {
  const body = { model: HAIKU, max_tokens: 200, messages: [{ role: 'user', content: prompt }] };
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-api-key': API_KEY, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const errBody = await res.text().catch(() => '');
    throw new Error(`Claude ${res.status}: ${errBody.slice(0, 300)}`);
  }
  const data = await res.json();
  return data.content?.[0]?.text ?? '';
}

function extractJSON(text) {
  const m = text.match(/```json\s*([\s\S]*?)```/) ?? text.match(/(\{[\s\S]*\}|\[[\s\S]*\])/);
  if (!m) throw new Error('No JSON');
  return JSON.parse(m[1] ?? m[0]);
}

async function inferStepTimings(instruction) {
  const prompt = INFER_STEP_TIMINGS_PROMPT.replace('{instruction}', instruction.replace(/"/g, '\\"'));
  const raw = await callClaude(prompt);
  return extractJSON(raw);
}

async function main() {
  const args = process.argv.slice(2);
  const limitIdx = args.indexOf('--limit');
  const limit = limitIdx >= 0 ? parseInt(args[limitIdx + 1], 10) : null;

  const BATCH_SIZE = 100;
  let offset = 0;
  let total = 0;
  let success = 0;
  let failed = 0;
  let skipped = 0;

  console.log('Backfilling step timings for Kitchen Conductor...');
  if (limit) console.log(`Limit: ${limit} steps`);

  while (true) {
    if (limit && total >= limit) break;

    // Query steps that don't have timings yet
    const { data: steps, error } = await supabase
      .from('recipe_steps')
      .select('id, instruction, recipe_id')
      .is('timings_inferred_at', null)
      .order('recipe_id', { ascending: true })
      .range(offset, offset + BATCH_SIZE - 1);

    if (error) { console.error('Query error:', error.message); break; }
    if (!steps || steps.length === 0) break;

    // Process in concurrent batches of 3
    const CONCURRENT_BATCH = 3;
    for (let i = 0; i < steps.length; i += CONCURRENT_BATCH) {
      if (limit && total >= limit) break;

      // Calculate batch size respecting the limit
      const remaining = limit ? Math.min(limit - total, steps.length - i) : steps.length - i;
      const batchSize = Math.min(CONCURRENT_BATCH, remaining);
      const batch = steps.slice(i, i + batchSize);

      // Process batch concurrently
      const results = await Promise.allSettled(
        batch.map(async (step) => {
          // Skip empty instructions
          if (!step.instruction || step.instruction.trim().length < 5) {
            return { status: 'skipped', step };
          }

          let timings;
          let retryAttempted = false;

          // Try to infer timings with retry on JSON parse failure
          try {
            timings = await inferStepTimings(step.instruction);
          } catch (firstErr) {
            // Retry once if extractJSON couldn't find JSON in the response
            // Also retry on JSON.parse SyntaxError (malformed JSON from Haiku)
            const isJsonError = firstErr.message?.includes('No JSON') || firstErr.name === 'SyntaxError';
            if (isJsonError) {
              retryAttempted = true;
              try {
                timings = await inferStepTimings(step.instruction);
              } catch (retryErr) {
                throw new Error(`JSON parse failed after retry: ${retryErr.message}`);
              }
            } else {
              // Non-JSON errors (API, network) throw immediately
              throw firstErr;
            }
          }

          // Update step with timing data
          const { error: updateErr } = await supabase
            .from('recipe_steps')
            .update({
              duration_min: timings.duration_min,
              duration_max: timings.duration_max,
              is_passive: timings.is_passive ?? false,
              uses_oven: timings.uses_oven ?? false,
              oven_temp_celsius: timings.oven_temp_celsius,
              phase: timings.phase ?? 'cook',
              timing_confidence: timings.timing_confidence ?? 'low',
              timings_inferred_at: new Date().toISOString(),
            })
            .eq('id', step.id);

          if (updateErr) throw new Error(updateErr.message);

          return { status: 'success', step, timings, retryAttempted };
        })
      );

      // Process results
      for (let j = 0; j < results.length; j++) {
        total++;
        const result = results[j];
        const step = batch[j];

        if (result.status === 'fulfilled') {
          if (result.value.status === 'skipped') {
            skipped++;
            console.log(`  [skip] step ${step.id} — instruction too short`);
          } else {
            success++;
            const preview = step.instruction.slice(0, 50).replace(/\n/g, ' ');
            const timings = result.value.timings;
            const timing = timings.duration_max ? `${timings.duration_min ?? '?'}-${timings.duration_max}min` : 'no time';
            const retryTag = result.value.retryAttempted ? ' (retry)' : '';
            console.log(`  [ok] ${preview}... → ${timing} (${timings.phase}, ${timings.timing_confidence})${retryTag}`);
          }
        } else {
          failed++;
          const err = result.reason;
          console.error(`  [fail] step ${step.id}: ${err.message}`);
          // Abort early on credit/auth errors
          if (err.message?.includes('credit balance') || err.message?.includes('401')) {
            console.error('\nAborting: API key issue (credits or auth). Fix and re-run.');
            console.log(`\nDone: ${total} processed, ${success} inferred, ${failed} failed, ${skipped} skipped`);
            process.exit(1);
          }
        }
      }

      // Rate limit: 3 second delay between batches
      // Math: 3 calls/batch + 3s delay = ~60 calls/min (reduced connection pressure)
      if (i + CONCURRENT_BATCH < steps.length) {
        await new Promise((r) => setTimeout(r, 3000));
      }
    }

    offset += BATCH_SIZE;
  }

  console.log(`\nDone: ${total} processed, ${success} inferred, ${failed} failed, ${skipped} skipped`);
}

main().catch(console.error);
