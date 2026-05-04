#!/usr/bin/env node
/**
 * seed-cooking-knowledge.mjs
 *
 * Scrapes Wikipedia cooking technique articles via the official Wikipedia REST API
 * (no HTML scraping — clean plain text via their extracts API).
 * Sends content to Haiku to extract canonical timing data.
 * Stores results in cooking_action_timings table.
 *
 * Usage:
 *   node scripts/seed-cooking-knowledge.mjs
 *   node scripts/seed-cooking-knowledge.mjs --dry-run    # print extractions, don't save
 *   node scripts/seed-cooking-knowledge.mjs --technique searing  # single technique
 *
 * Required env vars:
 *   ANTHROPIC_API_KEY
 *   SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 */

import { createClient } from '@supabase/supabase-js';
import Anthropic from '@anthropic-ai/sdk';

const isDryRun = process.argv.includes('--dry-run');
const singleTechnique = process.argv.includes('--technique')
  ? process.argv[process.argv.indexOf('--technique') + 1]
  : null;

// Validate env
['ANTHROPIC_API_KEY', 'SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY'].forEach(key => {
  if (!process.env[key]) { console.error(`${key} required`); process.exit(1); }
});

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// ─── Technique articles to scrape ────────────────────────────────────────────
// Wikipedia article title → human label for logging
// Chosen for timing signal quality — articles that actually state durations
const TECHNIQUES = [
  // Heat techniques — stovetop
  { title: 'Searing',              label: 'sear' },
  { title: 'Sautéing',             label: 'sauté' },
  { title: 'Stir_frying',          label: 'stir-fry' },
  { title: 'Braising',             label: 'braise' },
  { title: 'Simmering',            label: 'simmer' },
  { title: 'Boiling',              label: 'boil' },
  { title: 'Blanching_(cooking)',  label: 'blanch' },
  { title: 'Poaching_(cooking)',   label: 'poach' },
  { title: 'Steaming',             label: 'steam' },
  { title: 'Deep_frying',          label: 'deep-fry' },
  { title: 'Pan_frying',           label: 'pan-fry' },
  { title: 'Reduction_(cooking)',  label: 'reduce' },
  { title: 'Caramelization',       label: 'caramelise' },
  { title: 'Deglazing_(cooking)',  label: 'deglaze' },
  { title: 'Rendering_(cooking)',  label: 'render' },
  { title: 'Sweating_(cooking)',   label: 'sweat' },

  // Heat techniques — oven
  { title: 'Roasting',             label: 'roast' },
  { title: 'Baking',               label: 'bake' },
  { title: 'Broiling',             label: 'broil' },
  { title: 'Grilling',             label: 'grill' },
  { title: 'Smoking_(cooking)',    label: 'smoke' },
  { title: 'Braising',             label: 'braise-oven' },

  // No-heat / time techniques
  { title: 'Marination',           label: 'marinate' },
  { title: 'Proofing_(baking_technique)', label: 'proof' },
  { title: 'Fermentation_in_food_processing', label: 'ferment' },
  { title: 'Curing_(food_preservation)', label: 'cure' },
  { title: 'Resting_(cooking)',    label: 'rest-meat' },

  // Prep techniques with timing
  { title: 'Tempering_(cooking)',  label: 'temper' },
  { title: 'Clarification_(cooking)', label: 'clarify' },
  { title: 'Emulsion',             label: 'emulsify' },
];

// ─── Wikipedia API ────────────────────────────────────────────────────────────
async function fetchWikipediaArticle(title) {
  const url = `https://en.wikipedia.org/w/api.php?` + new URLSearchParams({
    action: 'query',
    prop: 'extracts',
    explaintext: 'true',    // plain text, no HTML
    exsectionformat: 'plain',
    titles: title,
    format: 'json',
    origin: '*',
  });

  const res = await fetch(url, {
    headers: { 'User-Agent': 'ChefsBook-KnowledgeGraph/1.0 (cooking timing research)' }
  });

  if (!res.ok) throw new Error(`Wikipedia API error: ${res.status}`);

  const data = await res.json();
  const pages = data.query.pages;
  const page = Object.values(pages)[0];

  if (page.missing) throw new Error(`Article not found: ${title}`);

  // Trim to first 4000 chars — Haiku context efficient, timing info is usually early
  return page.extract?.slice(0, 4000) || '';
}

