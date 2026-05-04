#!/usr/bin/env node
/**
 * seed-cooking-knowledge.mjs
 *
 * Scrapes Wikipedia cooking technique articles via the official Wikipedia REST API.
 * Sends content to Haiku to extract canonical timing data.
 * Stores results in cooking_action_timings table.
 *
 * Usage:
 *   node scripts/seed-cooking-knowledge.mjs
 *   node scripts/seed-cooking-knowledge.mjs --dry-run    # print extractions, don't save
 *   node scripts/seed-cooking-knowledge.mjs --technique searing  # single technique
 *
 * Required env vars:
 *   ANTHROPIC_API_KEY (or EXPO_PUBLIC_ANTHROPIC_API_KEY)
 *   SUPABASE_URL (or NEXT_PUBLIC_SUPABASE_URL)
 *   SUPABASE_SERVICE_ROLE_KEY
 *
 * Note: Uses direct fetch() calls matching @chefsbook/ai and @chefsbook/db implementations.
 * This avoids TypeScript module resolution issues while maintaining equivalent functionality.
 */

import { createClient } from '@supabase/supabase-js';

const isDryRun = process.argv.includes('--dry-run');
const singleTechnique = process.argv.includes('--technique')
  ? process.argv[process.argv.indexOf('--technique') + 1]
  : null;

// Get API key (matches @chefsbook/ai getApiKey())
const getApiKey = () => {
  return process.env.ANTHROPIC_API_KEY || process.env.EXPO_PUBLIC_ANTHROPIC_API_KEY || '';
};

// Validate env
const apiKey = getApiKey();
if (!apiKey) {
  console.error('Error: ANTHROPIC_API_KEY environment variable is required');
  process.exit(1);
}

const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Error: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required');
  process.exit(1);
}

// Initialize Supabase admin client (equivalent to @chefsbook/db supabaseAdmin)
const supabaseAdmin = createClient(supabaseUrl, supabaseKey);

// ─── Technique articles to scrape ────────────────────────────────────────────
// Only the 20 techniques requested
const TECHNIQUES = [
  { title: 'Searing',              label: 'sear' },
  { title: 'Braising',             label: 'braise' },
  { title: 'Simmering',            label: 'simmer' },
  { title: 'Roasting',             label: 'roast' },
  { title: 'Baking',               label: 'bake' },
  { title: 'Blanching_(cooking)',  label: 'blanch' },
  { title: 'Poaching_(cooking)',   label: 'poach' },
  { title: 'Steaming',             label: 'steam' },
  { title: 'Stir_frying',          label: 'stir-fry' },
  { title: 'Caramelization',       label: 'caramelise' },
  { title: 'Reduction_(cooking)',  label: 'reduce' },
  { title: 'Marination',           label: 'marinate' },
  { title: 'Proofing_(baking_technique)', label: 'proof' },
  { title: 'Grilling',             label: 'grill' },
  { title: 'Smoking_(cooking)',    label: 'smoke' },
  { title: 'Sweating_(cooking)',   label: 'sweat' },
  { title: 'Rendering_(cooking)',  label: 'render' },
  { title: 'Deglazing_(cooking)',  label: 'deglaze' },
  { title: 'Boiling',              label: 'boil' },
  { title: 'Sautéing',             label: 'sauté' },
];

// ─── Wikipedia API with retry logic ──────────────────────────────────────────
async function fetchWikipediaArticle(title, maxRetries = 3) {
  const url = `https://en.wikipedia.org/w/api.php?` + new URLSearchParams({
    action: 'query',
    prop: 'extracts',
    explaintext: 'true',    // plain text, no HTML
    exsectionformat: 'plain',
    titles: title,
    format: 'json',
    origin: '*',
  });

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const res = await fetch(url, {
        headers: { 'User-Agent': 'ChefsBook-KnowledgeGraph/1.0 (cooking timing research)' }
      });

      if (res.status === 429) {
        // Rate limited - exponential backoff
        const delay = Math.pow(2, attempt) * 5000; // 5s, 10s, 20s
        process.stdout.write(`[rate limit, retry in ${delay/1000}s] `);
        await new Promise(r => setTimeout(r, delay));
        continue; // retry
      }

      if (!res.ok) throw new Error(`Wikipedia API error: ${res.status}`);

      const data = await res.json();
      const pages = data.query.pages;
      const page = Object.values(pages)[0];

      if (page.missing) throw new Error(`Article not found: ${title}`);

      // Trim to first 4000 chars — Haiku context efficient, timing info is usually early
      return page.extract?.slice(0, 4000) || '';

    } catch (err) {
      if (attempt === maxRetries - 1) throw err; // final attempt failed
      // Retry on network errors
      const delay = Math.pow(2, attempt) * 3000;
      process.stdout.write(`[error, retry in ${delay/1000}s] `);
      await new Promise(r => setTimeout(r, delay));
    }
  }
}

// ─── Haiku extraction (direct fetch matching @chefsbook/ai callClaude) ───────
const HAIKU = 'claude-haiku-4-5-20251001';
const API_URL = 'https://api.anthropic.com/v1/messages';

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

  // Direct fetch call matching @chefsbook/ai callClaude() implementation
  const response = await fetch(API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01'
    },
    body: JSON.stringify({
      model: HAIKU,
      max_tokens: 1000,
      messages: [{ role: 'user', content: prompt }]
    })
  });

  if (!response.ok) {
    const errorBody = await response.text().catch(() => 'Unable to read error');
    throw new Error(`Claude API error: ${response.status} - ${errorBody}`);
  }

  const data = await response.json();
  const raw = data.content[0]?.text?.trim() || '[]';

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

// ─── Database upsert (equivalent to @chefsbook/db supabaseAdmin) ─────────────
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

  const { data, error } = await supabaseAdmin
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
  console.log(`\n🌍 Seeding cooking knowledge graph from Wikipedia...`);
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

      // Rate limiting — Wikipedia + Haiku (5s to avoid Wikipedia 429s)
      await new Promise(r => setTimeout(r, 5000));

    } catch (err) {
      console.log(`[fail] ${err.message}`);
      failed++;
      await new Promise(r => setTimeout(r, 3000)); // longer pause on error
    }
  }

  console.log(`\n${'─'.repeat(60)}`);
  console.log(`✅ Techniques processed: ${techniques.length - failed}/${techniques.length}`);
  console.log(`📊 Timing entries extracted: ${totalExtracted}`);
  console.log(`💾 Saved to DB: ${isDryRun ? '0 (dry run)' : totalSaved}`);
  if (failed) console.log(`❌ Failed: ${failed}`);

  if (!isDryRun && totalSaved > 0) {
    console.log(`\n🎯 Knowledge graph populated from Wikipedia.`);
    console.log(`Run the following to see the distribution:`);
    console.log(`  SELECT source, confidence, COUNT(*) FROM cooking_action_timings GROUP BY source, confidence;`);
  }
}

main().catch(err => {
  console.error('\n❌ Fatal:', err.message);
  process.exit(1);
});
