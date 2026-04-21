# ChefsBook — Session 200: Fix extension import JSON parse failure on foodandwine.com
# Target: apps/extension + apps/web (/api/extension/import) + packages/ai
# TYPE: CODE FIX (mandatory — per session 187 rule)

---

## CONTEXT

User (pilzner) clicked the browser extension on a Food & Wine recipe and saw this error in the extension popup:

> **Expected ',' or ']' after array element in JSON at position 9287 (line 257 column 6)**
> [Try again] button

Details:
- URL: `foodandwine.com/julia-childs-buche-de-noel` (Julia Child's Bûche de Noël — a complex multi-component recipe: sponge cake, buttercream, Italian meringue, meringue mushrooms, chocolate ganache)
- Extension version: v1.1.0 (session 146's extension-html flow)
- Error is a **native `JSON.parse` failure surfaced raw to the popup** — position 9287 is deep in a large response, suggesting the parse got near-done before hitting malformed syntax
- Food & Wine is Meredith-owned; typically publishes complete Schema.org Recipe JSON-LD

Three problems are likely stacked:
1. **Robustness**: Claude's HTML-extraction JSON output for long/complex recipes occasionally has trailing-comma or array-syntax issues. No repair layer catches this.
2. **Path selection**: The extension route may be skipping JSON-LD extraction entirely and going straight to Claude-on-HTML, which is both slower and more fragile. If JSON-LD parsing ran first, this URL probably wouldn't need Claude at all.
3. **UX**: Raw parser errors reach the user. The popup should say "Couldn't read this recipe — try again" and offer a retry, not leak the internal parser message.

---

## AGENTS TO READ BEFORE WRITING CODE (in order)

1. `.claude/agents/wrapup.md`
2. `.claude/agents/testing.md` — MANDATORY
3. `.claude/agents/feature-registry.md` — MANDATORY (touching import pipeline)
4. `.claude/agents/deployment.md` — MANDATORY (web session)
5. `.claude/agents/import-pipeline.md` — ALWAYS for import path
6. `.claude/agents/import-quality.md` — ALWAYS per CLAUDE.md for site testing
7. `.claude/agents/ai-cost.md` — if retry logic or model changes are proposed

Run every agent's pre-flight checklist. Do not skip.

---

## DIAGNOSE BEFORE FIXING — REPORT ALL FOUR ANGLES FIRST

Do NOT write a single line of code until all four angles are reported back with evidence. Paste curl output, file:line refs, and raw Claude response excerpts.

### Angle 1 — Where does the parse actually blow up?
- `grep -rn "JSON.parse\|extractJSON" apps/extension apps/web/app/api/extension packages/ai/src`
- Identify the exact call site that throws for this URL
- Is it in the extension's `popup.js` / `background.js` (parsing the API response), or server-side in `/api/extension/import` (parsing Claude's output), or inside `packages/ai/src/*` (via `extractJSON()`)?
- The position-9287 error implies a large payload. If it's client-side, that means the server is sending back something malformed — why? If server-side, the extension popup should never have seen the raw parser error at all.

### Angle 2 — Does the extension path try JSON-LD first?
- Read `apps/web/app/api/extension/import/route.ts` end-to-end
- Does it call `extractJsonLdRecipe()` (from `packages/ai`) before calling Claude on the HTML blob?
- Compare with `/api/import/url` — that path has a documented JSON-LD-first strategy (session 145 fixed the JSON-LD ingredient gate)
- Food & Wine is Meredith-stack — fetch the page and `grep` for `application/ld+json` in the HTML. If it has a complete Recipe graph, Claude should never have been invoked for this URL.

### Angle 3 — What did Claude actually return for this URL?
- Reproduce the failing call. Either: (a) SSH to RPi5, use the JWT of pilzner to POST to `/api/extension/import` with the scraped HTML from foodandwine.com; or (b) run the extension HTML scrape + Claude call via a one-off tsx script against the prod Anthropic key
- **Capture the raw Claude response body before `extractJSON` / `JSON.parse` runs.** Paste the ~20 chars around position 9287 (line 257 col 6).
- Common LLM JSON failures at this scale: trailing comma inside an ingredients/steps array, unescaped quote in a step description, stray newline inside a string, markdown fence (```json ... ```) not stripped, two JSON objects concatenated.

### Angle 4 — Does `extractJSON()` have any repair / fallback?
- Read `packages/ai/src/*` for the `extractJSON()` implementation
- Does it handle: markdown code fences, trailing commas, single-quote strings, unescaped newlines?
- If it's a bare `JSON.parse(response.match(/{.+}/s)[0])`, it will fail on any of the above.
- A repair library (`json-repair` on npm, MIT, no native deps) fixes all common LLM JSON issues including trailing commas and position-9287-class errors. Worth proposing as the surgical fix.

---

## EVIDENCE TO REPORT BEFORE ANY CODE CHANGE

1. File:line of the exact parse that threw
2. Whether the error is client-side (extension) or server-side (route → AI package)
3. Whether `/api/extension/import` attempts JSON-LD before Claude (yes/no, file:line)
4. What `foodandwine.com/julia-childs-buche-de-noel` has in its `<script type="application/ld+json">` tag — full Recipe? partial? missing entirely?
5. The ~100-char window of Claude's output around position 9287 — the actual malformed syntax
6. Current state of `extractJSON()` — has repair logic? raw `JSON.parse`?
7. Which prior session's fix this is structurally analogous to (candidates: 145 JSON-LD gate, 183 Claude extraction, 189 silent drop, 195 field-name mismatch)

---

## FIX GUIDANCE (when user approves the diagnosis)

Apply fixes in this order of preference:

**Fix A — JSON-LD first on extension path (if missing)**
- If `/api/extension/import` doesn't call `extractJsonLdRecipe()` before Claude, add it. This is the highest-leverage fix — avoids Claude entirely on well-structured sites and removes a whole class of failure.
- Mirror the sequencing used in `/api/import/url`.

**Fix B — Robust JSON repair in `extractJSON()`**
- Add `json-repair` (or equivalent) as a fallback: try strict `JSON.parse` first, on failure run through repair, on second failure return structured error
- This protects every Claude-calling route, not just extension import
- ai-cost.md: note that repair is zero-cost — it runs on already-paid-for Claude output

**Fix C — UX fix in extension popup**
- The popup should never show `JSON.parse` error text. On 4xx/5xx from the API, show: "Couldn't read this recipe. Try again, or open in the web app."
- Retry button should hit the same endpoint once (existing Try-again button may already do this — verify)
- If the repair-and-retry in Fix B succeeds on a second server call, the popup never sees an error in the first place

**Fix D — Telemetry**
- Log failed Claude extractions to `import_attempts` with `extraction_method='extension-html'` and a failure reason. Right now the failure is invisible to admins.
- Minor scope — only add if Fix A/B/C didn't already ship it

**Do not widen scope beyond these four.** The ~40 raw `alert()` cleanup is a separate session (per AGENDA.md after session 199).

---

## VERIFICATION (all required — per testing.md)

1. **Reproduce the original failure** on RPi5 with the exact URL. Capture the error.
2. **JSON-LD check**: `curl -sL 'https://www.foodandwine.com/julia-childs-buche-de-noel' | grep -A2 'application/ld+json' | head -60` — confirm what's available.
3. **After Fix A (if applied)**: POST scraped HTML of that URL to `/api/extension/import`. Confirm the recipe saves with full ingredients + steps, `extraction_method` = `json-ld` (not `extension-html`).
4. **After Fix B**: craft a deliberately malformed JSON blob (trailing comma) and confirm `extractJSON()` repairs it cleanly. Run `tsc --noEmit`.
5. **After Fix C**: load the extension on a known-failing URL (simulate by pointing it at a 500-returning endpoint temporarily) and confirm the popup shows the friendly message, not the parser text.
6. **psql sanity check**: `SELECT id, title, extraction_method, ingredient_count FROM recipes WHERE user_id=<pilzner uuid> ORDER BY created_at DESC LIMIT 5;` — confirm new row exists with method=json-ld and reasonable ingredient count.
7. **Regression test**: re-run one of the 32 known-good sites from session 145's compat crawl through the extension. Confirm nothing regressed.

---

## DEPLOYMENT

Web side:
```bash
ssh rasp@rpi5-eth
cd /mnt/chefsbook/repo
git pull
cd apps/web
rm -rf node_modules/react node_modules/react-dom .next
NODE_OPTIONS=--max-old-space-size=1024 npx next build --no-lint 2>&1 | tail -20
pm2 restart chefsbook-web
```

Build must exit 0 before `pm2 restart`. If build fails, do NOT restart PM2.

Extension side (if popup.js or manifest changes):
- Bump `manifest.json` version (currently 1.1.0 → 1.1.1 for patch)
- Rebuild zip at `apps/extension/dist/chefsbook-extension-v1.1.1.zip`
- Copy zip to `/mnt/chefsbook/` on RPi5 (users install manually — no auto-update)
- Note in DONE.md that users need to re-install for popup UX fix (web-side fixes A/B are live immediately)

---

## COMPLETION CHECKLIST

- [ ] All 7 agents read; pre-flight checklists run
- [ ] Four diagnosis angles reported with evidence before any code change
- [ ] Which prior session's pattern this matches, named in advance
- [ ] Fix A applied if `/api/extension/import` was missing JSON-LD-first — OR reason noted if already present
- [ ] Fix B: `extractJSON()` now handles trailing commas + markdown fences + unescaped newlines
- [ ] Fix C: extension popup no longer surfaces raw parser errors
- [ ] Fix D: telemetry for failed extension extractions (if in scope)
- [ ] Reproduced original failure before fix; confirmed success after fix on same URL
- [ ] JSON-LD presence verified via curl on the foodandwine URL
- [ ] `tsc --noEmit` clean in apps/web
- [ ] Extension manifest version bumped if popup touched
- [ ] Deployed to RPi5, chefsbk.app HTTP 200
- [ ] DONE.md entry tagged **TYPE: CODE FIX**, names which prior session this matches
- [ ] AGENDA.md updated if any scoped-out follow-ups identified
- [ ] /wrapup to update DONE.md, CLAUDE.md, AGENDA.md
