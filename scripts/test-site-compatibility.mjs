#!/usr/bin/env node
/**
 * Recipe-site compatibility crawl.
 *
 * Fetches the curated test URL for every site in packages/ai/src/siteList.ts,
 * extracts JSON-LD where available, runs the same completeness heuristics as the
 * live /api/admin/test-sites endpoint, assigns a 1–5 rating, and upserts the
 * results to import_site_tracker.
 *
 * Usage on RPi5:
 *   SUPABASE_SERVICE_ROLE_KEY=<key> node scripts/test-site-compatibility.mjs
 *
 * Env:
 *   SUPABASE_URL (default http://kong:8000)
 *   SUPABASE_SERVICE_ROLE_KEY (required)
 *   SITE_DELAY_MS (default 5000)
 *   SITE_LIMIT (optional — test only first N sites)
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createClient } from '@supabase/supabase-js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const SITE_LIST_PATH = path.join(ROOT, 'packages/ai/src/siteList.ts');

const SUPABASE_URL = process.env.SUPABASE_URL ?? 'http://localhost:8000';
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const DELAY_MS = Number(process.env.SITE_DELAY_MS ?? 5000);
const LIMIT = process.env.SITE_LIMIT ? Number(process.env.SITE_LIMIT) : Infinity;

if (!SERVICE_KEY) {
  console.error('SUPABASE_SERVICE_ROLE_KEY is required');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

const UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 13_0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36';

function parseSiteList(source) {
  const lines = source.split(/\r?\n/);
  const sites = [];
  const rx = /\{\s*domain:\s*'([^']+)'\s*,\s*testUrl:\s*'([^']+)'\s*,\s*region:\s*'([^']+)'\s*,\s*language:\s*'([^']+)'(?:\s*,\s*cuisine:\s*'([^']+)')?\s*\}/;
  for (const line of lines) {
    const m = line.match(rx);
    if (!m) continue;
    sites.push({ domain: m[1], testUrl: m[2], region: m[3], language: m[4], cuisine: m[5] ?? null });
  }
  return sites;
}

function extractJsonLdRecipe(html) {
  const scripts = [...html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)];
  for (const match of scripts) {
    const raw = match[1].trim();
    let parsed;
    try {
      parsed = JSON.parse(raw);
    } catch {
      continue;
    }
    const candidates = Array.isArray(parsed) ? parsed : parsed['@graph'] ?? [parsed];
    for (const item of candidates) {
      if (!item) continue;
      const type = item['@type'];
      const types = Array.isArray(type) ? type : [type];
      if (types.includes('Recipe')) return item;
    }
  }
  return null;
}

function countIngredientsWithQty(recipe) {
  const list = recipe?.recipeIngredient ?? recipe?.ingredients ?? [];
  if (!Array.isArray(list)) return { total: 0, withQty: 0 };
  let withQty = 0;
  for (const ing of list) {
    if (typeof ing !== 'string') continue;
    if (/\d/.test(ing)) withQty += 1;
  }
  return { total: list.length, withQty };
}

function countSteps(recipe) {
  const inst = recipe?.recipeInstructions;
  if (!inst) return 0;
  if (typeof inst === 'string') return inst.split(/\n|\./).filter((s) => s.trim().length > 20).length;
  if (Array.isArray(inst)) {
    let n = 0;
    for (const step of inst) {
      if (typeof step === 'string' && step.length > 10) n += 1;
      else if (step?.['@type'] === 'HowToStep' && (step.text || step.name)) n += 1;
      else if (step?.['@type'] === 'HowToSection' && Array.isArray(step.itemListElement)) n += step.itemListElement.length;
    }
    return n;
  }
  return 0;
}

function rateRecipe(recipe) {
  if (!recipe) return { rating: 1, missing: ['json-ld not found'] };
  const missing = [];
  const title = recipe.name ?? recipe.headline;
  const description = recipe.description;
  const { total, withQty } = countIngredientsWithQty(recipe);
  const stepCount = countSteps(recipe);

  if (!title) missing.push('title');
  if (!description) missing.push('description');
  if (total < 2) missing.push('ingredients');
  if (withQty < Math.min(2, total)) missing.push('quantities');
  if (stepCount < 1) missing.push('steps');

  let rating;
  if (!title || total === 0 || stepCount === 0) rating = 1;
  else if (missing.includes('ingredients') || missing.includes('steps')) rating = 2;
  else if (missing.includes('description') || missing.includes('quantities')) rating = 3;
  else if (total >= 5 && withQty >= 5 && stepCount >= 3 && description && title) rating = 5;
  else rating = 4;

  return { rating, missing, ingredientCount: total, ingredientsWithQty: withQty, stepCount };
}

async function fetchHtml(url) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 20000);
  try {
    const res = await fetch(url, {
      headers: {
        'user-agent': UA,
        accept: 'text/html,application/xhtml+xml',
        'accept-language': 'en-US,en;q=0.9,fr;q=0.6,de;q=0.5,it;q=0.5,es;q=0.5',
      },
      redirect: 'follow',
      signal: ctrl.signal,
    });
    if (!res.ok) return { ok: false, status: res.status, html: '' };
    const html = await res.text();
    return { ok: true, status: res.status, html };
  } catch (e) {
    return { ok: false, status: 0, html: '', error: String(e?.message ?? e) };
  } finally {
    clearTimeout(timer);
  }
}

async function testSite(site) {
  const fetchResult = await fetchHtml(site.testUrl);
  if (!fetchResult.ok) {
    return {
      ...site,
      rating: 1,
      missing: [`fetch failed (${fetchResult.status || 'network'})`],
      notes: fetchResult.error ?? `HTTP ${fetchResult.status}`,
      ingredientCount: 0,
      stepCount: 0,
    };
  }
  const recipe = extractJsonLdRecipe(fetchResult.html);
  const rated = rateRecipe(recipe);
  return {
    ...site,
    ...rated,
    notes: recipe ? null : 'no JSON-LD Recipe',
  };
}

async function upsertTracker(result) {
  const { data: existing } = await supabase
    .from('import_site_tracker')
    .select('id, total_attempts, successful_attempts, failure_taxonomy, sample_failing_urls')
    .eq('domain', result.domain)
    .maybeSingle();

  const success = result.rating >= 3;
  const taxonomy = { ...(existing?.failure_taxonomy ?? {}) };
  for (const m of result.missing ?? []) taxonomy[`missing_${m.replace(/ /g, '_')}`] = (taxonomy[m] ?? 0) + 1;
  const sampleFailing = existing?.sample_failing_urls ?? [];
  if (!success) {
    sampleFailing.unshift(result.testUrl);
    sampleFailing.splice(5);
  }

  const payload = {
    domain: result.domain,
    rating: result.rating,
    status: result.rating >= 4 ? 'working' : result.rating === 3 ? 'partial' : 'broken',
    last_auto_tested_at: new Date().toISOString(),
    failure_taxonomy: taxonomy,
    sample_failing_urls: sampleFailing,
    notes: [
      result.notes,
      `region=${result.region}`,
      `language=${result.language}`,
      result.cuisine ? `cuisine=${result.cuisine}` : null,
      `ingredients=${result.ingredientCount ?? 0}`,
      `steps=${result.stepCount ?? 0}`,
    ].filter(Boolean).join(' · '),
  };

  if (existing) {
    await supabase
      .from('import_site_tracker')
      .update({
        ...payload,
        total_attempts: (existing.total_attempts ?? 0) + 1,
        successful_attempts: (existing.successful_attempts ?? 0) + (success ? 1 : 0),
      })
      .eq('id', existing.id);
  } else {
    await supabase.from('import_site_tracker').insert({
      ...payload,
      total_attempts: 1,
      successful_attempts: success ? 1 : 0,
      auto_test_enabled: true,
    });
  }
}

async function main() {
  const source = fs.readFileSync(SITE_LIST_PATH, 'utf8');
  const sites = parseSiteList(source).slice(0, LIMIT);
  console.log(`[crawl] ${sites.length} sites · ${DELAY_MS}ms delay · ≈${Math.round((sites.length * DELAY_MS) / 60000)} min`);

  const results = [];
  for (let i = 0; i < sites.length; i++) {
    const s = sites[i];
    const start = Date.now();
    const result = await testSite(s);
    results.push(result);
    const line = `[${String(i + 1).padStart(3)}/${sites.length}] ${result.rating === 5 ? '⭐⭐⭐⭐⭐' : result.rating === 4 ? '⭐⭐⭐⭐·' : result.rating === 3 ? '⭐⭐⭐··' : result.rating === 2 ? '⭐⭐···' : '⭐····'} ${s.domain.padEnd(30)} ${s.region}/${s.language} ${result.missing?.length ? '(' + result.missing.join(',') + ')' : ''}`;
    console.log(line);
    try { await upsertTracker(result); } catch (e) { console.error('  upsert failed:', e.message); }
    const elapsed = Date.now() - start;
    if (i < sites.length - 1) {
      const wait = Math.max(0, DELAY_MS - elapsed);
      if (wait) await new Promise((r) => setTimeout(r, wait));
    }
  }

  // Write results JSON for the report generator
  fs.writeFileSync(
    path.join(ROOT, 'scripts/site-compatibility-results.json'),
    JSON.stringify(results, null, 2),
  );

  // Summary
  const byRating = { 5: [], 4: [], 3: [], 2: [], 1: [] };
  for (const r of results) byRating[r.rating].push(r);
  console.log('\n=== SUMMARY ===');
  console.log(`⭐⭐⭐⭐⭐ 5: ${byRating[5].length}`);
  console.log(`⭐⭐⭐⭐· 4: ${byRating[4].length}`);
  console.log(`⭐⭐⭐·· 3: ${byRating[3].length}`);
  console.log(`⭐⭐··· 2: ${byRating[2].length}`);
  console.log(`⭐···· 1: ${byRating[1].length}`);
  console.log(`compat rate: ${Math.round((results.filter((r) => r.rating >= 3).length / results.length) * 100)}%`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