// ─── Haiku extraction ─────────────────────────────────────────────────────────
const EXTRACTION_PROMPT = `You are extracting cooking timing data from a Wikipedia article about a cooking technique.

Extract ALL timing information mentioned for DIFFERENT ingredient categories.
For each distinct combination of technique + ingredient type, create one entry.

Article technique: {technique}
Article text:
{text}

Return ONLY a JSON array. Each object must have exactly these fields:
{
  "canonical_key": "technique:ingredient_category" (or just "technique" if applies to all),
  "technique": "verb form e.g. sear, braise, simmer",
  "ingredient_category": "e.g. fish, beef, chicken, vegetables, dough, sauce — or null if generic",
  "duration_min": <integer minutes or null>,
  "duration_max": <integer minutes or null>,
  "is_passive": <true if cook can leave it, false if requires attention>,
  "uses_oven": <true/false>,
  "oven_temp_celsius": <integer or null>,
  "phase": <"prep" | "cook" | "rest">,
  "confidence": <"high" if explicit times stated, "medium" if ranges implied, "low" if vague>,
  "notes": "brief context e.g. 'for 2cm thick fillet' or 'until internal temp 165F'"
}

Rules:
- Convert Fahrenheit to Celsius for oven_temp_celsius
- duration_min/max in MINUTES (convert hours: 1.5 hours = 90 minutes)
- If article says "2-3 hours" use duration_min:120, duration_max:180
- is_passive: simmering/baking/resting/marinating = true. Searing/stirring/kneading = false
- Only include entries where the article actually states timing — skip vague entries
- Prefer specific entries (sear:fish) over generic (sear) when article differentiates
- Maximum 15 entries per article — focus on the clearest timing signals

Return ONLY the JSON array, no explanation, no markdown fences.`;

async function extractTimings(technique, text) {
  const prompt = EXTRACTION_PROMPT
    .replace('{technique}', technique)
    .replace('{text}', text);

  const response = await anthropic.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 1000,
    messages: [{ role: 'user', content: prompt }],
  });

  const raw = response.content[0]?.text?.trim() || '[]';

  // Strip markdown fences if Haiku adds them despite instructions
  const cleaned = raw.replace(/^```json?\n?/, '').replace(/\n?```$/, '').trim();

  try {
    const parsed = JSON.parse(cleaned);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    console.warn(`  [warn] JSON parse failed for ${technique} — skipping`);
    return [];
  }
}

// ─── Database upsert ──────────────────────────────────────────────────────────
async function upsertTimings(timings, source = 'wikipedia') {
  if (!timings.length) return 0;

  const rows = timings.map(t => ({
    canonical_key:       t.canonical_key,
    technique:           t.technique,
    ingredient_category: t.ingredient_category || null,
    duration_min:        t.duration_min || null,
    duration_max:        t.duration_max || null,
    is_passive:          t.is_passive ?? false,
    uses_oven:           t.uses_oven ?? false,
    oven_temp_celsius:   t.oven_temp_celsius || null,
    phase:               t.phase || 'cook',
    confidence:          t.confidence || 'medium',
    source,
    notes:               t.notes || null,
    updated_at:          new Date().toISOString(),
  }));

  const { data, error } = await supabase
    .from('cooking_action_timings')
    .upsert(rows, {
      onConflict: 'canonical_key',
      ignoreDuplicates: false,   // update if exists — Wikipedia data improves over time
    })
    .select('canonical_key');

  if (error) throw error;
  return data?.length || 0;
}

// ─── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  console.log(`\nSeeding cooking knowledge graph from Wikipedia...`);
  console.log(`Mode: ${isDryRun ? 'DRY RUN (no DB writes)' : 'LIVE'}\n`);

  const techniques = singleTechnique
    ? TECHNIQUES.filter(t => t.label.includes(singleTechnique))
    : TECHNIQUES;

  let totalExtracted = 0;
  let totalSaved = 0;
  let failed = 0;

  for (const { title, label } of techniques) {
    process.stdout.write(`  ${label.padEnd(16)} `);

    try {
      // 1. Fetch Wikipedia article
      const text = await fetchWikipediaArticle(title);
      if (!text) { console.log(`[skip] no content`); continue; }

      // 2. Extract timings with Haiku
      const timings = await extractTimings(label, text);
      totalExtracted += timings.length;

      if (!timings.length) {
        console.log(`[skip] no timing data extracted`);
        continue;
      }

      // 3. Log extractions
      const summary = timings
        .map(t => `${t.canonical_key}(${t.duration_min ?? '?'}-${t.duration_max ?? '?'}min)`)
        .join(', ');
      process.stdout.write(`[${timings.length} entries] ${summary}\n`);

      // 4. Save to DB (unless dry run)
      if (!isDryRun) {
        const saved = await upsertTimings(timings);
        totalSaved += saved;
      }

      // Rate limiting — Wikipedia + Haiku
      await new Promise(r => setTimeout(r, 1500));

    } catch (err) {
      console.log(`[fail] ${err.message}`);
      failed++;
      await new Promise(r => setTimeout(r, 3000)); // longer pause on error
    }
  }

  console.log(`\n${'─'.repeat(60)}`);
  console.log(`Techniques processed: ${techniques.length - failed}/${techniques.length}`);
  console.log(`Timing entries extracted: ${totalExtracted}`);
  console.log(`Saved to DB: ${isDryRun ? '0 (dry run)' : totalSaved}`);
  if (failed) console.log(`Failed: ${failed}`);

  if (!isDryRun && totalSaved > 0) {
    // Show what's now in the knowledge graph
    const { data } = await supabase
      .from('cooking_action_timings')
      .select('source, confidence, count:id')
      .select('source, confidence');

    console.log(`\nKnowledge graph now contains entries from Wikipedia.`);
    console.log(`Run the following to see the full distribution:`);
    console.log(`  SELECT source, confidence, COUNT(*) FROM cooking_action_timings GROUP BY source, confidence;`);
  }
}

main().catch(err => {
  console.error('\nFatal:', err.message);
  process.exit(1);
});
