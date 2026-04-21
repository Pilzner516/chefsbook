# ChefsBook — Session 143: Recipe Site Compatibility Crawl
# Source: Admin import-sites page only shows 3 domains — need full coverage
# Target: packages/ai + apps/web admin + database

---

## CONTEXT

Read CLAUDE.md, DONE.md, feature-registry.md, import-pipeline.md,
and import-quality.md before starting.

The import_site_tracker table exists but only has 3 entries because
it only populates from actual user import attempts. This session
proactively tests the top 60+ recipe sites and populates the tracker
with real compatibility data.

The KNOWN_RECIPE_SITES list was created in session 141 at
packages/ai/src/siteList.ts — use it as the starting point.

---

## STEP 1 — Verify the site list

Read packages/ai/src/siteList.ts fully.
Count how many sites are listed.
Show the full list before proceeding.

If the file doesn't exist or has fewer than 40 sites, rebuild it
with this comprehensive list:

```typescript
export const KNOWN_RECIPE_SITES = [
  // === MAJOR US RECIPE SITES ===
  'allrecipes.com',
  'foodnetwork.com',
  'epicurious.com',
  'bonappetit.com',
  'food52.com',
  'seriouseats.com',
  'nytcooking.com',
  'tasty.co',
  'delish.com',
  'simplyrecipes.com',
  'thekitchn.com',
  'smittenkitchen.com',
  'halfbakedharvest.com',
  'minimalistbaker.com',
  'cookingclassy.com',
  'sallysbakingaddiction.com',
  'budgetbytes.com',
  'ohsheglows.com',
  'pinchofyum.com',
  'skinnytaste.com',
  'thespruceeats.com',
  'tasteofhome.com',
  'recipetineats.com',
  'cafedelites.com',
  'cookieandkate.com',
  'loveandlemons.com',
  'gimmesomeoven.com',
  'twopeasandtheirpod.com',
  'wellplated.com',
  'ambitious kitchen.com',
  'ambitiouskitchen.com',
  'averiecooks.com',
  'diethood.com',
  'damn delicious.net',
  'damndelicious.net',
  'natashaskitchen.com',
  'spendwithpennies.com',
  'therecipecritic.com',
  'yellowblissroad.com',
  'momontimeout.com',

  // === FOOD MEDIA ===
  'marthastewart.com',
  'foodandwine.com',
  'myrecipes.com',
  'cooking.nytimes.com',
  'washingtonpost.com',
  'saveur.com',
  'cooksillustrated.com',
  'americastestkitchen.com',
  'seriouseats.com',

  // === HEALTH & DIET ===
  'eatingwell.com',
  'cookinglight.com',
  'wholefoodsmarket.com',
  'healthyrecipes101.com',
  'ifoodreal.com',
  'eatwell101.com',
  'downshiftology.com',
  'wholesomeyum.com',
  'paleorunningmomma.com',
  'againstallgrain.com',
  'detoxinista.com',

  // === ENGLISH — UK & IRELAND ===
  'bbcgoodfood.com',
  'jamieoliver.com',
  'nigella.com',
  'deliciousmagazine.co.uk',
  'olivemagazine.com',
  'greatbritishchefs.com',
  'lovefood.com',
  'waitrose.com',
  'goodhousekeeping.com',

  // === ENGLISH — AUSTRALIA & NZ ===
  'taste.com.au',
  'womensweeklyfood.com.au',
  'australiangoodtaste.com.au',

  // === ENGLISH — CANADA ===
  'foodnetwork.ca',
  'canadianliving.com',
  'chatelaine.com',

  // === FRENCH — FRANCE ===
  'marmiton.org',
  'cuisineaz.com',
  '750g.com',
  'ptitchef.com',
  'cuisineactuelle.fr',
  'femmeactuelle.fr',
  'linternaute.com',

  // === SPANISH — SPAIN ===
  'recetasgratis.net',
  'hogarmania.com',
  'pequerecetas.com',
  'recetasderechupete.com',
  'directoalpaladar.com',
  'webosfritos.es',
  'cocinafacil.com',

  // === SPANISH — MEXICO & LATIN AMERICA ===
  'mexicoinmykitchen.com',
  'kiwilimon.com',
  'recetas.com.mx',
  'isabeleats.com',
  'laylita.com',

  // === ITALIAN — ITALY ===
  'giallozafferano.it',
  'cucchiaio.it',
  'lacucinaitaliana.it',
  'agrodolce.it',
  'fattoincasadabenedetta.it',
  'tavolartegusto.it',
  'ricette.it',
  'sale-pepe.it',
  'finedininglovers.com',

  // === GERMAN — GERMANY, AUSTRIA, SWITZERLAND ===
  'chefkoch.de',
  'lecker.de',
  'essen-und-trinken.de',
  'kochbar.de',
  'einfachkochen.at',
  'gutekueche.at',
  'gutekueche.ch',
  'springlane.de',
  'kuechengoetter.de',

  // === CUISINE SPECIFIC ===
  // Asian
  'woksoflife.com',
  'justonecookbook.com',
  'maangchi.com',
  'koreanbapsang.com',
  'chinasichuanfood.com',
  'hotthaikitchen.com',
  'omnivorescookbook.com',
  'rotinrice.com',

  // Indian
  'indianhealthyrecipes.com',
  'vegrecipesofindia.com',
  'hebbarskitchen.com',
  'archanaskitchen.com',
  'spiceupthecurry.com',
  'cookwithmanali.com',

  // Middle Eastern & Mediterranean
  'feelgoodfoodie.net',
  'themediterraneandish.com',
  'thematbakh.com',
  'zaatarandzaytoun.com',
  'anediblemosaic.com',
  'olivetomato.com',

  // French cuisine (English)
  'davidlebovitz.com',

  // Japanese
  'chopstickchronicles.com',

  // === EU — NORDIC ===
  'matprat.no',           // Norway — largest recipe site
  'godt.no',             // Norway
  'valdemarsro.dk',      // Denmark — very popular
  'foodculture.dk',      // Denmark
  'arla.se',             // Sweden
  'tasteline.com',       // Sweden
  'recepten.se',         // Sweden
  'maku.fi',             // Finland
  'valio.fi',            // Finland

  // === EU — BENELUX ===
  'allerhande.nl',       // Netherlands — Albert Heijn, massive database
  'leukerecepten.nl',    // Netherlands
  'smulweb.nl',          // Netherlands
  'culy.nl',             // Netherlands
  'libelle-lekker.be',   // Belgium
  'njam.tv',             // Belgium/Netherlands

  // === EU — EASTERN EUROPE ===
  'kwestiasmaku.com',    // Poland — most popular Polish recipe site
  'aniagotuje.pl',       // Poland
  'przepisy.pl',         // Poland
  'toprecepty.cz',       // Czech Republic
  'vareni.cz',           // Czech Republic
  'nosalty.hu',          // Hungary — largest recipe site
  'mindmegette.hu',      // Hungary
  'jamilacuisine.ro',    // Romania — most popular
  'lauralaurentiu.ro',   // Romania
  'coolinarika.com',     // Croatia — major regional site

  // === EU — GREEK ===
  'argiro.gr',           // Greece — celebrity chef site
  'sintagespareas.gr',   // Greece
  'gastronomos.gr',      // Greece

  // === EU — PORTUGUESE ===
  'teleculinaria.pt',    // Portugal
  'receitascomhistoria.pt', // Portugal
  'pingodoce.pt',        // Portugal

  // === EU — BALTIC ===
  'nami-nami.ee',        // Estonia — English/Estonian bilingual

  // === AGGREGATORS ===
  'yummly.com',
  'food.com',
  'bigoven.com',
  'supercook.com',

  // === SPECIALTY ===
  'kingarthurbaking.com',
  'sallys bakingaddiction.com',
  'handletheheat.com',
  'bakedbyanintrovert.com',
  'livelovelaughfood.com',
  'onceuponachef.com',
  'cookstr.com',
  'yummly.com',
  'food.com',
  'allrecipes.com',
]
```

