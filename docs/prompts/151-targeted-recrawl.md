# ChefsBook — Session 151: Targeted Re-Crawl with PDF Capture + Translation
# Source: Session 150 fixed translation pipeline, session 146 added PDF fallback
# Target: packages/ai + scripts + database
# Dependency: Sessions 146 (PDF capture) and 150 (translation) must be deployed

---

## CONTEXT

Read CLAUDE.md, DONE.md, feature-registry.md, import-pipeline.md,
and import-quality.md before starting.

Previous crawls were flawed:
- Session 143: rated on HTTP status codes, not real imports
- Session 145: imported in source language, corrupted data

This crawl is different:
1. Uses the PDF/extension fallback for Cloudflare-blocked sites
2. Translates all content to English at import time
3. Saves real recipes under pilzner (a@aol.com)
4. Tags: "ChefsBook-v2" + domain + region (not "ChefsBook" to avoid
   confusion with the deleted batch)
5. Verifies each recipe is in English before saving

---

## TARGET SITES

Focus on 3 tiers:

### Tier 1 — Previously blocked, now testable via server-side fetch
Sites that session 145 rescued via homepage discovery:
- barefootcontessa.com
- thepioneerwoman.com
- delish.com
- saveur.com
- healthyrecipes101.com
- lacucinaitaliana.it (Italian — must translate to English)
- pequerecetas.com (Spanish — must translate)
- bonappetit.com
- pinchofyum.com
- sallysbakingaddiction.com
- kingarthurbaking.com
- loveandlemons.com
- tasteofhome.com
- bettycrocker.com

### Tier 2 — Cloudflare-blocked, needs PDF/extension fallback
These require needsBrowserExtraction signal:
- allrecipes.com
- bbcgoodfood.com
- jamieoliver.com
- seriouseats.com
- foodnetwork.com
- eatingwell.com
- marthastewart.com

### Tier 3 — International with translation
- marmiton.org (French) — already tested, works
- chefkoch.de (German)
- giallozafferano.it (Italian)
- matprat.no (Norwegian)
- valdemarsro.dk (Danish)
- allerhande.nl (Dutch)
- kwestiasmaku.com (Polish)

---

## STEP 1 — Update the crawl script

Update scripts/test-site-compatibility.mjs to:

### 1a — Save real recipes to DB
For every successful import, save the recipe under pilzner:

```javascript
const PILZNER_USER_ID = await getPilznerUserId()  // query from DB

async function saveImportedRecipe(recipe, domain, region) {
  // Verify recipe is in English before saving
  const titleLanguage = await detectLanguage(recipe.title)
  if (titleLanguage !== 'en') {
    console.log(`  ⚠ Recipe still in ${titleLanguage} — translation failed, skipping save`)
    return null
  }

  const tags = ['ChefsBook-v2', domain, region, ...(recipe.tags ?? [])]

  const { data, error } = await supabase
    .from('recipes')
    .insert({
      ...recipe,
      user_id: PILZNER_USER_ID,
      original_submitter_id: PILZNER_USER_ID,
      tags,
      visibility: 'private',
      is_complete: true  // crawl recipes are pre-verified
    })
    .select('id')
    .single()

  if (error) throw new Error(`DB save failed: ${error.message}`)
  return data.id
}
```

### 1b — Handle Cloudflare-blocked sites gracefully

For Tier 2 sites that return 403/429:
- Mark as `needs_extension: true` in import_site_tracker
- Do NOT rate as 1 star — rate as NULL with note:
  "Requires browser extension for import"
- Log clearly: "⚠ [domain] — blocked server-side, extension required"

### 1c — Verify translation for non-English sites

After import, always check:
```javascript
const lang = await detectLanguage(recipe.title)
if (lang !== 'en') {
  console.log(`  ✗ Translation failed — title still in ${lang}`)
  // Don't save, mark as translation_failed in tracker
  return { success: false, reason: 'translation_failed' }
}
console.log(`  ✓ Language verified: English`)
```

### 1d — Better rating calculation

