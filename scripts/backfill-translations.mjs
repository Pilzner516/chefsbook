#!/usr/bin/env node
/**
 * Backfill title-only translations for all recipes that don't have any translations yet.
 * Uses HAIKU model — ~$0.0002 per recipe (all 4 languages in one call).
 *
 * Usage: node scripts/backfill-translations.mjs
 * Requires: SUPABASE_SERVICE_ROLE_KEY, NEXT_PUBLIC_SUPABASE_URL, ANTHROPIC_API_KEY in env
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL ?? 'http://100.110.47.62:8000';
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';
const API_KEY = process.env.ANTHROPIC_API_KEY ?? process.env.EXPO_PUBLIC_ANTHROPIC_API_KEY ?? '';

if (!SERVICE_KEY) { console.error('Missing SUPABASE_SERVICE_ROLE_KEY'); process.exit(1); }
if (!API_KEY) { console.error('Missing ANTHROPIC_API_KEY'); process.exit(1); }

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { autoRefreshToken: false, persistSession: false } });

async function translateTitle(title) {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': API_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 200,
      messages: [{ role: 'user', content: `Translate this recipe title into French, Spanish, Italian, and German.\nReturn ONLY a JSON object with keys fr, es, it, de and the translated titles as values. No other text.\n\nTitle: "${title}"` }],
    }),
  });
  const data = await res.json();
  const text = data?.content?.[0]?.text ?? '';
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) throw new Error('No JSON in response: ' + text.slice(0, 100));
  return JSON.parse(match[0]);
}

async function main() {
  // Get all recipe IDs that already have translations
  const { data: existingRows } = await supabase.from('recipe_translations').select('recipe_id');
  const translatedIds = new Set((existingRows ?? []).map(r => r.recipe_id));

  // Get all recipes
  const { data: recipes } = await supabase.from('recipes').select('id, title').order('created_at', { ascending: true });
  const untranslated = (recipes ?? []).filter(r => !translatedIds.has(r.id));

  console.log(`Total recipes: ${recipes?.length ?? 0}`);
  console.log(`Already translated: ${translatedIds.size}`);
  console.log(`To backfill: ${untranslated.length}`);

  for (let i = 0; i < untranslated.length; i++) {
    const r = untranslated[i];
    try {
      const titles = await translateTitle(r.title);
      const rows = Object.entries(titles)
        .filter(([lang]) => ['fr', 'es', 'it', 'de'].includes(lang))
        .map(([lang, title]) => ({
          recipe_id: r.id,
          language: lang,
          translated_title: title,
          is_title_only: true,
          updated_at: new Date().toISOString(),
        }));
      for (const row of rows) {
        await supabase.from('recipe_translations').upsert(row, { onConflict: 'recipe_id,language', ignoreDuplicates: true });
      }
      console.log(`[${i + 1}/${untranslated.length}] ${r.title} → ${Object.values(titles).join(' | ')}`);
    } catch (err) {
      console.error(`[${i + 1}/${untranslated.length}] FAILED: ${r.title} — ${err.message}`);
    }
    // Rate limit: 1 per second
    if (i < untranslated.length - 1) await new Promise(r => setTimeout(r, 1000));
  }

  console.log('\nBackfill complete.');
}

main().catch(console.error);