---

## STEP 2 — Find a real recipe URL for each site

For each domain in the list, we need a real recipe URL to test.
The agent must find these by constructing likely URLs or using
known patterns:

Strategy per site type:
- Sites with /recipe/ pattern: try {domain}/recipe/
- Sites with /recipes/ pattern: try {domain}/recipes/
- Known good URLs: use curated list below

Curated test URLs (use these directly):
```typescript
export const SITE_TEST_URLS: Record<string, string> = {
  'allrecipes.com': 'https://www.allrecipes.com/recipe/24074/alysas-macaroni-and-cheese/',
  'foodnetwork.com': 'https://www.foodnetwork.com/recipes/ina-garten/roast-chicken-recipe-1940502',
  'epicurious.com': 'https://www.epicurious.com/recipes/food/views/simple-roast-chicken',
  'bonappetit.com': 'https://www.bonappetit.com/recipe/bas-best-chocolate-chip-cookies',
  'food52.com': 'https://food52.com/recipes/79840-easy-roast-chicken',
  'seriouseats.com': 'https://www.seriouseats.com/the-food-lab-better-home-fries',
  'simplyrecipes.com': 'https://www.simplyrecipes.com/recipes/roast_chicken/',
  'thekitchn.com': 'https://www.thekitchn.com/how-to-make-the-best-roast-chicken-247230',
  'smittenkitchen.com': 'https://smittenkitchen.com/2008/03/roast-chicken/',
  'minimalistbaker.com': 'https://minimalistbaker.com/simple-vegan-pasta/',
  'budgetbytes.com': 'https://www.budgetbytes.com/super-easy-chicken-noodle-soup/',
  'bbcgoodfood.com': 'https://www.bbcgoodfood.com/recipes/roast-chicken',
  'jamieoliver.com': 'https://www.jamieoliver.com/recipes/chicken-recipes/perfect-roast-chicken/',
  'taste.com.au': 'https://www.taste.com.au/recipes/perfect-roast-chicken/7b40aa2e-f4dd-42c8-9efa-7ecdbe2f73b6',
  'kingarthurbaking.com': 'https://www.kingarthurbaking.com/recipes/classic-chocolate-chip-cookies-recipe',
  'sallysbakingaddiction.com': 'https://sallysbakingaddiction.com/best-chocolate-chip-cookies/',
  'recipetineats.com': 'https://www.recipetineats.com/chicken-noodle-soup/',
  'skinnytaste.com': 'https://www.skinnytaste.com/chicken-tortilla-soup/',
  'halfbakedharvest.com': 'https://www.halfbakedharvest.com/one-pot-30-minute-spicy-arrabbiata-pasta/',
  'pinchofyum.com': 'https://pinchofyum.com/the-best-chocolate-cake',
  'tasty.co': 'https://tasty.co/recipe/the-best-homemade-mac-cheese',
  'delish.com': 'https://www.delish.com/cooking/recipe-ideas/a19636089/best-lasagna-recipe/',
  'eatingwell.com': 'https://www.eatingwell.com/recipe/269553/herb-roasted-chicken/',
  'foodandwine.com': 'https://www.foodandwine.com/recipes/perfect-roast-chicken',
  'marthastewart.com': 'https://www.marthastewart.com/332664/perfect-roast-chicken',
  'onceuponachef.com': 'https://www.onceuponachef.com/recipes/perfect-roast-chicken.html',
  'wellplated.com': 'https://www.wellplated.com/easy-chicken-soup/',
  'damndelicious.net': 'https://damndelicious.net/2014/04/04/slow-cooker-chicken-noodle-soup/',
  'natashaskitchen.com': 'https://natashaskitchen.com/chicken-noodle-soup-recipe/',
  'spendwithpennies.com': 'https://www.spendwithpennies.com/slow-cooker-chicken-noodle-soup/',
  'cookieandkate.com': 'https://cookieandkate.com/simple-tomato-soup-recipe/',
  'loveandlemons.com': 'https://www.loveandlemons.com/tomato-soup/',
  'justonecookbook.com': 'https://www.justonecookbook.com/miso-soup/',
  'woksoflife.com': 'https://thewoksoflife.com/kung-pao-chicken/',
  'maangchi.com': 'https://www.maangchi.com/recipe/dakgalbi',
}
```

