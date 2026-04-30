# Prompt: Template Engine Rebuild — Phase 1 of 3

## LAUNCH PROMPT (paste this into Claude Code to start the session)

```
Read and execute docs/prompts/template-engine-rebuild.md fully and autonomously, from pre-flight through deployment and /wrapup. Do not stop for questions unless you hit a genuine blocker.
```

---

## TYPE: ARCHITECTURE — WEB ONLY

## Overview

This is Phase 1 of a complete rebuild of the ChefsBook PDF template system.
Read `docs/prompts/template-system-design.md` in full before doing anything else —
it is the authoritative design document for all three phases.

This session delivers the core engine and migrates all six existing templates to use it.
Phases 2 and 3 depend on this foundation being correct. Do not cut corners.

The root cause of every template rendering bug to date is that layout values were
hardcoded for Letter (8.5×11) pages. This session eliminates that permanently by
introducing `computeLayout(pageSize)` — a single function that derives all sizing
from the page dimensions passed in at render time.

No new UI. No admin features. Engine and templates only.

---

## Agent files to read — ALL of these, in order, before writing a single line of code

- `.claude/agents/wrapup.md`
- `.claude/agents/testing.md`
- `.claude/agents/feature-registry.md`
- `.claude/agents/publishing.md`
- `.claude/agents/pdf-design.md`
- `.claude/agents/ui-guardian.md`
- `.claude/agents/deployment.md`

Read publishing.md PATTERN 9 through PATTERN 14 AND the new LAYOUT rules 1–5
from `docs/prompts/template-system-design.md` before touching any template file.
Run ALL pre-flight checklists before writing any code.

---

## Pre-flight: before writing any code

1. Read `docs/prompts/template-system-design.md` in full. This is mandatory.
2. Read DONE.md entries for ALL of these sessions — know exactly what each changed:
   - LULU-PRINT (original Lulu integration)
   - PDF-REACT-PDF (first templates built)
   - PDF-REDESIGN (template redesign + pdf-design.md created)
   - COOKBOOK-BUILDER through COOKBOOK-BUILDER-3 (template additions + fixes)
   - PRINT-QUALITY-1 through PRINT-QUALITY-5 (all bug fixes)
   - BOOK-PREVIEW-1 (FillZone + page size selector)
   - PDF-STEP-BADGE-FIX + bbq-step-badge-fix (current state of bbq.tsx)
3. Read all six current template files in full before writing any engine code.
   Catalogue every hardcoded value in every template — font sizes, image heights,
   padding values, margin values. These all become `layout.*` references.
4. Read `apps/web/components/print/FlipbookPreview.tsx` in full.
5. Read `apps/web/app/api/print-cookbooks/[id]/generate/route.ts` in full.
6. Read `apps/web/lib/book-layout.ts` and `apps/web/lib/pdf-templates/types.ts` in full.
7. Confirm next available migration number from DONE.md (last used: 065).
8. Run `npx tsc --noEmit` in `apps/web` — record baseline error count.

---

## Task 1 — Create the engine directory and files

Create `apps/web/lib/pdf-templates/engine/` with these files:

### `engine/types.ts`

Define ALL shared interfaces as specified in `docs/prompts/template-system-design.md`:
- `PageDimensions`
- `ComputedLayout`
- `TemplateContext`
- `TemplateSettings`
- `TemplateManifest`

Also re-export any types from the existing `../types.ts` that templates need
(CookbookRecipe, FillContent, BookStrings, PageSizeKey, etc.) so templates only
need to import from `engine/types`.

### `engine/layout.ts`

Implement `computeLayout(pageSize: PageDimensions): ComputedLayout` exactly as
specified in `docs/prompts/template-system-design.md`. The scaling ratios in the design
document are the correct values — do not invent new ratios.

Export `PAGE_SIZES: Record<PageSizeKey, PageDimensions>` with all five sizes.

### `engine/register-fonts.ts`

Extract ALL font registration calls from the existing templates and generate route
into a single `registerFonts()` function called once at engine startup.

Fonts currently registered across the templates:
- Playfair Display (400, 700, 400 italic) — Trattoria, Heritage
- Inter (300, 400, 500, 600) — all templates — NO italic variants
- Oswald (400, 600) — BBQ
- Source Sans Pro (400, 600) — BBQ, Heritage
- Work Sans (300, 400, 600) — Nordic
- Libre Baskerville (400, 700) — Heritage

Rule: Inter must NEVER have italic variants registered (publishing.md PATTERN 11).

### `engine/validate.ts`