Use the new rating formula from the admin fix:
- 5★ = complete import (title + desc + ≥5 ingredients with qty + ≥3 steps)
- 4★ = good (title + desc + ≥3 ingredients + ≥1 step)
- 3★ = partial (title + some ingredients OR some steps)
- 2★ = title + description only
- 1★ = title only or complete failure
- NULL = blocked (needs extension)

---

## STEP 2 — Run the crawl on RPi5

```bash
ssh rasp@rpi5-eth
cd /mnt/chefsbook/repo
git pull

export SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiAiSFMyNTYiLCAidHlwIjogIkpXVCJ9.eyJyb2xlIjogInNlcnZpY2Vfcm9sZSIsICJpc3MiOiAic3VwYWJhc2UiLCAiaWF0IjogMTc1MTAwMDAwMCwgImV4cCI6IDE5MDg3NjY0MDB9.d0A4kE4okczvSWbLw9WxzVr9sr2AMdzh09Lnu7T1eXQ
export ANTHROPIC_API_KEY=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
export REPLICATE_API_TOKEN=r8_ZE9sar6UuIxFjL7aEBrTrUJkaoe8Mt80sd6Og

node scripts/test-site-compatibility.mjs 2>&1 | tee /tmp/crawl-v2.log
```

Rate limit: 1 per 10 seconds (35 sites × 10s = ~6 minutes)

---

## STEP 3 — Generate images for new clean recipes

After the crawl, run image generation for the new ChefsBook-v2 recipes:

```bash
node scripts/generate-recipe-images.mjs
```

The script already processes recipes without images. The new crawl
recipes will be picked up automatically.

Verify:
- Images are food-appropriate (no wrong dishes)
- Chef's hat watermark visible bottom-right
- Titles match the dish shown in the image

---

## STEP 4 — Generate compatibility report v2

Create docs/SITE-COMPATIBILITY-REPORT-2026-04-16.md:

```markdown
# ChefsBook Site Compatibility Report v2
# Generated: 2026-04-16
# Methodology: Real imports with translation + PDF fallback
# Previous report: docs/SITE-COMPATIBILITY-REPORT-2026-04-15.md (flawed)

## Summary
- Sites tested: N
- Server-side compatible (≥3★): N (N%)
- Extension required: N sites
- Translation working: N non-English sites → English

## ⭐⭐⭐⭐⭐ Tier 1 — Full server-side import
[list with recipe titles imported as proof]

## ⭐⭐⭐ Tier 2 — Partial import (gaps)
[list with what's missing]

## 🔌 Extension Required
[list — these work perfectly WITH extension installed]

## ✗ Incompatible
[list with reason]

## Translation Results
[Non-English sites tested, source language → English result]
```

---

## STEP 5 — Update admin import-sites page

After the crawl, verify /admin/import-sites shows:
- Updated ratings based on real import attempts
- Correct success rate % alongside stars
- "Untested" for sites with no attempts
- "Extension required" note for Cloudflare-blocked sites

---

## COMPLETION CHECKLIST

### Crawl
- [ ] scripts/test-site-compatibility.mjs updated with:
      - Real recipe saving under pilzner tagged "ChefsBook-v2"
      - English language verification before save
      - NULL rating for blocked sites (not 1★)
      - Better 5-tier rating formula
- [ ] Crawl run on RPi5 for all 35 target sites
- [ ] Tier 1 sites: ≥10 recipes saved in English
- [ ] Tier 2 sites: marked as extension-required (not failed)
- [ ] International sites: translated correctly to English

### Images
- [ ] generate-recipe-images.mjs run for new ChefsBook-v2 recipes
- [ ] Images are food-appropriate (verified by description)
- [ ] No wrong dishes (apple tart = apple tart, not peach)

### Report
- [ ] docs/SITE-COMPATIBILITY-REPORT-2026-04-16.md generated
- [ ] Admin import-sites page reflects accurate data

### General
- [ ] feature-registry.md updated
- [ ] import-quality.md updated with v2 findings
- [ ] Committed and pushed
- [ ] Run /wrapup
- [ ] At the end recap:
      - How many recipes saved (must be in English)
      - Which Tier 1 sites worked best
      - Which Tier 2 sites confirmed as extension-required
      - How many non-English sites translated successfully
      - Image quality assessment (any wrong dishes?)
