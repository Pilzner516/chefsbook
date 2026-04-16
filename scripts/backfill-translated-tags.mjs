#!/usr/bin/env node
/**
 * Backfill: translate tags on recipes that were imported from non-English sources.
 * Only touches recipes where translated_from IS NOT NULL and tags contain non-English text.
 *
 * Usage: node scripts/backfill-translated-tags.mjs
 * Reads env from apps/web/.env.local
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { resolve } from 'path';

function loadEnvFile() {
  try {
    const envPath = resolve(process.cwd(), 'apps/web/.env.local');
    const content = readFileSync(envPath, 'utf-8');
    for (const line of content.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eqIdx = trimmed.indexOf('=');
      if (eqIdx < 0) continue;
      const key = trimmed.slice(0, eqIdx).trim();
      const val = trimmed.slice(eqIdx + 1).trim();
      if (!process.env[key]) process.env[key] = val;
    }
  } catch { /* no .env.local */ }
}
loadEnvFile();

const SUPABASE_URL = process.env.SUPABASE_URL || 'http://localhost:8000';
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
    body: JSON.stringify({ model: HAIKU, max_tokens: 500, messages: [{ role: 'user', content: prompt }] }),
  });
  if (!res.ok) {
    const errBody = await res.text().catch(() => '');
    throw new Error(`Claude ${res.status}: ${errBody.slice(0, 200)}`);
  }
  const data = await res.json();
  return data.content?.[0]?.text ?? '';
}

// System/domain tags that should NOT be translated
const SYSTEM_TAGS = new Set(['ChefsBook', 'ChefsBook-v2', '_incomplete', '_unresolved']);
function isSystemTag(tag) {
  return SYSTEM_TAGS.has(tag) || tag.startsWith('_') || /\.(com|org|net|it|de|fr|es|nl|no|dk|pl)$/.test(tag);
}

// Simple heuristic: does this tag look non-English?
function looksNonEnglish(tag) {
  return /[àâçéèêëîïôùûüÿæœáéíóúñ¿¡äöüßãõ]/.test(tag) ||
    /\b(de|del|con|para|por|los|las|una|des|les|dans|avec|pour|della|delle|nel|nella|und|mit|für|ein)\b/i.test(tag);
}

async function main() {
  // Find recipes with translated_from set (meaning they were translated from another language)
  const { data: recipes, error } = await supabase
    .from('recipes')
    .select('id, title, tags, translated_from, source_language')
    .not('translated_from', 'is', null)
    .not('tags', 'is', null);

  if (error) { console.error('Query error:', error.message); process.exit(1); }
  if (!recipes || recipes.length === 0) { console.log('No translated recipes found.'); return; }

  console.log(`Found ${recipes.length} translated recipes. Checking tags...\n`);

  let updated = 0;
  let skipped = 0;
  let failed = 0;

  for (const recipe of recipes) {
    const tags = recipe.tags ?? [];
    const userTags = tags.filter(t => !isSystemTag(t));
    const nonEnglishTags = userTags.filter(looksNonEnglish);

    if (nonEnglishTags.length === 0) {
      console.log(`  [skip] "${recipe.title}" — tags already look English`);
      skipped++;
      continue;
    }

    console.log(`  [translate] "${recipe.title}" — ${nonEnglishTags.length} non-English tags: ${nonEnglishTags.join(', ')}`);

    try {
      const prompt = `Translate these recipe tags to English. Return ONLY a JSON array of lowercase English tags. Keep them short (1-3 words each). Tags to translate:\n${nonEnglishTags.map((t, i) => `${i + 1}. ${t}`).join('\n')}`;
      const raw = await callClaude(prompt);
      const match = raw.match(/\[[\s\S]*\]/);
      if (!match) throw new Error('No JSON array in response');
      const translated = JSON.parse(match[0]);

      if (!Array.isArray(translated) || translated.length === 0) throw new Error('Empty result');

      // Replace non-English user tags with translated ones, keep system tags
      const systemTags = tags.filter(isSystemTag);
      const englishUserTags = userTags.filter(t => !looksNonEnglish(t));
      const newTags = [...systemTags, ...englishUserTags, ...translated.map(t => String(t).toLowerCase().trim())];

      await supabase.from('recipes').update({ tags: newTags }).eq('id', recipe.id);
      updated++;
      console.log(`           → ${translated.join(', ')}`);
    } catch (err) {
      failed++;
      console.error(`           FAIL: ${err.message}`);
      if (err.message?.includes('credit balance') || err.message?.includes('401')) {
        console.error('\nAborting: API key issue.');
        break;
      }
    }

    await new Promise(r => setTimeout(r, 1000));
  }

  console.log(`\nDone: ${updated} updated, ${skipped} skipped, ${failed} failed`);
}

main().catch(console.error);
