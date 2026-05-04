#!/usr/bin/env node
import { createClient } from '@supabase/supabase-js';
import Anthropic from '@anthropic-ai/sdk';
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

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

const HAIKU_PROMPT = `You are a culinary technique classifier.

Given this recipe step instruction, identify:
1. The PRIMARY cooking technique (one word: simmer, roast, sauté, blanch,
   marinate, fry, bake, grill, steam, poach, braise, smoke, rest, reduce,
   deglaze, caramelize, stir-fry, render, boil, whisk, fold, knead, proof,
   chill, freeze, strain, blend, chop, slice, dice, season, mix, combine,
   coat, sear, char, flambé, cure, pickle, ferment, infuse, emulsify, temper)
2. The PRIMARY ingredient category being acted on (one or two words):
   beef, chicken, pork, lamb, fish, shellfish, eggs, dairy, vegetables,
   onions, garlic, pasta, rice, bread, dough, sauce, stock, oil, spices,
   fruit, pastry, chocolate, sugar, flour — or null if the technique is
   preparation-only (e.g. "combine dry ingredients")

Return ONLY valid JSON: {"technique":"...","ingredient_category":"..."}
technique must be a single lowercase word from the list above or null.
ingredient_category must be one or two lowercase words or null.

Step: "{STEP_INSTRUCTION}"`;

async function classifyStep(instruction) {
  const prompt = HAIKU_PROMPT.replace('{STEP_INSTRUCTION}', instruction.replace(/"/g, '\\"'));

  const message = await anthropic.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 100,
    messages: [{ role: 'user', content: prompt }],
  });

  const text = message.content[0].text;

  // Extract JSON from markdown code blocks if present
  const jsonMatch = text.match(/```json\s*([\s\S]*?)```/) || text.match(/(\{[\s\S]*\})/);
  const jsonText = jsonMatch ? (jsonMatch[1] || jsonMatch[0]) : text;

  return JSON.parse(jsonText);
}

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const limitIndex = args.indexOf('--limit');
  const limit = limitIndex !== -1 ? parseInt(args[limitIndex + 1], 10) : null;

  console.log('🔍 Fetching unclassified timed steps...\n');

  let query = supabase
    .from('recipe_steps')
    .select('id, instruction')
    .not('timings_inferred_at', 'is', null)
    .is('classified_at', null)
    .order('timings_inferred_at', { ascending: true });

  if (limit) {
    query = query.limit(limit);
  }

  const { data: steps, error } = await query;

  if (error) {
    console.error('❌ Error fetching steps:', error.message);
    process.exit(1);
  }

  if (!steps || steps.length === 0) {
    console.log('✅ No unclassified steps found.');
    process.exit(0);
  }

  console.log(`Found ${steps.length} unclassified steps.\n`);

  if (dryRun) {
    console.log('🔎 DRY RUN - showing first 5 steps:\n');
    for (const step of steps.slice(0, 5)) {
      console.log(`[${step.id}] ${step.instruction.substring(0, 80)}...`);
    }
    console.log(`\n(${steps.length - 5} more steps would be classified)`);
    process.exit(0);
  }

  let classified = 0;
  let skipped = 0;
  let failed = 0;

  const BATCH_SIZE = 10;
  const DELAY_MS = 1000;

  for (let i = 0; i < steps.length; i += BATCH_SIZE) {
    const batch = steps.slice(i, i + BATCH_SIZE);

    for (const step of batch) {
      try {
        const result = await classifyStep(step.instruction);

        const { error: updateError } = await supabase
          .from('recipe_steps')
          .update({
            technique: result.technique || null,
            ingredient_category: result.ingredient_category || null,
            classified_at: new Date().toISOString(),
          })
          .eq('id', step.id);

        if (updateError) {
          console.error(`❌ [${i + 1}/${steps.length}] UPDATE FAILED:`, updateError.message);
          failed++;
        } else {
          const label = result.technique
            ? `${result.technique}${result.ingredient_category ? ':' + result.ingredient_category : ''}`
            : 'SKIPPED (no technique)';
          console.log(`✅ [${i + 1}/${steps.length}] CLASSIFIED ${label}`);
          classified++;
        }
      } catch (err) {
        console.error(`⚠️  [${i + 1}/${steps.length}] API ERROR, marking as skipped:`, err.message);

        // Mark as classified with null values so we don't retry
        await supabase
          .from('recipe_steps')
          .update({
            technique: null,
            ingredient_category: null,
            classified_at: new Date().toISOString(),
          })
          .eq('id', step.id);

        skipped++;
      }
    }

    // Delay between batches (but not after the last batch)
    if (i + BATCH_SIZE < steps.length) {
      await sleep(DELAY_MS);
    }
  }

  console.log(`\n━━━ Classification Complete ━━━`);
  console.log(`✅ Classified: ${classified}`);
  console.log(`⚠️  Skipped:    ${skipped}`);
  console.log(`❌ Failed:     ${failed}`);
  console.log(`📊 Total:      ${steps.length}`);
}

main().catch(console.error);
