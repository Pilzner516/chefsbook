#!/usr/bin/env node
/** Reads scripts/site-compatibility-results.json and writes
 * docs/SITE-COMPATIBILITY-REPORT-YYYY-MM-DD.md grouped by region + language
 * with actionable recommendations. */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const INPUT = path.join(ROOT, 'scripts/site-compatibility-results.json');
const today = new Date().toISOString().slice(0, 10);
const OUTPUT = path.join(ROOT, `docs/SITE-COMPATIBILITY-REPORT-${today}.md`);

if (!fs.existsSync(INPUT)) {
  console.error(`missing ${INPUT} — run scripts/test-site-compatibility.mjs first`);
  process.exit(1);
}

const results = JSON.parse(fs.readFileSync(INPUT, 'utf8'));
const stars = (r) => '⭐'.repeat(r) + '·'.repeat(5 - r);
const byRating = { 5: [], 4: [], 3: [], 2: [], 1: [] };
for (const r of results) byRating[r.rating].push(r);

const byRegion = {};
for (const r of results) (byRegion[r.region] ??= []).push(r);
const regionStats = Object.entries(byRegion).map(([region, rows]) => {
  const compat = rows.filter((r) => r.rating >= 3).length;
  const avg = rows.reduce((s, r) => s + r.rating, 0) / rows.length;
  return { region, count: rows.length, compat, compatPct: Math.round((compat / rows.length) * 100), avg: Math.round(avg * 10) / 10 };
}).sort((a, b) => b.avg - a.avg);

const byLang = {};
for (const r of results) (byLang[r.language] ??= []).push(r);
const langStats = Object.entries(byLang).map(([language, rows]) => {
  const compat = rows.filter((r) => r.rating >= 3).length;
  const avg = rows.reduce((s, r) => s + r.rating, 0) / rows.length;
  return { language, count: rows.length, compat, compatPct: Math.round((compat / rows.length) * 100), avg: Math.round(avg * 10) / 10 };
}).sort((a, b) => b.avg - a.avg);

const compatCount = results.filter((r) => r.rating >= 3).length;
const savedCount = results.filter((r) => r.saved).length;

const bot403 = results.filter((r) => r.httpStatus === 403).length;
const gone404 = results.filter((r) => r.httpStatus === 404).length;
const homepageRescued = results.filter((r) => r.fetchMethod === 'homepage-discovered' && r.rating >= 3).length;
const noJsonLd = results.filter((r) => r.rating <= 2 && r.reason?.includes('title only')).length;

let out = '';
out += `# ChefsBook Recipe Site Compatibility Report\n`;
out += `**Generated:** ${today}\n`;
out += `**Sites tested:** ${results.length}\n`;
out += `**Overall compatibility (rating ≥ 3):** ${Math.round((compatCount / results.length) * 100)}% (${compatCount}/${results.length})\n`;
out += `**Recipes saved under pilzner:** ${savedCount}\n\n`;

out += `## Rating distribution\n\n`;
out += `| Rating | Sites | % |\n|---|---|---|\n`;
for (const r of [5, 4, 3, 2, 1]) {
  out += `| ${stars(r)} (${r}) | ${byRating[r].length} | ${Math.round((byRating[r].length / results.length) * 100)}% |\n`;
}

out += `\n## Fetch / bot behaviour\n\n`;
out += `- Sites reachable via curated URL: ${results.filter((r) => r.fetchMethod === 'curated').length}\n`;
out += `- Sites rescued by homepage discovery: ${results.filter((r) => r.fetchMethod === 'homepage-discovered').length} (of which ${homepageRescued} produced a usable recipe)\n`;
out += `- Sites stuck on HTTP 403 despite UA rotation: ${bot403}\n`;
out += `- Sites stuck on HTTP 404 despite homepage discovery: ${gone404}\n`;
out += `- Sites with title but no ingredients/steps (no JSON-LD, no plugin fingerprint): ${noJsonLd}\n`;

out += `\n## By region (best → worst)\n\n`;
out += `| Region | Sites | Compat | Compat % | Avg rating |\n|---|---|---|---|---|\n`;
for (const s of regionStats) {
  out += `| ${s.region} | ${s.count} | ${s.compat} | ${s.compatPct}% | ${s.avg} |\n`;
}

