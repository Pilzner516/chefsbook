# Prompt: Cookbook Templates — Polish Pass (All Three Templates)

## LAUNCH PROMPT (paste this into Claude Code to start the session)

```
Read and execute docs/prompts/cookbook-template-polish.md fully and autonomously, from pre-flight through deployment and /wrapup. Do not stop for questions unless you hit a genuine blocker.
```

---

## TYPE: UI POLISH

## Context

Three react-pdf templates are built (Trattoria/Classic, Studio/Modern, Garden/Minimal).
Visual inspection of generated PDFs reveals 8 specific issues to fix in this session.

---

## Agent files to read before writing any code

- `.claude/agents/wrapup.md`
- `.claude/agents/testing.md`
- `.claude/agents/pdf-design.md`
- `.claude/agents/deployment.md`

---

## Pre-flight

Confirm file locations:
```bash
ls apps/web/lib/pdf-templates/
# Should show: trattoria.tsx  studio.tsx  garden.tsx
```

---

## Fix 1 — Timer "ñ" bug (ROOT CAUSE — DB data, not template)

**Status:** Still present in Studio and Trattoria. Fixed in Garden only.
**Evidence:** pdf_6 and pdf_7 show `ñh 30min`, `ñh`, `ñ7 min` throughout steps.

The Garden template fixed it correctly. Find what Garden does differently and apply
the SAME approach to Studio and Trattoria templates.

Additionally, fix the root cause in the data pipeline:

```sql
-- Check how many recipes have ñ in step text
SELECT COUNT(*) FROM recipes WHERE steps::text LIKE '%ñ%';

-- Preview a sample
SELECT id, title, steps FROM recipes WHERE steps::text LIKE '%ñ%' LIMIT 3;
```

If `ñ` is stored in the DB steps data itself:
- Write a migration to strip `ñ` from all step text in the DB
- The timer duration values that follow will remain intact
- Log the count of affected recipes in DONE.md

```sql
-- Migration to clean ñ from steps data
UPDATE recipes
SET steps = REPLACE(steps::text, 'ñ', '')::jsonb
WHERE steps::text LIKE '%ñ%';
```

After the DB fix, verify:
```sql
SELECT COUNT(*) FROM recipes WHERE steps::text LIKE '%ñ%';
-- Should return 0
```

---

## Fix 2 — Garden cover: title vertically centred

**Status:** Title renders at the very top of the page with vast empty space below.

The cover page container should use `justifyContent: 'center'` (vertical) and
`alignItems: 'center'` (horizontal) to centre all content on the page.

Current structure appears to be top-aligned. Fix:
- Wrap all cover content in a View with `style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 60 }}`
- The hat icon, title, green rule, subtitle, and author should all sit as a group in the vertical centre
- "Created with ChefsBook · chefsbk.app" stays pinned to the bottom using `position: 'absolute', bottom: 40`

---

## Fix 3 — Trattoria image page: title position

**Status:** Recipe title sits at the very bottom of the image page, cramped.

Move the cream overlay bar from the bottom 20% to the bottom 30% of the page.
The title should sit in the MIDDLE of that cream zone, not pressed against the bottom edge.
Give the title `marginTop: 16` and `marginBottom: 8` breathing room inside the bar.

---

## Fix 4 — Trattoria content page: left column dead space

**Status:** Ingredient left column (cream background) is full page height even when
only a few ingredients exist, leaving a large cream blank below the list.

Fix: remove the fixed height from the left column container. Instead use:
```
leftColumn: {
  width: '38%',
  backgroundColor: '#f0ece0',
  padding: 24,
  // NO fixed height — let content determine height
  alignSelf: 'flex-start',  // shrink to content height
}
```

The right column (steps) may then be taller than the left, which is correct behaviour.

---

## Fix 5 — Watermarks on stock photos

**Status:** Stock images from recipe imports may have visible watermarks (Shutterstock,
Getty, etc.) which print into the cookbook.

**This is a data quality issue, not a template issue.** The template cannot remove
watermarks from images it receives.

The correct fix is at the image sourcing layer:
- Check `apps/web/lib/pdf-templates/` — when fetching recipe images, confirm the
  source is `recipe_user_photos` table (user-uploaded or AI-generated images)
- Stock import images that come from `recipes.image_url` (scraped from websites)
  may have watermarks
- Add a fallback: if a recipe's only image source is `recipes.image_url` (not from
  `recipe_user_photos`), render a styled placeholder instead of the external image
- The placeholder should be: cuisine emoji centred on a cream background with the
  recipe title — this looks intentional and professional