For sites NOT in the curated list: construct a test URL by fetching
the site's homepage and finding a recipe link in the HTML.

---

## STEP 3 — Run compatibility tests

Create a script at scripts/test-site-compatibility.mjs that:

1. Loops through all sites (rate limited: 1 per 5 seconds to avoid hammering)
2. For each site:
   a. Gets the test URL (from SITE_TEST_URLS or homepage discovery)
   b. Calls the existing importFromUrl() function
   c. Runs checkRecipeCompleteness() on the result
   d. Calculates a rating (1-5):
      - 5: Complete import — all fields present, 5+ ingredients with quantities
      - 4: Good — title + description + ingredients with quantities + steps
      - 3: Partial — missing description OR some quantities missing
      - 2: Poor — missing ingredients OR missing steps
      - 1: Failed — no title OR complete failure
   e. Upserts to import_site_tracker with:
      - domain, rating, total_attempts++, successful_attempts (if rating ≥ 3)
      - failure_taxonomy updated with specific missing fields
      - sample_failing_urls if rating < 3
      - last_auto_tested_at = now()
      - notes = summary of what was found
3. Logs progress: "Testing allrecipes.com... ✓ Rating: 5"
4. At end: prints summary table of all results sorted by rating

### Run the script on RPi5:
```bash
ssh rasp@rpi5-eth
cd /mnt/chefsbook/repo
SUPABASE_SERVICE_ROLE_KEY=<key> node scripts/test-site-compatibility.mjs
```

