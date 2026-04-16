#!/usr/bin/env node
/**
 * Backfill: rewrite steps for imported recipes that haven't been rewritten yet.
 * Processes in batches of 10, rate-limited to 1 per second.
 *
 * Usage: node scripts/rewrite-imported-steps.mjs
 * Environment: requires SUPABASE_SERVICE_ROLE_KEY and ANTHROPIC_API_KEY (or EXPO_PUBLIC_ANTHROPIC_API_KEY)
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || 'http://100.110.47.62:8000';
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const API_KEY = process.env.ANTHROPIC_API_KEY || process.env.EXPO_PUBLIC_ANTHROPIC_API_KEY;

if (!SERVICE_KEY) { console.error('SUPABASE_SERVICE_ROLE_KEY required'); process.exit(1); }
if (!API_KEY) { console.error('ANTHROPIC_API_KEY required'); process.exit(1); }

const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

const HAIKU = 'claude-haiku-4-5-20251001';

async function callClaude(prompt) {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-api-key': API_KEY, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({ model: HAIKU, max_tokens: 2000, messages: [{ role: 'user', content: prompt }] }),
  });
  if (!res.ok) throw new Error(`Claude ${res.status}`);
  const data = await res.json();
  return data.content?.[0]?.text ?? '';
}

function extractJSON(text) {
  const m = text.match(/```json\s*([\s\S]*?)```/) ?? text.match(/(\{[\s\S]*\}|\[[\s\S]*\])/);
  if (!m) throw new Error('No JSON');
  return JSON.parse(m[1] ?? m[0]);
}

async function rewriteSteps(steps, title, cuisine) {
  const stepsText = steps.map((s, i) => `${i + 1}. ${s.instruction}`).join('\n');
  const prompt = `You are rewriting cooking instructions to avoid verbatim copying.
Recipe: "${title}"${cuisine ? ` (${cuisine})` : ''}

Rewrite each step below in your own words while:
- Keeping ALL quantities, temperatures, times, and techniques EXACTLY the same
- Keeping the same number of steps — do not merge or split steps
- Keeping the same order of operations
- Using clear, friendly cooking language
- Never adding new information or changing the method
- Never removing any instruction

Return ONLY a JSON array of strings, one per step, in the same order.
Steps to rewrite:
${stepsText}`;

  const raw = await callClaude(prompt);
  const rewritten = extractJSON(raw);
  if (!Array.isArray(rewritten) || rewritten.length !== steps.length) {
    throw new Error(`Got ${rewritten?.length} steps, expected ${steps.length}`);
  }
  return rewritten;
}

async function main() {
  const BATCH_SIZE = 10;
  let offset = 0;
  let total = 0;
  let success = 0;
  let failed = 0;

  while (true) {
    const { data: recipes, error } = await supabase
      .from('recipes')
      .select('id, title, cuisine')
      .not('source_url', 'is', null)
      .eq('steps_rewritten', false)
      .order('created_at', { ascending: true })
      .range(offset, offset + BATCH_SIZE - 1);

    if (error) { console.error('Query error:', error.message); break; }
    if (!recipes || recipes.length === 0) break;

    for (const recipe of recipes) {
      total++;
      try {
        // Fetch steps
        const { data: steps } = await supabase
          .from('recipe_steps')
          .select('id, step_number, instruction, timer_minutes, group_label')
          .eq('recipe_id', recipe.id)
          .order('step_number');

        if (!steps || steps.length === 0) {
          console.log(`  [skip] ${recipe.title} — no steps`);
          continue;
        }

        const rewritten = await rewriteSteps(steps, recipe.title, recipe.cuisine);

        // Update each step
        for (let i = 0; i < steps.length; i++) {
          await supabase
            .from('recipe_steps')
            .update({ instruction: rewritten[i] })
            .eq('id', steps[i].id);
        }

        await supabase
          .from('recipes')
          .update({ steps_rewritten: true, steps_rewritten_at: new Date().toISOString() })
          .eq('id', recipe.id);

        success++;
        console.log(`  [ok] ${recipe.title} (${steps.length} steps)`);
      } catch (err) {
        failed++;
        console.error(`  [fail] ${recipe.title}: ${err.message}`);
      }

      // Rate limit: 1 per second
      await new Promise((r) => setTimeout(r, 1000));
    }

    offset += BATCH_SIZE;
  }

  console.log(`\nDone: ${total} processed, ${success} rewritten, ${failed} failed`);
}

main().catch(console.error);
