#!/usr/bin/env node
/**
 * Backfill missing descriptions for recipes using Claude Haiku.
 * Generates a 1-2 sentence description from title + cuisine + ingredients.
 * Cost: ~$0.0002 per recipe (Haiku, tiny prompt).
 *
 * Usage: node scripts/backfill-descriptions.mjs
 * Requires: SUPABASE_SERVICE_ROLE_KEY, ANTHROPIC_API_KEY in env
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL ?? 'http://100.110.47.62:8000';
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';
const API_KEY = process.env.ANTHROPIC_API_KEY ?? process.env.EXPO_PUBLIC_ANTHROPIC_API_KEY ?? '';

if (!SERVICE_KEY) { console.error('Missing SUPABASE_SERVICE_ROLE_KEY'); process.exit(1); }
if (!API_KEY) { console.error('Missing ANTHROPIC_API_KEY'); process.exit(1); }

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { autoRefreshToken: false, persistSession: false } });

async function generateDescription(title, cuisine, ingredients) {
  const ingredientList = ingredients.slice(0, 5).join(', ');
  const cuisineNote = cuisine ? ` (${cuisine} cuisine)` : '';
  const prompt = `Write a single sentence description (max 30 words) for a recipe called "${title}"${cuisineNote} that includes ${ingredientList}. Be specific and appetizing. Return only the description, no quotes.`;

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': API_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 100,
      messages: [{ role: 'user', content: prompt }],
    }),
  });
  const data = await res.json();
  return (data?.content?.[0]?.text ?? '').trim().replace(/^["']|["']$/g, '');
}

async function main() {
  // Find recipes with missing descriptions
  const { data: recipes } = await supabase
    .from('recipes')
    .select('id, title, cuisine')
    .or('description.is.null,description.eq.')
    .order('created_at', { ascending: true });

  if (!recipes || recipes.length === 0) {
    console.log('No recipes with missing descriptions.');
    return;
  }

  console.log(`Found ${recipes.length} recipes with missing descriptions.\n`);

  let success = 0;
  let failed = 0;

  for (let i = 0; i < recipes.length; i++) {
    const r = recipes[i];
    try {
      // Fetch ingredients for this recipe
      const { data: ings } = await supabase
        .from('recipe_ingredients')
        .select('ingredient')
        .eq('recipe_id', r.id)
        .order('sort_order')
        .limit(5);
      const ingredientNames = (ings ?? []).map(ig => ig.ingredient);

      const desc = await generateDescription(r.title, r.cuisine, ingredientNames);
      if (!desc) throw new Error('Empty description returned');

      await supabase.from('recipes').update({ description: desc }).eq('id', r.id);
      console.log(`[${i + 1}/${recipes.length}] ✓ ${r.title} → "${desc}"`);
      success++;
    } catch (err) {
      console.error(`[${i + 1}/${recipes.length}] ✗ ${r.title} — ${err.message}`);
      failed++;
    }
    // Rate limit: 1 per second
    if (i < recipes.length - 1) await new Promise(r => setTimeout(r, 1000));
  }

  console.log(`\nBackfill complete: ${success} succeeded, ${failed} failed.`);
}

main().catch(console.error);