Add a note to the cookbook wizard Step 1 (recipe selection): small text under each
recipe card saying "Add your own photo" with a camera icon if the recipe only has
a scraped image, encouraging users to upload their own.

---

## Fix 6 — Book naming: "Cookbook" in title

**Status:** The book is never referred to as a "cookbook" anywhere.

Add "A ChefsBook Cookbook" as a small subtitle line on the title page of all three
templates, positioned below the author line:

```
my Chef's book
Because it's that good
─────────────
by Chef

A ChefsBook Cookbook
```

Style: Inter Light 10pt, muted colour, centred. Small and understated — not competing
with the main title.

---

## Fix 7 — Foreword page

**Status:** No foreword exists. Users need a place to add personal text.

**Schema change:** Add `foreword TEXT` column to `printed_cookbooks` table:

```sql
ALTER TABLE printed_cookbooks ADD COLUMN foreword TEXT;
```

**Wizard UI change (Step 2 — Book Details):**
Add a foreword textarea after the subtitle field:

```
FOREWORD  (optional)
┌─────────────────────────────────────────────┐
│ Add a personal message, dedication, or      │
│ introduction to your cookbook...            │
│                                             │
│                              0 / 1000 chars │
└─────────────────────────────────────────────┘
```

- Multiline textarea, max 1000 characters
- Character counter shown
- Placeholder text: "Add a personal message, dedication, or introduction to your cookbook..."
- Label above: "FOREWORD (optional)" in the same style as other form labels

**PDF change — all three templates:**
If `cookbook.foreword` is set (non-empty), insert a Foreword page between the TOC
and the first recipe page.

Foreword page layout (same for all templates, adapting colours to each theme):
```
┌─────────────────────────────────────────────┐
│                                             │
│  F O R E W O R D                           │  ← Inter Light 9pt, letter-spacing 4, accent colour
│  ──────────────                             │  ← thin accent rule
│                                             │
│  [foreword text in Playfair Display         │
│   Italic 13pt, generous line-height,        │
│   centred or left-aligned, max 600pt wide]  │
│                                             │
│                           — Author Name     │  ← right-aligned, Inter Light 11pt, muted
│                                             │
└─────────────────────────────────────────────┘
```

Colours per template:
- Trattoria: cream background, red accent rule, dark text
- Studio: dark background, red accent rule, warm white text
- Garden: white background, green accent rule, dark text

---

## Fix 8 — End-of-book blurb about ChefsBook

**Status:** The final page has the ChefsBook wordmark and URL but no explanatory text.

Update the back page of all three templates to include a brief, warm blurb:

```
[Hat icon]

ChefsBook

Your recipes, beautifully collected.

─────────

This cookbook was created with ChefsBook — the app that helps you
save, organise, and share the recipes that matter most.
Import from any website, scan handwritten cards, or create your
own. Your collection, always with you.

Discover ChefsBook at chefsbk.app
```

Style: Inter Light 12pt, centred, muted colour, 60pt margins each side.
The blurb text should be warm and inviting — not a sales pitch.
The URL `chefsbk.app` should be in the accent colour (red for Trattoria/Studio,
green for Garden).

---

## Testing

Generate a test PDF for each template and verify all 8 fixes:

```bash
cd apps/web && npx tsx scripts/test-pdf.ts
# If test script doesn't exist yet, trigger via the generate API
```

Checklist per PDF:
- [ ] No `ñ` characters anywhere in steps text
- [ ] Garden cover: title and content vertically centred
- [ ] Trattoria image pages: title has breathing room in cream bar
- [ ] Trattoria content pages: left column shrinks to ingredient count
- [ ] Watermarked images replaced with styled placeholder
- [ ] "A ChefsBook Cookbook" line on all title pages
- [ ] Foreword page present (use test foreword text: "This collection represents years of cooking, sharing, and loving food with family and friends. May these recipes bring as much joy to your table as they have to mine.")
- [ ] Back page has warm ChefsBook blurb

Also verify psql confirms ñ cleanup:
```sql
SELECT COUNT(*) FROM recipes WHERE steps::text LIKE '%ñ%';
-- Must be 0
```

---

## Deploy

Follow `deployment.md`. Deploy web to RPi5.
Apply DB migration for `foreword` column + ñ cleanup migration.
Restart PostgREST after schema change: `docker restart supabase-rest`

---

## Wrapup

Follow `wrapup.md` fully.
Record in DONE.md: how many recipe rows had ñ cleaned from their steps data.
Session name: PDF-POLISH