This will take ~5-10 minutes for 60+ sites.

---

## STEP 4 — Update admin import-sites page display

After the crawl, the admin page should show all tested sites.
Verify /admin/import-sites shows the full list with:
- Domain name
- Rating (1-5 stars)
- Success rate %
- Last tested timestamp
- Failure taxonomy pills
- Block toggle

If the page still only shows 3 domains after the script runs,
check if the admin page query has a LIMIT or filter that needs updating.

---

## STEP 5 — Generate a compatibility report

After the crawl, create docs/SITE-COMPATIBILITY-REPORT-2026-04-15.md:

```markdown
# ChefsBook Recipe Site Compatibility Report
# Generated: 2026-04-15
# Sites tested: N
# Overall: X% compatible (rating ≥ 3)

## ⭐⭐⭐⭐⭐ Excellent (rating 5) — N sites
[list]

## ⭐⭐⭐⭐ Good (rating 4) — N sites
[list]

## ⭐⭐⭐ Partial (rating 3) — N sites
[list with what's missing]

## ⭐⭐ Poor (rating 2) — N sites
[list with failure reason]

## ⭐ Failed (rating 1) — N sites
[list with failure reason]

## Known Issues by Site
[For rating ≤ 3: specific notes on what failed and why]

## Recommendations
[Which sites to prioritize fixing in the import pipeline]
```

---

## STEP 6 — Update import-quality.md agent

Update .claude/agents/import-quality.md with the findings:
- Add top 10 problematic sites to "Known problematic sites" section
- Add any new failure patterns discovered
- Add recommended SCAN_PROMPT improvements for common failures

---

## COMPLETION CHECKLIST

- [ ] KNOWN_RECIPE_SITES list verified/rebuilt (60+ sites)
- [ ] SITE_TEST_URLS curated list created
- [ ] scripts/test-site-compatibility.mjs created
- [ ] Script run on RPi5 — all sites tested
- [ ] import_site_tracker populated with all results
- [ ] Admin /admin/import-sites shows all tested sites (not just 3)
- [ ] docs/SITE-COMPATIBILITY-REPORT-2026-04-15.md generated
- [ ] import-quality.md updated with findings
- [ ] feature-registry.md updated
- [ ] Run /wrapup
- [ ] At the end, recap: how many sites tested, how many rated 4-5,
      how many rated 1-2, top 5 most problematic sites found,
      and any surprising findings.
