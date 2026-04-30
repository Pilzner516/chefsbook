# ChefsBook Template System — Design Document
# Version 2.0 — Complete Rebuild
# Source of truth for all three rebuild sessions. Read this before any phase session.

---

## Why this exists

The original template system hardcoded layout values for Letter (8.5×11) pages.
Page size support was bolted on later without changing the underlying assumptions.
Every template has measurements calibrated for Letter — hero image heights, column
widths, padding, font sizes, step row sizing — that break silently at other page sizes.
Six bug-fix sessions (PRINT-QUALITY-1 through 5, PDF-STEP-BADGE-FIX) plus ongoing
regressions prove the patch-per-bug approach is not sustainable.

This rebuild solves the problem permanently and gives Admin the ability to add new
templates without writing code.

---

## Three phases

| Phase | Session prompt | What it delivers |
|-------|---------------|-----------------|
| 1 | template-engine-rebuild.md | Proportional layout engine + migrate all 6 templates |
| 2 | admin-template-dashboard.md | Admin UI to manage, preview, upload templates |
| 3 | ai-template-generation.md | AI generates new templates from a text description |

Run phases in order. Do not start Phase 2 until Phase 1 is deployed and verified.
Do not start Phase 3 until Phase 2 is deployed and verified.

---

## Core principle

Every layout-sensitive measurement in every template must be derived from
`computeLayout(pageSize)` — never hardcoded. A template that receives a `pageSize`
prop must render correctly at all five supported sizes without any conditional logic
per page size.

---

## Page sizes (points at 72dpi)

| Key | Name | Width | Height |
|-----|------|-------|--------|
| letter | 8.5×11 | 612 | 792 |
| trade | 6×9 | 432 | 648 |
| large-trade | 7×10 | 504 | 720 |
| digest | 5.5×8.5 | 396 | 612 |
| square | 8×8 | 576 | 576 |

---

## Lulu print specification (mandatory for all templates)

```
Bleed:   0.125" = 9pt on all sides
Margins: top/bottom 0.75" = 54pt
         inner      0.875" = 63pt
         outer      0.625" = 45pt
DPI:     300 minimum for images
Binding: Perfect bind (softcover)
Format:  Full colour interior
```

These margins are minimums for Lulu compliance. Templates may use larger margins
but never smaller. The `computeLayout()` function enforces these values.

---

## ComputedLayout interface

Every template receives a `layout` object computed by `computeLayout(pageSize)`.
Templates must use these values for all sizing. Direct use of `pageSize.width`
or `pageSize.height` inside templates is not permitted — use `layout.*` instead.

```typescript
export interface PageDimensions {
  width: number
  height: number
}

export interface ComputedLayout {
  // Page
  width: number
  height: number
  // Lulu-compliant margins (points)
  marginTop: number        // 54pt minimum
  marginBottom: number     // 54pt minimum
  marginInner: number      // 63pt minimum
  marginOuter: number      // 45pt minimum
  // Content area (after margins)
  contentWidth: number     // width - marginInner - marginOuter
  contentHeight: number    // height - marginTop - marginBottom
  // Typography scale — proportional to contentWidth
  fontTitle: number        // recipe title
  fontSubtitle: number     // section headers
  fontBody: number         // ingredient/step text
  fontCaption: number      // metadata, timers, captions
  fontStepNumber: number   // step badge numbers (fixed 11pt)
  lineHeight: number       // body line height multiplier
  // Component sizing — proportional to contentHeight
  heroImageHeight: number  // full-width hero photo
  thumbImageHeight: number // secondary/additional images
  // Fixed sizing — these do not scale
  badgeSize: number        // step badge circle diameter (22pt)
  badgeFontSize: number    // number inside badge (11pt)
  stepGap: number          // vertical gap between steps (10pt)
  sectionGap: number       // gap between major sections (16pt)
}

export function computeLayout(pageSize: PageDimensions): ComputedLayout {
  const marginTop = 54
  const marginBottom = 54
  const marginInner = 63
  const marginOuter = 45
  const contentWidth = pageSize.width - marginInner - marginOuter
  const contentHeight = pageSize.height - marginTop - marginBottom

  // Typography scales with content width
  // These ratios were derived from professional cookbook design standards
  const fontBody = contentWidth < 360 ? 9 : contentWidth < 420 ? 10 : 11
  const fontTitle = Math.round(contentWidth * 0.072)
  const fontSubtitle = Math.round(contentWidth * 0.045)
  const fontCaption = fontBody - 1

  return {
    width: pageSize.width,
    height: pageSize.height,
    marginTop,
    marginBottom,
    marginInner,
    marginOuter,
    contentWidth,
    contentHeight,
    fontTitle: Math.max(fontTitle, 20),
    fontSubtitle: Math.max(fontSubtitle, 13),
    fontBody,
    fontCaption: Math.max(fontCaption, 8),
    fontStepNumber: 11,
    lineHeight: 1.5,
    heroImageHeight: Math.round(contentHeight * 0.38),
    thumbImageHeight: Math.round(contentHeight * 0.28),
    badgeSize: 22,
    badgeFontSize: 11,
    stepGap: 10,
    sectionGap: 16,
  }
}
```

