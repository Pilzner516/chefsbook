#!/usr/bin/env node
/** Reads scripts/site-compatibility-results.json and writes
 * docs/SITE-COMPATIBILITY-REPORT-YYYY-MM-DD.md grouped by region + language. */

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
for (const r of results) {
  (byRegion[r.region] ??= []).push(r);
}
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

let out = '';
out += `# ChefsBook Recipe Site Compatibility Report\n`;
out += `**Generated:** ${today}\n`;
out += `**Sites tested:** ${results.length}\n`;
out += `**Overall compatibility (rating ≥ 3):** ${Math.round((compatCount / results.length) * 100)}% (${compatCount}/${results.length})\n\n`;

out += `## Rating distribution\n\n`;
out += `| Rating | Sites | % |\n|---|---|---|\n`;
for (const r of [5, 4, 3, 2, 1]) {
  out += `| ${stars(r)} (${r}) | ${byRating[r].length} | ${Math.round((byRating[r].length / results.length) * 100)}% |\n`;
}

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
    const tail = r.missing?.length ? ` — missing ${r.missing.join(', ')}` : '';
    out += `- ${stars(r.rating)} **${r.domain}** (${r.language}${r.cuisine ? ', ' + r.cuisine : ''})${tail}\n`;
  }
  out += `\n`;
}

out += `## Top 10 problematic (rating ≤ 2)\n\n`;
const problematic = results
  .filter((r) => r.rating <= 2)
  .sort((a, b) => a.rating - b.rating || a.domain.localeCompare(b.domain))
  .slice(0, 10);
for (const p of problematic) {
  out += `- **${p.domain}** (${p.region}/${p.language}) — rating ${p.rating}, ${p.missing?.join(', ')}\n`;
  if (p.notes) out += `  - ${p.notes}\n`;
}

out += `\n## Recommendations\n\n`;
out += `- Sites returning 403/404 on curated URLs likely need updated test URLs or fallback to Chrome extension import.\n`;
out += `- Sites flagged "json-ld not found" require Claude-based fallback extraction — already wired in /api/import/url.\n`;
out += `- Sites that returned partial JSON-LD (rating 3) will benefit from the existing JSON-LD + Claude gap-fill path.\n`;
out += `- Consider auto-blocking sites with rating 1 across all attempts until they are manually reviewed.\n`;

fs.writeFileSync(OUTPUT, out);
console.log(`wrote ${OUTPUT} (${results.length} sites)`);
