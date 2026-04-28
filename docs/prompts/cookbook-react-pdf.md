# Prompt: Cookbook PDF — React-PDF Engine + Three Award-Winning Templates

## LAUNCH PROMPT (paste this into Claude Code to start the session)

```
Read and execute docs/prompts/cookbook-react-pdf.md fully and autonomously, from pre-flight through deployment and /wrapup. Do not stop for questions unless you hit a genuine blocker. This is a large session — work through all steps in order without stopping.
```

---

## TYPE: FEATURE — WEB ONLY

## Overview

Replace the Puppeteer HTML-to-PDF pipeline with react-pdf (@react-pdf/renderer).
Build three genuinely distinct, award-winning cookbook templates. Add cover photo
upload and multi-image support per recipe. The user experience stays simple:
pick a template, optionally upload a cover photo, done.

This is a 4-phase session. Complete all phases before wrapup.

---

## Agent files to read — ALL of these, in order, before writing a single line of code

- `.claude/agents/wrapup.md`
- `.claude/agents/testing.md`
- `.claude/agents/feature-registry.md`
- `.claude/agents/ui-guardian.md`
- `.claude/agents/image-system.md`
- `.claude/agents/data-flow.md`
- `.claude/agents/deployment.md`
- `.claude/agents/pdf-design.md`

Run ALL pre-flight checklists before writing any code.

---

## Pre-flight: verify current state

```bash
# Check current PDF generation approach
cat apps/web/components/CookbookPdf.tsx | head -50
cat apps/web/app/api/cookbooks/\[id\]/generate/route.ts | head -80

# Check recipe_user_photos table (primary image source per CLAUDE.md)
ssh rasp@rpi5-eth "psql postgresql://supabase_admin:<pw>@localhost:5432/postgres -c '\d recipe_user_photos'"

# Check cookbooks table
ssh rasp@rpi5-eth "psql postgresql://supabase_admin:<pw>@localhost:5432/postgres -c '\d printed_cookbooks'"

# Check next available migration number
ls supabase/migrations/ | tail -5
```

CRITICAL: Per CLAUDE.md — recipe images live in `recipe_user_photos` table, NOT
`recipes.image_url`. All image fetching MUST use `getPrimaryPhotos()` +
`getRecipeImageUrl()` from `@chefsbook/db`. Never read `recipe.image_url` directly.

---

## Phase 1 — Database & Schema

### Migration: Add cover_image_url to printed_cookbooks

```sql
ALTER TABLE printed_cookbooks
  ADD COLUMN cover_image_url TEXT,
  ADD COLUMN selected_image_urls JSONB DEFAULT '{}';
  -- selected_image_urls: { [recipe_id]: string[] } — user-selected images per recipe
```

### Storage bucket

Confirm `cookbook-pdfs` bucket exists. Add `cookbook-covers` bucket for cover uploads:

```sql
INSERT INTO storage.buckets (id, name, public)
VALUES ('cookbook-covers', 'cookbook-covers', true)
ON CONFLICT DO NOTHING;
```

RLS policy — authenticated users can upload to their own folder:
```sql
CREATE POLICY "Users upload own covers" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'cookbook-covers' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Public read cookbook covers" ON storage.objects
  FOR SELECT USING (bucket_id = 'cookbook-covers');
```

After migrations: `docker restart supabase-rest`

---

## Phase 2 — Install react-pdf

```bash
cd apps/web
npm install @react-pdf/renderer
npm install --save-dev @types/react-pdf
```

Verify it installs without conflict. If there are peer dependency issues with
React 19, add `--legacy-peer-deps`.

react-pdf docs reference: https://react-pdf.org/

**Key react-pdf concepts to understand before building:**
- All layout uses Flexbox (like React Native, not web CSS)
- Text sizing is in points (pt), not px
- No CSS classes — all styles are inline objects via `StyleSheet.create()`
- Images must be fetched as base64 or accessible URLs
- `@react-pdf/renderer` renders server-side — use in API routes, not client components
- Fonts must be registered with `Font.register()` before use

---

## Phase 3 — Three Template Implementations

Build each template as a separate file:
- `apps/web/lib/pdf-templates/trattoria.tsx`
- `apps/web/lib/pdf-templates/studio.tsx`
- `apps/web/lib/pdf-templates/garden.tsx`

Each exports a single function: `generatePdf(cookbook, recipes, options) → Buffer`

### Shared type