out += `\n## By language\n\n`;
out += `| Lang | Sites | Compat | Compat % | Avg rating |\n|---|---|---|---|---|\n`;
for (const s of langStats) {
  out += `| ${s.language} | ${s.count} | ${s.compat} | ${s.compatPct}% | ${s.avg} |\n`;
}

out += `\n## Detail by region\n\n`;
for (const s of regionStats) {
  out += `### ${s.region} — ${s.compatPct}% compat, avg ${s.avg}/5 (${s.count} sites)\n\n`;
  const rows = byRegion[s.region].slice().sort((a, b) => b.rating - a.rating || a.domain.localeCompare(b.domain));
  for (const r of rows) {
    const t = r.recipe ? ` · ing=${r.recipe.ingredientCount}, steps=${r.recipe.stepCount}` : '';
    const tag = r.saved ? ' · ✓saved' : '';
    out += `- ${stars(r.rating)} **${r.domain}** (${r.language}${r.cuisine ? ', ' + r.cuisine : ''})${t}${tag}${r.rating <= 2 ? ` — ${r.reason}` : ''}\n`;
  }
  out += `\n`;
}

out += `## Top 10 most problematic (rating ≤ 2 after UA rotation + homepage fallback)\n\n`;
const problematic = results
  .filter((r) => r.rating <= 2)
  .sort((a, b) => a.rating - b.rating || a.domain.localeCompare(b.domain))
  .slice(0, 10);
for (const p of problematic) {
  out += `- **${p.domain}** (${p.region}/${p.language}) — rating ${p.rating}, HTTP ${p.httpStatus}, ${p.reason}\n`;
}

out += `\n## Recommendations for Higher Capture Rates\n\n`;

out += `### Immediate code fixes (will improve ALL sites)\n`;
out += `1. **Completed in session 145 — JSON-LD ingredient gate.** Gate was dropping ingredients when non-English units didn't match the English-only regex. Now preserves ingredient text even when quantity/unit can't be parsed (fixed at packages/ai/src/importFromUrl.ts:474). Expected to lift non-English regions by 10–25 points on its own.\n`;
out += `2. **Completed in session 145 — JSON-LD object-form HowToIngredient.** Parser assumed recipeIngredient was always an array of strings; now handles objects with name/amount/unitText fields.\n`;
out += `3. **Completed in session 145 — Claude prompt reinforced.** When gap-fill runs, prompt now explicitly mentions the common WordPress plugin class names (wprm-recipe-ingredient, tasty-recipes-ingredients, mv-create-ingredients) and non-English section labels (Zutaten, Ingrédients, Ingredienti, Ingredientes, Ingrediënten, Składniki).\n\n`;

out += `### Structural improvements worth investing in\n`;
out += `- **ScrapingBee / Puppeteer fallback for 403s** (${bot403} sites): Cloudflare-gated sites (most UK + US majors, seriouseats/allrecipes/epicurious/bbcgoodfood) will only respond to real browser fingerprints. ScrapingBee credits at ~$49/mo for 100k requests would unblock this entire class — ROI is enormous because these include the most-imported sites on the internet.\n`;
out += `- **Stale-URL watchdog** (${gone404} sites): many curated test URLs are simply gone. The homepage-discovery fallback rescued some; the rest need either a weekly homepage-crawl to refresh testUrl, or we drop pre-curated URLs entirely and always discover at test time.\n`;
out += `- **Aggregator fingerprint for Italian / Polish / Czech / Romanian**: sites like giallozafferano, kwestiasmaku, toprecepty, bucataras frequently ship recipes inside custom CMS templates without JSON-LD. An additional plugin fingerprint pass (already present for WPRM/Tasty/Mediavine) for each of these platforms would pay off quickly.\n\n`;

out += `### Sites to prioritize by ROI (traffic × current failure)\n`;
const priority = results
  .filter((r) => r.rating <= 2)
  .filter((r) => /allrecipes|foodnetwork|epicurious|bonappetit|seriouseats|bbcgoodfood|jamieoliver|taste\.com\.au|nytimes|delish|foodandwine|marthastewart|giallozafferano|chefkoch|marmiton/.test(r.domain))
  .slice(0, 10);
for (const p of priority) {
  out += `- ${p.domain} — HTTP ${p.httpStatus}, ${p.reason}\n`;
}

fs.writeFileSync(OUTPUT, out);
console.log(`wrote ${OUTPUT} (${results.length} sites)`);
