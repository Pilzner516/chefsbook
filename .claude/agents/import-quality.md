# Import Quality Agent
# Read this for any session touching import pipeline, site testing,
# or recipe completeness.

## Responsibility
Monitor and improve recipe import quality across all import paths.

## Pre-flight checklist
- [ ] Check import_site_tracker for the target domain before testing
- [ ] Verify checkRecipeCompleteness() is called after every import
- [ ] Verify logImportAttempt() is called after every import
- [ ] Check isActuallyARecipe() runs on complete recipes

## Known problematic sites (update this list)
- seriouseats.com: aggressive Cloudflare — curated URLs return 403 to Node fetchers (session 143 crawl) — needs ScrapingBee fallback or stored-cookie browser profile
- allrecipes.com: 403 on Node-UA fetch (session 143) — pass through Chrome extension or ScrapingBee
- epicurious.com / delish.com / woksoflife.com / themediterraneandish.com: curated URLs stale or path changed (404) — refresh SITE_TEST_URLS periodically
- food52.com: rate-limits Node agents (429) — use sparse retry with backoff
- cooking.nytimes.com: paywalled, returns partial content; 403 on curated test
- instagram.com: BLOCKED — use photo import instead
- youtube.com: transcript-based, steps quality varies
- tasty.co: video-first, steps often sparse
- pinterest.com: never contains full recipe; always redirects off-site
- UK sites (bbcgoodfood, jamieoliver, nigella, waitrose, deliciousmagazine, olivemagazine, greatbritishchefs, lovefood): 0% compat in session 143 crawl — all return 403 or 404 to Node fetches; likely all require Chrome fingerprint
- Italian aggregators (giallozafferano.it, cucchiaio.it, agrodolce.it, lacucinaitaliana.it, sale-pepe.it): 8% compat — JSON-LD often missing or behind full HTML render
- Portuguese + Baltic sites: 0% compat, small sample (5 + 3) — mostly 404/network errors; likely the curated URLs were best-guess and need verification
- Polish / Romanian / Finnish / Danish / Norwegian: 0% compat in session 143 — broad pattern of Node-agent blocks; Swedish sites (arla.se, tasteline.com, recepten.se, ica.se, koket.se) fare best in Nordic (67% compat, avg 3.3/5)

## Session 143 crawl highlights (2026-04-15)
- 218 sites tested, 22% compat (rating ≥ 3). 170/218 rated 1/5 — primarily 403 (25 sites) and 404 (106 sites) from curated test URLs, and 21 sites with no JSON-LD at all.
- Best regions: Austria 50%, International-cuisine 36%, Spain 30%, France 31%, Nordic 29%, US 26%.
- Worst regions: Portugal 0%, UK 0%, Canada 0%, Australia/NZ 0%, Baltic 0%, Italy 8%.
- Best languages: sv (67%), hr (100%/1 site), fr (31%).
- Takeaway: most "0% compat" regions are victims of the **unauthenticated-Node-fetch ceiling**, not fundamental JSON-LD absence. Sites are likely fine when a real user imports via browser extension or Puppeteer fallback. The test harness needs either ScrapingBee, Puppeteer with a realistic UA, or cached cookies to produce a fair signal for these regions.
- Stale curated URLs: many `testUrl` entries in siteList.ts were constructed by pattern guess — approximately 106 returned 404. Next iteration should fetch each site's homepage, grab an actual recipe link from the HTML, and persist that as the verified test URL.

## Import success criteria
A successful import must have ALL of:
1. title (non-empty)
2. description (non-empty)
3. ≥2 ingredients WITH quantities
4. ≥1 step
5. ≥1 tag
6. ai_recipe_verdict = 'approved'

## Failure taxonomy
Track failures with these categories:
- missing_title
- missing_description
- missing_ingredients (< 2 ingredients total)
- missing_amounts (ingredients present but no quantities)
- missing_steps
- not_a_recipe (AI verdict)
- site_blocked
- site_error (HTTP error from source)
- timeout

## Gate wiring
All recipe save paths must eventually call `/api/recipes/finalize` which:
1. Runs checkRecipeCompleteness()
2. Applies gate (visibility → private if incomplete)
3. Runs isActuallyARecipe() (HAIKU) if complete
4. Logs an import_attempts row
5. Updates import_site_tracker aggregates

Currently wired paths:
- Web createRecipeWithModeration (URL / scan / speak / file / youtube / manual)
- Mobile recipeStore.addRecipe (all mobile paths)
- Mobile importStore.importUrls (batch URL import)
- Extension /api/extension/import (inline server-side gate)

Gaps to close (not yet wired — verify before relying):
- Web batch bookmark loop at apps/web/app/dashboard/scan/page.tsx line ~444 uses createRecipe() directly and skips createRecipeWithModeration.
- Cookbook recipe import at apps/web/app/dashboard/cookbooks/[id]/page.tsx line ~79 uses createRecipe() directly.
- Mobile recipe/new.tsx manual creation flow — verify it routes through recipeStore.addRecipe.

## Agent responsibilities
- Update known problematic sites list when new issues discovered
- Review import_attempts weekly for new failure patterns
- Propose SCAN_PROMPT improvements when pattern identified
- Maintain KNOWN_RECIPE_SITES list in packages/ai/src/siteList.ts