---

## TemplateContext interface

Every template component receives a single `ctx` prop of this type.
No template should require any other props.

```typescript
export interface TemplateContext {
  recipe: CookbookRecipe       // recipe data including steps, ingredients, images
  layout: ComputedLayout       // computed from pageSize — use this for all sizing
  settings: TemplateSettings   // colors, fonts from the template manifest
  strings: BookStrings         // localized UI strings
  fillZone?: FillContent       // optional fill zone config (chefs_notes, quote, etc)
  isPreview?: boolean          // true = FlipbookPreview, false = actual PDF generation
}

export interface TemplateSettings {
  palette: {
    accent: string             // primary brand color for this template
    background: string         // page background
    text: string               // primary text color
    muted: string              // secondary/caption text color
    surface: string            // card/section background
  }
  fonts: {
    heading: string            // registered font family name for titles
    body: string               // registered font family name for body text
  }
}
```

---

## Template component interface

Every template (built-in or admin-uploaded) must export a default function
that matches this exact signature:

```typescript
export default function TemplateName(ctx: TemplateContext): React.ReactElement
```

The function returns a react-pdf `<Page>` or `<Document>` fragment.
The template must not import anything outside of:
- `@react-pdf/renderer` primitives
- `../types` (TemplateContext, ComputedLayout, TemplateSettings)
- `../layout` (computeLayout — only if needed, layout is already passed in ctx)
- `../book-strings` (BookStrings — already passed in ctx.strings)

No external npm packages. No custom fonts loaded inside the template — fonts
are registered at the engine level before templates are called.

---

## Template manifest (manifest.json)

Every template has a manifest that describes it to the engine and to the admin UI.

```json
{
  "id": "trattoria",
  "name": "Trattoria",
  "description": "Warm rustic Italian style with cream background and red accents",
  "version": "2.0.0",
  "isSystem": true,
  "status": "active",
  "supportedPageSizes": ["letter", "trade", "large-trade", "digest", "square"],
  "luluCompliant": true,
  "fonts": [
    { "family": "Playfair Display", "weights": [400, 700], "italic": [400] },
    { "family": "Inter", "weights": [300, 400, 600] }
  ],
  "settings": {
    "palette": {
      "accent": "#CE2B37",
      "background": "#FAF7F0",
      "text": "#1A1A1A",
      "muted": "#6B6B6B",
      "surface": "#F0ECE0"
    },
    "fonts": {
      "heading": "Playfair Display",
      "body": "Inter"
    }
  }
}
```

---

## Database schema changes (Phase 1 migration)

Extend the existing `cookbook_templates` table:

```sql
ALTER TABLE cookbook_templates
  ADD COLUMN IF NOT EXISTS manifest JSONB,
  ADD COLUMN IF NOT EXISTS component_code TEXT,
  ADD COLUMN IF NOT EXISTS thumbnail_url TEXT,
  ADD COLUMN IF NOT EXISTS is_system BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'inactive', 'draft', 'error')),
  ADD COLUMN IF NOT EXISTS supported_page_sizes TEXT[] NOT NULL DEFAULT ARRAY['letter'],
  ADD COLUMN IF NOT EXISTS lulu_compliant BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS validation_errors JSONB,
  ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
```

System templates (the 6 built-in ones) have `is_system = true` and their component
code lives in the filesystem at `apps/web/lib/pdf-templates/`. Admin-uploaded and
AI-generated templates have `is_system = false` and their component code is stored
in the `component_code` column and evaluated at runtime.

---

## Known failure patterns — mandatory for all template sessions

These failures have each occurred at least once. Every template session must
prevent them. Full detail in `.claude/agents/publishing.md`.

| Pattern | Rule |
|---------|------|
| PATTERN 9 | FlipbookPreview must be dynamic import with ssr: false — never remove |
| PATTERN 10 | Never use emoji or icon font characters in PDF content — use View+Text or Svg primitives |
| PATTERN 11 | Inter has no italic variants — never use fontStyle: italic with Inter |
| PATTERN 12 | Page order: PhotoPage → AdditionalImagePage → RecipeContentPage → CustomPage |
| PATTERN 13 | Never use height/minHeight/maxHeight on step row Views — auto-height only |
| PATTERN 14 | Page size must be a prop — never hardcode size="LETTER" on Page component |

**New rules added in this rebuild (applies from Phase 1 onward):**

| Rule | Description |
|------|-------------|
| LAYOUT-1 | All sizing must come from layout.* — never use raw numbers for margins, fonts, or image heights |
| LAYOUT-2 | Step row structure: outer View (flexDirection:row, wrap:false) → badge View (flexShrink:0) → inner View (flex:1, paddingLeft:8) → Text |
| LAYOUT-3 | Badge: View with borderRadius = badgeSize/2, no SVG required, color from settings.palette.accent or a dark variant — read from template's own palette, never hardcode |
| LAYOUT-4 | Templates must not contain any conditional logic based on pageSize key — sizing adapts via computeLayout() values only |
| LAYOUT-5 | All six system templates must pass a render test at all five page sizes before any session wraps |

---

## Validation rules (used in Phase 2 admin dashboard)

A template passes validation when ALL of the following are true:

1. **Lulu margins**: layout.marginTop ≥ 54, marginBottom ≥ 54, marginInner ≥ 63, marginOuter ≥ 45
2. **No hardcoded page size**: component_code does not contain the string `size="LETTER"` or any other hardcoded size string
3. **No emoji**: component_code does not contain emoji Unicode characters
4. **No fixed step heights**: component_code does not contain `height:` or `minHeight:` on step row containers
5. **Correct export**: component_code exports a default function that accepts TemplateContext
6. **TypeScript clean**: code compiles with 0 errors in the project context
7. **Render test**: renders without throwing at all five page sizes with a test recipe

---

## File structure after rebuild

```
apps/web/lib/pdf-templates/
  engine/
    index.ts              — TemplateEngine class (loads, validates, renders templates)
    layout.ts             — computeLayout() function
    types.ts              — all shared interfaces
    validate.ts           — template validation logic
    register-fonts.ts     — font registration (called once at startup)
    test-recipe.ts        — sample recipe data for validation/preview
  system/
    trattoria.tsx         — rebuilt with layout engine
    studio.tsx            — rebuilt
    garden.tsx            — rebuilt
    heritage.tsx          — rebuilt
    nordic.tsx            — rebuilt
    bbq.tsx               — rebuilt
  book-strings.ts         — localized strings (unchanged)

apps/web/app/
  admin/
    templates/
      page.tsx            — template management dashboard (Phase 2)
  api/
    admin/
      templates/
        route.ts          — list, create, update, delete templates
        [id]/
          route.ts        — single template CRUD
          validate/
            route.ts      — run validation against a template
          preview/
            route.ts      — render template at a given page size
    print-cookbooks/
      [id]/
        generate/
          route.ts        — updated to use TemplateEngine
```

