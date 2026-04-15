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
- seriouseats.com: ingredients sometimes missing (non-standard JSON-LD)
- cooking.nytimes.com: paywalled, may return partial content
- instagram.com: BLOCKED — use photo import instead
- youtube.com: transcript-based, steps quality varies
- tasty.co: video-first, steps often sparse
- pinterest.com: never contains full recipe; always redirects off-site

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