Implement `validateTemplate(code: string): ValidationResult` that checks:
1. No hardcoded `size="LETTER"` or other page size strings
2. No emoji Unicode characters (U+1F000 and above, plus common problem chars like ñ, ã)
3. No `height:` or `minHeight:` on elements whose style names contain "step" or "row"
4. Exports a default function
5. Does not import from outside the approved list

```typescript
interface ValidationResult {
  valid: boolean
  errors: string[]
  warnings: string[]
}
```

### `engine/test-recipe.ts`

A hardcoded sample `CookbookRecipe` object with:
- A title (12 words minimum)
- A description (2 sentences)
- 8 ingredients with quantities, units, and some with preparation notes
- 9 steps — at least 3 of which are long (30+ words) to test wrapping
- At least 2 additional images
- A timer value on at least one step
- A foreword
- Nutrition data

This is used for validation render tests and admin preview.

### `engine/index.ts`

Export the `TemplateEngine` class:

```typescript
class TemplateEngine {
  // Load and return a template component by id
  static getTemplate(id: string): TemplateComponent

  // Compute layout for a given page size key or dimensions
  static computeLayout(pageSize: PageSizeKey | PageDimensions): ComputedLayout

  // Build a TemplateContext for rendering
  static buildContext(
    recipe: CookbookRecipe,
    pageSize: PageSizeKey | PageDimensions,
    templateId: string,
    options?: { fillZone?: FillContent; isPreview?: boolean }
  ): TemplateContext

  // Validate a template component code string
  static validate(code: string): ValidationResult

  // List all available template manifests
  static listTemplates(): TemplateManifest[]
}
```

---

## Task 2 — Rebuild all six system templates

Move the existing templates from `apps/web/lib/pdf-templates/` to
`apps/web/lib/pdf-templates/system/` and rebuild each one to use the engine.

Rules for every template:
- Remove ALL hardcoded pixel values for margins, font sizes, image heights, and padding
- Replace every hardcoded value with its `layout.*` equivalent from TemplateContext
- Step row structure must follow LAYOUT-2 exactly (see design doc)
- Badge must follow LAYOUT-3 exactly — color from `settings.palette.accent` or a
  dark variant defined in the template's own palette constants, never hardcoded
- No conditional logic based on page size key (LAYOUT-4)
- FillZone behavior must be preserved from BOOK-PREVIEW-1 work
- CustomPage must render after RecipeContentPage (PATTERN 12)
- AdditionalImagePage must be present (added in PRINT-QUALITY-2)
- Preview/print image path split must be preserved (PATTERN from PRINT-QUALITY-3)
- No emoji or icon font characters (PATTERN 10)
- Inter: no italic variants (PATTERN 11)

Do the templates in this order:
1. `trattoria.tsx` — most complete, use as the reference implementation
2. `garden.tsx` — simplest (Inter only, minimal)
3. `nordic.tsx` — minimal (Work Sans only)
4. `studio.tsx` — dark background (test that dark themes work)
5. `heritage.tsx` — multiple fonts
6. `bbq.tsx` — do this last; it has the most recent fixes and is most fragile

For each template, after rebuilding it, run the render test at all five page sizes
with `engine/test-recipe.ts` before moving to the next one. Do not batch the testing.

---

## Task 3 — Update FlipbookPreview

Update `apps/web/components/print/FlipbookPreview.tsx` to use `TemplateEngine`:
- Replace the direct template import map with `TemplateEngine.getTemplate(id)`
- Replace the inline PAGE_SIZES map with `TemplateEngine.computeLayout(pageSize)`
- Confirm `ssr: false` on the dynamic import is still present (PATTERN 9)
- Confirm the scale factor calculation uses the layout dimensions correctly

---

## Task 4 — Update the generate route

Update `apps/web/app/api/print-cookbooks/[id]/generate/route.ts` to use `TemplateEngine`:
- Replace direct template imports with `TemplateEngine.getTemplate(id)`
- Replace the inline page size map with `TemplateEngine.computeLayout(pageSize)`
- Preserve the preview/print image path split (PRINT-QUALITY-3 — publishing.md PATTERN)
- Preserve all supabaseAdmin usage (publishing.md PATTERN 1 + 2)

---

## Task 5 — Database migration

Confirm next migration number from DONE.md before writing.