---

## Admin dashboard spec (Phase 2)

Route: `/admin/templates`
Access: admin_users only (same gate as all /admin/* pages)

### Template list view
- Grid of cards, one per template
- Each card: thumbnail image, template name, status badge (Active/Inactive/Draft/Error),
  supported page size pills, Lulu compliant checkmark or warning
- System templates show a lock icon (cannot be deleted, can be disabled)
- Actions per card: Preview | Edit Manifest | Enable/Disable | Delete (non-system only)

### Preview panel
- Opens as a side panel or modal
- Shows the template rendered at all five page sizes simultaneously using a test recipe
- Page size tabs: Letter | Trade | Large Trade | Digest | Square
- Uses the same FlipbookPreview component used in the cookbook builder

### Add template modal — two tabs

**Tab 1: Upload**
- Upload a ZIP file containing: component.tsx, manifest.json, thumbnail.png
- On upload: extract, run validation, show pass/fail with specific errors
- If validation passes: save to DB with status=draft, show preview
- Admin confirms → status set to active

**Tab 2: AI Generate**
- Text input: "Describe the template style"
- Optional: accent color picker, background color picker
- Generate button → calls `/api/admin/templates/generate`
- Shows generated template in preview panel
- Admin can regenerate or accept
- On accept: runs validation, saves with status=draft, admin confirms → active

---

## AI generation spec (Phase 3)

Route: `POST /api/admin/templates/generate`

Input:
```json
{
  "description": "Modern Japanese minimalist style with black and white",
  "accentColor": "#000000",
  "backgroundColor": "#FFFFFF"
}
```

The route calls Claude Sonnet with:
- The full template spec (this document's interfaces and rules)
- The known failure patterns from publishing.md
- The LAYOUT rules above
- One complete example template (trattoria.tsx rebuilt version) as reference
- The user's description and color choices

Output: valid TypeScript component code as a string.

After generation: automatically run validation. Return both the code and
the validation result. Do not save to DB from this route — the admin dashboard
handles saving after preview and confirmation.

Model: Claude Sonnet (not Haiku — code generation requires full capability)
Log to ai_usage_log: action=generate_template, model=sonnet

---

## Session sequence

### Phase status

| Phase | Status | Session |
|-------|--------|---------|
| 1 | COMPLETE | TEMPLATE-ENGINE-REBUILD + TEMPLATE-STYLESHEETS-FIX + PHASE1-MINPRESENCE (minPresenceAhead 40→100) |
| 2 | NOT STARTED | admin-template-dashboard.md |
| 3 | NOT STARTED | ai-template-generation.md |

### Phase 1 must deliver:
- `apps/web/lib/pdf-templates/engine/` directory with all engine files
- All 6 system templates rebuilt using the engine
- All 6 templates pass render test at all 5 page sizes
- Generate route updated to use TemplateEngine
- FlipbookPreview updated to use TemplateEngine
- Migration 066: extend cookbook_templates table
- TypeScript 0 errors
- Deployed and verified

### Phase 2 must deliver:
- `/admin/templates` page fully functional
- All CRUD operations working
- Preview panel working at all 5 page sizes
- Upload flow with validation working
- Enable/disable working
- Navigation item added to admin sidebar
- TypeScript 0 errors
- Deployed and verified

### Phase 3 must deliver:
- `POST /api/admin/templates/generate` route
- AI Generate tab in admin templates modal
- Validation runs automatically on generated code
- Generated template preview before saving
- ai_usage_log entries for generation calls
- TypeScript 0 errors
- Deployed and verified