```typescript
interface CookbookPdfOptions {
  cookbook: {
    title: string
    subtitle?: string
    author_name: string
    cover_style: 'classic' | 'modern' | 'minimal'
    cover_image_url?: string
    selected_image_urls?: Record<string, string[]>
  }
  recipes: Array<{
    id: string
    title: string
    description?: string
    cuisine?: string
    course?: string
    total_time?: number
    servings?: number
    ingredients: Array<{ group?: string; items: string[] }>
    steps: Array<{ text: string; duration_minutes?: number }>
    notes?: string
    image_urls: string[]  // all images for this recipe, primary first
  }>
}
```

---

### Template 1 — "Trattoria" (Classic)

**Personality:** Warm, rustic, editorial. Feels like a beloved Italian cookbook
from the 1970s. Marcella Hazan meets modern food photography.

**Colour palette:**
```
page background:  #faf7f0  (warm cream)
accent red:       #ce2b37
text primary:     #1a1a1a
text muted:       #7a6a5a
border:           #ddd8cc
cream dark:       #f0ece0
```

**Fonts:** Playfair Display (titles) + Inter (body)

**Cover page:**
- If cover_image_url provided: full-bleed image, title overlaid at bottom in
  large Playfair Display Bold white text on a semi-transparent cream gradient
  bar (bottom 35% of page)
- If no cover image: cream background, large centred hat icon (80pt),
  title in Playfair Display Bold 48pt, thin red rule, subtitle italic, author line
- Bottom: "Created with Chefsbook · chefsbk.app" small, muted

**Table of Contents:**
- Background: #f0ece0
- "Contents" heading: Playfair Display Bold 36pt, red
- 1pt red rule below heading
- Each entry: recipe name left (Playfair 13pt), single dotted border line,
  page number right (Inter Light 11pt, muted)
- Use flexbox row with borderBottom dotted on a spacer View

**Recipe layout — EACH RECIPE GETS TWO PAGES:**

*Page 1 (image page):*
- If recipe has image: full-bleed image taking 100% of page height and width
  (`objectFit: 'cover'`)
- Recipe name overlaid at bottom: semi-transparent cream bar (height ~120pt),
  recipe title in Playfair Display Bold 28pt, meta line below in Inter 10pt muted
- If no image: cream page with large decorative recipe title centred, cuisine
  as a pill tag in red