```sql
-- Migration 066: extend cookbook_templates for engine support
ALTER TABLE cookbook_templates
  ADD COLUMN IF NOT EXISTS manifest JSONB,
  ADD COLUMN IF NOT EXISTS component_code TEXT,
  ADD COLUMN IF NOT EXISTS thumbnail_url TEXT,
  ADD COLUMN IF NOT EXISTS is_system BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'inactive', 'draft', 'error')),
  ADD COLUMN IF NOT EXISTS supported_page_sizes TEXT[]
    NOT NULL DEFAULT ARRAY['letter'],
  ADD COLUMN IF NOT EXISTS lulu_compliant BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS validation_errors JSONB,
  ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

-- Mark all existing templates as system templates
UPDATE cookbook_templates SET is_system = true, lulu_compliant = true;

-- Populate manifests for the six system templates
-- (write one UPDATE per template with the correct manifest JSON)
```

After migration: `docker restart supabase-rest` on RPi5.

---

## Constraints

- Do NOT add any new UI features in this session — engine and templates only
- Do NOT change the visual appearance of any template — same colors, same fonts,
  same design. Only the internal sizing mechanism changes.
- Do NOT change the FillZone behavior introduced in BOOK-PREVIEW-1
- Do NOT change the CustomPage behavior introduced in PRINT-QUALITY-3
- Do NOT change the AdditionalImagePage behavior introduced in PRINT-QUALITY-2
- Do NOT touch any mobile files
- Do NOT introduce new npm dependencies

---

## Testing

### Automated

```bash
cd apps/web && npx tsc --noEmit
# Must pass with 0 errors
```

### Render test — MANDATORY before deploy

For EACH of the six templates, at EACH of the five page sizes, render the template
with `engine/test-recipe.ts` and confirm:

```
trattoria:  letter ✓  trade ✓  large-trade ✓  digest ✓  square ✓
studio:     letter ✓  trade ✓  large-trade ✓  digest ✓  square ✓
garden:     letter ✓  trade ✓  large-trade ✓  digest ✓  square ✓
heritage:   letter ✓  trade ✓  large-trade ✓  digest ✓  square ✓
nordic:     letter ✓  trade ✓  large-trade ✓  digest ✓  square ✓
bbq:        letter ✓  trade ✓  large-trade ✓  digest ✓  square ✓
```

30 combinations total. Do not skip any.

### Manual visual verification

1. Open the cookbook canvas editor in the browser
2. Select the BBQ template — open FlipbookPreview
3. Switch through all five page sizes in Book Settings
4. Confirm the preview rescales correctly at each size
5. Confirm step text wraps correctly at Square (8×8)
6. Confirm step badges are dark circles with white numbers (not amber)
7. Repeat steps 3–6 for Trattoria template
8. Confirm FillZone (Chef's Notes) still renders correctly at Letter size

### Checklist — do not deploy until all pass

- [ ] engine/types.ts created with all interfaces
- [ ] engine/layout.ts created with computeLayout()
- [ ] engine/register-fonts.ts created — all fonts extracted and registered
- [ ] engine/validate.ts created with ValidationResult
- [ ] engine/test-recipe.ts created with 9-step test recipe
- [ ] engine/index.ts created with TemplateEngine class
- [ ] All 6 templates rebuilt in system/ directory
- [ ] All 30 render test combinations pass
- [ ] FlipbookPreview updated to use TemplateEngine
- [ ] Generate route updated to use TemplateEngine
- [ ] Migration 066 applied and supabase-rest restarted
- [ ] `npx tsc --noEmit` passes with 0 errors
- [ ] Manual visual: BBQ badges dark, text wraps at Square
- [ ] Manual visual: page size switching works in FlipbookPreview
- [ ] Manual visual: FillZone renders correctly
- [ ] Deployed to RPi5 — HTTP 200 on chefsbk.app
- [ ] PM2 logs show no startup errors

---

## Deploy

Follow `deployment.md` exactly.

```bash
ssh rasp@rpi5-eth
/mnt/chefsbook/deploy-staging.sh
```

```bash
curl -I https://chefsbk.app/
# Expect: HTTP 200

curl -I https://chefsbk.app/dashboard/print-cookbook
# Expect: HTTP 200 or redirect to login

pm2 logs chefsbook-web --lines 30
# Expect: no startup errors
```

---

## Wrapup

Follow `wrapup.md` fully.

In DONE.md, record:
- All engine files created and their purpose
- Which templates had the most hardcoded values removed (and what they were)
- The render test results (all 30 combinations)
- Migration number used and columns added
- That Phase 2 (admin-template-dashboard.md) is ready to run

In `.claude/agents/publishing.md`, add the six new LAYOUT rules (LAYOUT-1 through
LAYOUT-5) to the known failure patterns section, marking them as established in this
session. Also mark PATTERN 13 and PATTERN 14 as permanently resolved by the engine.

In `docs/prompts/template-system-design.md`, update the Phase 1 status to COMPLETE with
the session name and date.
