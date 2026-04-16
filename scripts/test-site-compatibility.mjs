#!/usr/bin/env node
/**
 * Recipe-site compatibility crawl — v3 (session 154)
 *
 * v3 improvements:
 *   - Passes userLanguage:'en' so non-English recipes are translated at import
 *   - Tags saved recipes as ChefsBook-v2 (not ChefsBook — those were deleted)
 *   - Blocked sites (403/429/0 after all retries) get NULL rating + needs_extension note
 *   - --targets flag runs only the 35 priority sites
 *   - Saves source_language + translated_from on recipes
 *
 * Usage on RPi5:
 *   SUPABASE_URL=http://localhost:8000 \
 *   SUPABASE_SERVICE_ROLE_KEY=<key> \
 *   IMPORT_ENDPOINT=http://localhost:3000/api/import/url \
 *   SAVE_USER_ID=b589743b-99bd-4f55-983a-c31f5167c425 \
 *   node scripts/test-site-compatibility.mjs --targets
 *
 * Env:
 *   SITE_DELAY_MS (default 10000)
 *   SITE_LIMIT (optional)
 *   SAVE_RECIPES (default "1" — set "0" to skip saving)
 *
 * Flags:
 *   --targets   Only run the 35 priority sites (Tier 1 + Tier 2 + Tier 3)
 *   --all       Run all 218 sites (default if no flag)
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
const IMPORT_ENDPOINT = process.env.IMPORT_ENDPOINT ?? 'http://localhost:3000/api/import/url';
const SAVE_USER_ID = process.env.SAVE_USER_ID ?? 'b589743b-99bd-4f55-983a-c31f5167c425';
const SAVE_RECIPES = (process.env.SAVE_RECIPES ?? '1') === '1';
const DELAY_MS = Number(process.env.SITE_DELAY_MS ?? 10000);
const LIMIT = process.env.SITE_LIMIT ? Number(process.env.SITE_LIMIT) : Infinity;
const USE_TARGETS = process.argv.includes('--targets');

// 35 priority sites for targeted recrawl
const TARGET_DOMAINS = new Set([
  // Tier 1 — previously rescued via homepage discovery
  'barefootcontessa.com', 'thepioneerwoman.com', 'delish.com', 'saveur.com',
  'healthyrecipes101.com', 'lacucinaitaliana.it', 'pequerecetas.com',
  'bonappetit.com', 'pinchofyum.com', 'sallysbakingaddiction.com',
  'kingarthurbaking.com', 'loveandlemons.com', 'tasteofhome.com', 'bettycrocker.com',
  // Tier 2 — Cloudflare-blocked, needs extension
  'allrecipes.com', 'bbcgoodfood.com', 'jamieoliver.com', 'seriouseats.com',
  'foodnetwork.com', 'eatingwell.com', 'marthastewart.com',
  // Tier 3 — International with translation
  'marmiton.org', 'chefkoch.de', 'giallozafferano.it', 'matprat.no',
  'valdemarsro.dk', 'allerhande.nl', 'kwestiasmaku.com',
  // Bonus: known good US sites
  'alexandracooks.com', 'momsdish.com', 'rasamalaysia.com',
  'budgetbytes.com', 'cookieandkate.com', 'minimalistbaker.com', 'smittenkitchen.com',
]);

if (!SERVICE_KEY) {
  console.error('SUPABASE_SERVICE_ROLE_KEY is required');
  process.exit(1);
}
if (SAVE_RECIPES && !SAVE_USER_ID) {
  console.error('SAVE_USER_ID is required when SAVE_RECIPES=1');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

const USER_AGENTS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
  'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
];

// ------------------------------------------------------------------
// Parse siteList.ts
// ------------------------------------------------------------------
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

// ------------------------------------------------------------------
// Fetch with UA rotation
// ------------------------------------------------------------------
async function fetchOnce(url, ua) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 20000);
  try {
    const res = await fetch(url, {
      headers: {
        'user-agent': ua,
        accept: 'text/html,application/xhtml+xml',
        'accept-language': 'en-US,en;q=0.9,fr;q=0.7,de;q=0.6,it;q=0.6,es;q=0.6',
      },
      redirect: 'follow',
      signal: ctrl.signal,
    });
    const html = res.ok ? await res.text() : '';
    return { ok: res.ok, status: res.status, html };
  } catch (e) {
    return { ok: false, status: 0, html: '', error: String(e?.message ?? e) };
  } finally {
    clearTimeout(timer);
  }
}

async function fetchWithRetry(url) {
  let last = { ok: false, status: 0, html: '' };
  for (const ua of USER_AGENTS) {
    const r = await fetchOnce(url, ua);
    if (r.ok) return { ...r, ua };
    last = { ...r, ua };
    if (![403, 404, 429, 0].includes(r.status)) break;
  }
  return last;
}

// ------------------------------------------------------------------
// Homepage recipe-link discovery
// ------------------------------------------------------------------
const RECIPE_PATTERNS = [
  /href=["']([^"']*\/recipes?\/[a-z0-9][^"']{4,})["']/gi,
  /href=["']([^"']*\/recette[s]?\/[a-z0-9][^"']{4,})["']/gi,
  /href=["']([^"']*\/rezept[e]?\/[a-z0-9][^"']{4,})["']/gi,
  /href=["']([^"']*\/ricett[ae]\/[a-z0-9][^"']{4,})["']/gi,
  /href=["']([^"']*\/receta[s]?\/[a-z0-9][^"']{4,})["']/gi,
  /href=["']([^"']*\/przepis[y]?\/[a-z0-9][^"']{4,})["']/gi,
  /href=["']([^"']*\/recept[yu]?\/[a-z0-9][^"']{4,})["']/gi,
  /href=["']([^"']*\/oppskrift[er]?\/[a-z0-9][^"']{4,})["']/gi,
  /href=["']([^"']*\/opskrift[er]?\/[a-z0-9][^"']{4,})["']/gi,
  /href=["']([^"']*\/syntagi[s]?\/[a-z0-9][^"']{4,})["']/gi,
];

async function findRecipeUrlOnHomepage(domain) {
  const homepages = [`https://www.${domain}`, `https://${domain}`];
  for (const home of homepages) {
    const res = await fetchWithRetry(home);
    if (!res.ok || !res.html) continue;
    for (const rx of RECIPE_PATTERNS) {
      rx.lastIndex = 0;
      const matches = [...res.html.matchAll(rx)].map((m) => m[1]).filter(Boolean);
      // Prefer URLs that look like actual recipe detail pages (not category landings)
      const candidate = matches.find((u) => {
        const path = u.replace(/https?:\/\/[^/]+/, '');
        return path.split('/').filter(Boolean).length >= 2 && !/\/(category|tag|page)\//.test(path);
      }) ?? matches[0];
      if (candidate) {
        return candidate.startsWith('http')
          ? candidate
          : `https://www.${domain}${candidate.startsWith('/') ? '' : '/'}${candidate}`;
      }
    }
  }
  return null;
}

// ------------------------------------------------------------------
// Import via deployed /api/import/url (uses the real pipeline + fix)
// ------------------------------------------------------------------
async function callImporter(url) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 90000);
  try {
    const res = await fetch(IMPORT_ENDPOINT, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ url, userLanguage: 'en' }),
      signal: ctrl.signal,
    });
    const body = await res.json();
    return { ok: res.ok, status: res.status, body };
  } catch (e) {
    return { ok: false, status: 0, body: { error: String(e?.message ?? e) } };
  } finally {
    clearTimeout(timer);
  }
}

// ------------------------------------------------------------------
// Rating based on actual extracted content
// ------------------------------------------------------------------
function rateImport(recipe) {
  if (!recipe || !recipe.title) return { rating: 1, reason: 'no title' };
  const ingredients = recipe.ingredients ?? [];
  const withQty = ingredients.filter((i) => i.quantity != null && i.unit).length;
  const steps = recipe.steps ?? [];
  const hasDesc = !!recipe.description;

  if (ingredients.length >= 3 && withQty >= 3 && steps.length >= 2 && hasDesc) {
    return { rating: 5, reason: 'complete' };
  }
  if (ingredients.length >= 2 && steps.length >= 1) return { rating: 4, reason: 'good' };
  if (ingredients.length >= 1 || steps.length >= 1) return { rating: 3, reason: 'partial' };
  if (hasDesc) return { rating: 2, reason: 'title+desc only' };
  return { rating: 1, reason: 'title only' };
}

// ------------------------------------------------------------------
// Save a recipe under pilzner
// ------------------------------------------------------------------
async function saveRecipe(userId, recipe, sourceUrl, site) {
  const tags = ['ChefsBook-v2', site.domain, site.region].concat(site.cuisine ? [site.cuisine] : []).concat(recipe.tags ?? []);
  const { data: row, error } = await supabase
    .from('recipes')
    .insert({
      user_id: userId,
      title: recipe.title,
      description: recipe.description ?? null,
      servings: recipe.servings ?? 4,
      prep_minutes: recipe.prep_minutes ?? null,
      cook_minutes: recipe.cook_minutes ?? null,
      cuisine: recipe.cuisine ?? null,
      course: recipe.course ?? null,
      source_type: 'url',
      source_url: sourceUrl,
      image_url: null,
      notes: recipe.notes ?? null,
      visibility: 'private',
      tags,
      source_language: recipe.source_language ?? null,
      translated_from: recipe.translated_from ?? null,
    })
    .select('id')
    .single();
  if (error || !row) return { savedId: null, error: error?.message ?? 'insert failed' };

  if (recipe.ingredients?.length) {
    const ingredients = recipe.ingredients.map((ing, i) => ({
      recipe_id: row.id,
      user_id: userId,
      sort_order: i,
      quantity: ing.quantity ?? null,
      unit: ing.unit ?? null,
      ingredient: ing.ingredient ?? '',
      preparation: ing.preparation ?? null,
      optional: ing.optional ?? false,
      group_label: ing.group_label ?? null,
    }));
    await supabase.from('recipe_ingredients').insert(ingredients);
  }
  if (recipe.steps?.length) {
    const steps = recipe.steps.map((s, i) => ({
      recipe_id: row.id,
      user_id: userId,
      step_number: s.step_number ?? i + 1,
      instruction: s.instruction ?? '',
      timer_minutes: s.timer_minutes ?? null,
      group_label: s.group_label ?? null,
    }));
    await supabase.from('recipe_steps').insert(steps);
  }
  return { savedId: row.id, error: null };
}

// ------------------------------------------------------------------
// Upsert tracker with taxonomy of what was FOUND
// ------------------------------------------------------------------
async function upsertTracker({ site, chosenUrl, recipe, rating, reason, httpStatus, fetchMethod }) {
  const ingredients = recipe?.ingredients ?? [];
  const withQty = ingredients.filter((i) => i.quantity != null).length;
  const taxonomy = {
    title: !!recipe?.title,
    description: !!recipe?.description,
    ingredients_count: ingredients.length,
    ingredients_with_qty: withQty,
    steps_count: recipe?.steps?.length ?? 0,
    has_cuisine: !!recipe?.cuisine,
    http_status: httpStatus,
    fetch_method: fetchMethod,
  };

  const { data: existing } = await supabase
    .from('import_site_tracker')
    .select('id, total_attempts, successful_attempts, sample_failing_urls')
    .eq('domain', site.domain)
    .maybeSingle();

  const success = rating !== null && rating >= 3;
  const sampleFailing = existing?.sample_failing_urls ?? [];
  if (!success && chosenUrl) {
    const next = [chosenUrl, ...sampleFailing.filter((u) => u !== chosenUrl)].slice(0, 5);
    sampleFailing.length = 0;
    sampleFailing.push(...next);
  }

  const payload = {
    domain: site.domain,
    rating,
    status: rating === null ? 'needs_extension' : rating >= 4 ? 'working' : rating === 3 ? 'partial' : 'broken',
    last_auto_tested_at: new Date().toISOString(),
    failure_taxonomy: taxonomy,
    sample_failing_urls: sampleFailing,
    notes: [
      `region=${site.region}`,
      `language=${site.language}`,
      site.cuisine ? `cuisine=${site.cuisine}` : null,
      `method=${fetchMethod}`,
      `status=${httpStatus}`,
      `ingredients=${ingredients.length}/${withQty}qty`,
      `steps=${recipe?.steps?.length ?? 0}`,
      reason,
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

// ------------------------------------------------------------------
// Per-site flow
// ------------------------------------------------------------------
async function processSite(site) {
  // Attempt 1: curated URL
  let chosenUrl = site.testUrl;
  let fetchMethod = 'curated';
  let httpStatus = 0;

  let pre = await fetchWithRetry(chosenUrl);
  httpStatus = pre.status;

  // Attempt 2: homepage discovery when curated fails
  if (!pre.ok) {
    const discovered = await findRecipeUrlOnHomepage(site.domain);
    if (discovered) {
      chosenUrl = discovered;
      fetchMethod = 'homepage-discovered';
      pre = await fetchWithRetry(chosenUrl);
      httpStatus = pre.status;
    }
  }

  if (!pre.ok) {
    const isBlocked = [403, 429, 460, 0].includes(httpStatus);
    return {
      ...site,
      chosenUrl,
      fetchMethod,
      httpStatus,
      rating: isBlocked ? null : 1,  // NULL = extension required, not 1★
      reason: isBlocked ? 'blocked — extension required' : `fetch failed ${httpStatus}`,
      saved: false,
      recipe: null,
      needsExtension: isBlocked,
    };
  }

  // Delegate to the live importer (with translation to English)
  const imp = await callImporter(chosenUrl);

  // Check if importer itself says extension needed (206 response)
  if (imp.status === 206 && imp.body?.needsBrowserExtraction) {
    return {
      ...site,
      chosenUrl,
      fetchMethod,
      httpStatus: 206,
      rating: null,
      reason: 'blocked — extension required (importer 206)',
      saved: false,
      recipe: null,
      needsExtension: true,
    };
  }

  if (!imp.ok || !imp.body?.recipe) {
    return {
      ...site,
      chosenUrl,
      fetchMethod,
      httpStatus,
      rating: 1,
      reason: `import failed ${imp.body?.error ?? imp.status}`,
      saved: false,
      recipe: null,
    };
  }

  const recipe = imp.body.recipe;
  const { rating, reason } = rateImport(recipe);

  let saved = false;
  let savedId = null;
  if (SAVE_RECIPES && rating >= 3) {
    const r = await saveRecipe(SAVE_USER_ID, recipe, chosenUrl, site);
    saved = !!r.savedId;
    savedId = r.savedId;
    if (r.error) reason += ` | save: ${r.error}`;
  }

  return { ...site, chosenUrl, fetchMethod, httpStatus, rating, reason, saved, savedId, recipe };
}

// ------------------------------------------------------------------
// Main
// ------------------------------------------------------------------
async function main() {
  const source = fs.readFileSync(SITE_LIST_PATH, 'utf8');
  let sites = parseSiteList(source);
  if (USE_TARGETS) {
    sites = sites.filter((s) => TARGET_DOMAINS.has(s.domain));
    // Also add any target domains not in siteList.ts with a homepage fallback
    for (const d of TARGET_DOMAINS) {
      if (!sites.find((s) => s.domain === d)) {
        sites.push({ domain: d, testUrl: `https://www.${d}`, region: 'unknown', language: 'en', cuisine: null });
      }
    }
  }
  sites = sites.slice(0, LIMIT);
  console.log(`[crawl v3] ${sites.length} sites · ${DELAY_MS}ms · save=${SAVE_RECIPES} · targets=${USE_TARGETS}`);

  const results = [];
  for (let i = 0; i < sites.length; i++) {
    const site = sites[i];
    const t0 = Date.now();
    let result;
    try {
      result = await processSite(site);
    } catch (e) {
      result = { ...site, chosenUrl: site.testUrl, fetchMethod: 'error', httpStatus: 0, rating: 1, reason: `exception: ${e?.message ?? e}`, saved: false, recipe: null };
    }
    results.push(result);

    const stars = result.rating === null ? '🔌 EXT' : '⭐'.repeat(result.rating) + '·'.repeat(5 - result.rating);
    const ing = result.recipe?.ingredients?.length ?? 0;
    const steps = result.recipe?.steps?.length ?? 0;
    const lang = result.recipe?.source_language ? ` lang=${result.recipe.source_language}` : '';
    const translated = result.recipe?.translated_from ? ` xlat=${result.recipe.translated_from}→en` : '';
    console.log(
      `[${String(i + 1).padStart(3)}/${sites.length}] ${stars} ${site.domain.padEnd(32)} ${site.region}/${site.language} ` +
      `ing=${ing} steps=${steps} method=${result.fetchMethod} http=${result.httpStatus}${lang}${translated}` +
      (result.saved ? ' ✓saved' : '') +
      (result.needsExtension ? ' 🔌extension-required' : '') +
      (result.rating !== null && result.rating <= 2 ? ` — ${result.reason}` : '')
    );

    try {
      await upsertTracker({
        site,
        chosenUrl: result.chosenUrl,
        recipe: result.recipe,
        rating: result.rating,
        reason: result.reason,
        httpStatus: result.httpStatus,
        fetchMethod: result.fetchMethod,
      });
    } catch (e) {
      console.error('  tracker upsert failed:', e.message);
    }

    if (i < sites.length - 1) {
      const elapsed = Date.now() - t0;
      const wait = Math.max(0, DELAY_MS - elapsed);
      if (wait) await new Promise((r) => setTimeout(r, wait));
    }
  }

  fs.writeFileSync(
    path.join(ROOT, 'scripts/site-compatibility-results.json'),
    JSON.stringify(
      results.map((r) => ({ ...r, recipe: r.recipe ? { ingredientCount: r.recipe.ingredients?.length ?? 0, stepCount: r.recipe.steps?.length ?? 0, hasDescription: !!r.recipe.description } : null })),
      null,
      2,
    ),
  );

  const byRating = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0, null: 0 };
  for (const r of results) byRating[r.rating] = (byRating[r.rating] ?? 0) + 1;
  const compat = results.filter((r) => r.rating !== null && r.rating >= 3).length;
  const extNeeded = results.filter((r) => r.needsExtension).length;
  const savedCount = results.filter((r) => r.saved).length;
  const translated = results.filter((r) => r.recipe?.translated_from && r.recipe.translated_from !== 'en').length;
  console.log('\n=== SUMMARY ===');
  for (const r of [5, 4, 3, 2, 1]) console.log(`${'⭐'.repeat(r)}${'·'.repeat(5 - r)} ${r}: ${byRating[r]}`);
  console.log(`🔌 Extension required: ${byRating.null}`);
  console.log(`Server-side compat: ${Math.round((compat / results.length) * 100)}% (${compat}/${results.length})`);
  console.log(`Recipes saved: ${savedCount}`);
  console.log(`Translated to English: ${translated}`);
  console.log(`Extension-required sites: ${extNeeded}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