*Page 2 (content page):*
- Two-column layout using flexbox row:
  - Left column (38% width): cream-tinted background (#f0ece0), ingredients
    with red "INGREDIENTS" label, group headers in Inter SemiBold, items in Inter Regular
  - Right column (62% width): steps with large Playfair Display Bold red step
    numbers, step text in Inter Regular, timer line in green italic below each step
- If recipe has a second image: small image strip at bottom of right column
  (height 80pt, full column width, objectFit: 'cover')
- Notes section: below both columns, italic Inter, muted, thin top border

*Running footer on all content pages:*
Left: "Chefsbook" | Centre: recipe title | Right: page number
Inter Light 8pt, #7a6a5a, 0.5pt border-top

**Chapter dividers** (between cuisine groups, if 3+ cuisines):
- Full-bleed cream page
- Cuisine name in Playfair Display Bold 52pt, centred vertically
- Thin red rules above and below
- Recipe count: "12 Recipes · Italian" in Inter Light 12pt muted

---

### Template 2 — "Studio" (Modern)

**Personality:** Dark, dramatic, a chef's private notebook. Eleven Madison Park
meets Noma. Every recipe feels like a revelation.

**Colour palette:**
```
page background:  #1a1a1a  (near black)
card background:  #242424
accent red:       #ce2b37
text primary:     #f5f0e8  (warm white)
text muted:       rgba(245,240,232,0.5)
border:           rgba(245,240,232,0.12)
step number bg:   rgba(255,255,255,0.04)
```

**Fonts:** Playfair Display (titles) + Inter (body)

**Cover page:**
- If cover_image_url provided:
  - Left half: cover image, full height, objectFit: 'cover'
  - Right half: black background
  - Title: Playfair Display Bold 44pt, warm white, right half, vertically centred
  - Thin red horizontal rule (1pt, 60pt wide) above title
  - Subtitle: Inter Light Italic 16pt, muted, below rule
  - Author: Inter Light 12pt, muted, lower right
  - "Chefsbook" wordmark bottom right, small, muted
- If no cover image:
  - Full black page
  - Red horizontal bar 8pt tall at 40% from top, full width
  - Title above bar: Playfair Display Bold 48pt, warm white
  - Subtitle below bar: Inter Light Italic 18pt, red
  - Author: Inter Light 14pt, muted, lower centre

**Table of Contents:**
- Background: #1a1a1a
- "Contents" in Inter Light 9pt, letter-spacing 4, warm white, ALL CAPS
- Large page numbers as background decoration: Playfair Display 120pt,
  rgba(255,255,255,0.04), positioned behind each entry
- Each entry: recipe name in Playfair Display 14pt warm white, page number
  in Inter Light 11pt red, separated by full-width 0.5pt border

**Recipe layout — EACH RECIPE GETS TWO PAGES:**

*Page 1 (dramatic image page):*
- Full-bleed recipe image if available (objectFit: 'cover', full page)
- Dark overlay gradient from transparent to rgba(0,0,0,0.85) on bottom 50%
- Recipe title: Playfair Display Bold 34pt, white, overlaid bottom-left
- Meta line: Inter Light 10pt, rgba(255,255,255,0.6), below title
- If no image: black page, recipe title large centred in warm white,
  thin red rule as the only visual element

*Page 2 (content page):*
- Dark page background (#1a1a1a)
- Ingredients as a horizontal band across the top (not a column):
  - Pale border band (1pt rgba(255,255,255,0.12) top and bottom)
  - "INGREDIENTS" label Inter Light 8pt, letter-spacing 3, red, ALL CAPS
  - Ingredients flow in 3 columns within the band using flexbox wrap
  - Inter Light 10pt, warm white
- Steps section below the band:
  - Each step: step number in Playfair Display Bold 72pt,
    rgba(255,255,255,0.06) (giant ghost number as background art)
  - Step text in Inter Regular 11pt, warm white, overlaid on ghost number
  - Timer: Inter Italic 9pt, red, below step text
- Second image (if available): right-aligned, 40% page width, portrait crop,
  white border 4pt, positioned in steps section

*Running footer:*
Left: "Chefsbook" | Centre: recipe title | Right: page number
Inter Light 8pt, rgba(255,255,255,0.35), 0.5pt border-top rgba(255,255,255,0.12)

---

### Template 3 — "Garden" (Minimal)

**Personality:** Fresh, airy, maximally editorial. Ottolenghi meets a modern
art museum. Celebrates the food photography above all else.

**Colour palette:**
```
page background:  #ffffff  (pure white)
accent green:     #009246  (basil — primary accent, NOT red)
accent red:       #ce2b37  (secondary, used sparingly)
text primary:     #1a1a1a
text muted:       #9a8a7a
border:           #e8e0d0
photo frame:      #f0ece0
```

**Fonts:** Inter ONLY (both titles and body — the key differentiator from other templates)
Title weight: Inter Bold 700
Body weight: Inter Light 300 and Regular 400

**Cover page:**
- If cover_image_url provided:
  - Image in a large square or portrait frame, centred, generous white margins
    (margin: 60pt on all sides)
  - Thin green border around image (1pt)
  - Title ABOVE image: Inter Bold 38pt, #1a1a1a, centred, tight tracking
  - Subtitle below title: Inter Light 16pt, muted, centred
  - Author very bottom: Inter Light 11pt, muted
  - "chefsbk.app" in green, very small, bottom right
- If no cover image:
  - White page
  - 6pt green bar across very top
  - Title centred, Inter Bold 52pt
  - Small green horizontal rule (2pt, 48pt wide) below title
  - Subtitle and author below

**Table of Contents:**
- Pure white background
- Thin 1pt green rule across top
- "Contents" in Inter Light 9pt, letter-spacing 4, green, ALL CAPS
- Each entry on its own line:
  - Recipe title: Inter Regular 13pt, #1a1a1a
  - Page number: Inter Light 11pt, muted, right
  - Dotted border bottom: 0.5pt, #e8e0d0
- Generous line-height (20pt per entry)

**Recipe layout — EACH RECIPE GETS 1-3 PAGES depending on content:**

*If recipe has 1 image:*
- Page 1: image takes top 55% of page (full width, objectFit: 'cover',
  thin frame border 4pt #f0ece0)
- Below image: recipe title in Inter Bold 28pt, meta line Inter Light 10pt muted
- Ingredients and steps in a single flowing column, generous margins (48pt each side)

*If recipe has 2+ images (editorial grid layout):*
- Page 1: asymmetric image grid
  - Primary image: 65% width, full left column, full page height, objectFit: 'cover'
  - Right column: top 50% = second image; bottom 50% = recipe title + meta
- Page 2: ingredients + steps in single column with generous whitespace

*Content page layout:*
- Single column, 48pt margins each side
- "INGREDIENTS" in Inter SemiBold 8pt, letter-spacing 3, green, ALL CAPS
- Thin green 1pt rule below label
- Ingredients: Inter Regular 11pt, 22pt line-height
- No bullet points — use an en-dash `–` in green before each item
- "STEPS" label same treatment
- Step numbers: Inter Bold 18pt, green
- Step text: Inter Light 12pt, 20pt line-height
- Timer: Inter Light Italic 10pt, muted, parenthetical "(30 minutes)"
- Notes: Inter Light Italic 11pt, muted, thin top border green

*Running footer:*
Left: "Chefsbook" | Centre: recipe title | Right: page number
Inter Light 8pt, #9a8a7a, 0.5pt border-top #e8e0d0

---

## Phase 4 — Wizard UI Updates

### Step 2 (Book Details) — Add cover photo upload

After the existing title/subtitle/author fields, add:

```
COVER PHOTO  (optional)
[ Drag photo here or click to upload ]
Supported: JPG, PNG — max 10MB

[Preview shows how the cover will look with this template]
```

On upload:
- Upload to Supabase Storage: `cookbook-covers/{user_id}/{cookbook_id}/cover.jpg`
- Store URL in `printed_cookbooks.cover_image_url`
- Show a small live preview of the cover (simplified, not full PDF render)

### Step 1 (Template Selection) — Redesign picker

Replace the current simple text selector with three full visual cards.
Each card should show:
- A representative preview image (design a SVG mockup of each template)
- Template name + one-line description
- Selected state: red border + checkmark

Layout: three cards horizontally on desktop, stacked on mobile.

```
┌──────────────┐  ┌──────────────┐  ┌──────────────┐
│ [Preview]    │  │ [Preview]    │  │ [Preview]    │
│              │  │              │  │              │
│  Trattoria   │  │    Studio    │  │    Garden    │
│  Warm & rustic│  │ Dark & bold  │  │ Clean & airy │
└──────────────┘  └──────────────┘  └──────────────┘
```

The SVG previews should be designed inline — do NOT use placeholder images.
Design them properly to give a genuine feel for each template's aesthetic.

### Step 3 (Print Options) — No changes needed

### Generate route updates

Update `apps/web/app/api/cookbooks/[id]/generate/route.ts`:

1. Import the correct template based on `cookbook.cover_style`
2. Fetch all recipe images using `getPrimaryPhotos()` from `@chefsbook/db`
   (NEVER use `recipe.image_url` directly — see CLAUDE.md critical patterns)
3. Use `selected_image_urls` from the cookbook record if set, otherwise
   use all available photos for the recipe (up to 3)
4. Pass `cover_image_url` to the template if set
5. Use `renderToBuffer()` from `@react-pdf/renderer` to generate the PDF
6. Upload the resulting buffer to Supabase Storage
7. Return the storage URL

```typescript
import { renderToBuffer } from '@react-pdf/renderer'
import { generateTrattoriaPdf } from '@/lib/pdf-templates/trattoria'
import { generateStudioPdf } from '@/lib/pdf-templates/studio'
import { generateGardenPdf } from '@/lib/pdf-templates/garden'

const template = {
  classic: generateTrattoriaPdf,
  modern: generateStudioPdf,
  minimal: generateGardenPdf,
}[cookbook.cover_style] ?? generateTrattoriaPdf

const pdfBuffer = await renderToBuffer(
  template({ cookbook, recipes: recipesWithImages })
)
```

---

## Font Registration

Register fonts at the top of each template file:

```typescript
import { Font } from '@react-pdf/renderer'

Font.register({
  family: 'Playfair Display',
  fonts: [
    { src: 'https://fonts.gstatic.com/s/playfairdisplay/v30/nuFiD-vYSZviVYUb_rj3ij__anPXDTzYgEM86xQ.ttf', fontWeight: 400 },
    { src: 'https://fonts.gstatic.com/s/playfairdisplay/v30/nuFlD-vYSZviVYUb_rj3ij__anPXBYf9lW4e5j5hNKc.ttf', fontWeight: 700 },
    { src: 'https://fonts.gstatic.com/s/playfairdisplay/v30/nuFjD-vYSZviVYUb_rj3ij__anPXDTzYh0c3iA.ttf', fontStyle: 'italic' },
  ]
})

Font.register({
  family: 'Inter',
  fonts: [
    { src: 'https://fonts.gstatic.com/s/inter/v13/UcCO3FwrK3iLTeHuS_fvQtMwCp50KnMw2boKoduKmMEVuLyfAZ9hiJ-Ek-_EeA.woff', fontWeight: 300 },
    { src: 'https://fonts.gstatic.com/s/inter/v13/UcCO3FwrK3iLTeHuS_fvQtMwCp50KnMw2boKoduKmMEVuI6fAZ9hiJ-Ek-_EeA.woff', fontWeight: 400 },
    { src: 'https://fonts.gstatic.com/s/inter/v13/UcCO3FwrK3iLTeHuS_fvQtMwCp50KnMw2boKoduKmMEVuFuYAZ9hiJ-Ek-_EeA.woff', fontWeight: 600 },
    { src: 'https://fonts.gstatic.com/s/inter/v13/UcCO3FwrK3iLTeHuS_fvQtMwCp50KnMw2boKoduKmMEVuGKYAZ9hiJ-Ek-_EeA.woff', fontWeight: 700 },
  ]
})
```

Note: If Google Fonts URLs are unreliable from RPi5, download the TTF files and
serve them from `apps/web/public/fonts/` instead. Check connectivity first.

---

## Update pdf-design.md agent

After building all three templates, update `.claude/agents/pdf-design.md` to:
- Note that the engine is now react-pdf (not Puppeteer)
- Add react-pdf specific patterns and gotchas discovered during the build
- Remove any HTML/CSS advice that no longer applies
- Document the font registration approach that worked

---

## Testing

### Unit-level
```bash
cd apps/web && npx tsc --noEmit
```

### Integration test — generate one PDF per template

Create a test script at `apps/web/scripts/test-pdf.ts`:

```typescript
import { generateTrattoriaPdf } from '../lib/pdf-templates/trattoria'
import { generateStudioPdf } from '../lib/pdf-templates/studio'
import { generateGardenPdf } from '../lib/pdf-templates/garden'
import { renderToBuffer } from '@react-pdf/renderer'
import { writeFileSync } from 'fs'

const testData = {
  cookbook: {
    title: 'My Test Cookbook',
    subtitle: 'A collection of favourite recipes',
    author_name: 'Chef Pilzner',
    cover_style: 'classic' as const,
  },
  recipes: [
    {
      id: '1',
      title: 'Beautiful Burger Buns',
      description: 'Soft, sweet golden buns perfect for any burger.',
      cuisine: 'American',
      course: 'Side',
      total_time: 40,
      servings: 8,
      ingredients: [
        { items: ['3½ cups all-purpose flour', '1 large egg', '¼ cup sugar'] }
      ],
      steps: [
        { text: 'Mix all dry ingredients together.', duration_minutes: 5 },
        { text: 'Knead until smooth dough forms.', duration_minutes: 10 },
        { text: 'Let rise until doubled.', duration_minutes: 90 },
      ],
      image_urls: [],
    }
  ]
}

// Test all three templates
for (const [name, fn] of [
  ['trattoria', generateTrattoriaPdf],
  ['studio', generateStudioPdf],
  ['garden', generateGardenPdf],
]) {
  const element = fn({ ...testData, cookbook: { ...testData.cookbook, cover_style: name as any } })
  const buffer = await renderToBuffer(element)
  writeFileSync(`/tmp/test-${name}.pdf`, buffer)
  console.log(`✓ ${name}: /tmp/test-${name}.pdf (${Math.round(buffer.length / 1024)}KB)`)
}
```

Run: `cd apps/web && npx tsx scripts/test-pdf.ts`

Open each of the three PDFs and visually confirm they look distinct.

### Live test
1. Deploy to RPi5
2. Go to /dashboard/print
3. Select "Trattoria", generate → open PDF, verify design
4. Select "Studio", generate → open PDF, verify dark theme
5. Select "Garden", generate → open PDF, verify minimal/airy feel
6. Test with a cover photo upload → verify it appears on the cover

---

## Deploy

Follow `deployment.md`. Deploy web to RPi5 via `/mnt/chefsbook/deploy-staging.sh`.

Note: react-pdf renders server-side, so no client bundle size impact.
The generate API route may take 10-30 seconds for a full cookbook — this is normal.
If PM2 times out, increase the API route timeout in next.config.js:
```javascript
// next.config.js
module.exports = {
  api: { responseLimit: false },
  experimental: { serverActions: { bodySizeLimit: '50mb' } }
}
```

---

## Wrapup

Follow `wrapup.md` fully.

Required proof:
1. Three PDF files generated and opened — describe what each looks like
2. TypeScript compiles: `npx tsc --noEmit` passes
3. Cover photo upload works (screenshot of upload UI)
4. pdf-design.md agent updated to reflect react-pdf engine
5. All items in feature-registry.md updated for Print Cookbook feature
6. AGENDA.md updated: note Stripe payment integration still pending

Session name: PDF-REACT-PDF
