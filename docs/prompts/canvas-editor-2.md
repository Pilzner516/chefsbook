# Prompt: Print My ChefsBook — Canvas Editor Session 2 (UI Completion)

## LAUNCH PROMPT (paste this into Claude Code to start the session)

```
Read and execute docs/prompts/canvas-editor-2.md fully and autonomously. Before writing any code, run the regression smoke test from testing.md — the previous session skipped it. Do not stop for questions unless you hit a genuine blocker.
```

---

## TYPE: FEATURE — WEB ONLY — NO MOBILE CHANGES

**CRITICAL: Zero mobile changes. If any apps/mobile file appears in a diff, stop.**

---

## Session name: CANVAS-EDITOR-2

## Context

Session CANVAS-EDITOR-1 built the foundation:
- Migration 063: `book_layout` column on `printed_cookbooks`
- Migration 064: `cookbook_templates` table (6 seed rows)
- `lib/book-layout.ts` — types and helpers
- `lib/pdf-templates/book-strings.ts` — 5-locale string table
- API routes: POST/GET/PATCH/DELETE `/api/print-cookbook`
- Canvas editor page at `/dashboard/print-cookbook/[id]`
- Sidebar nav item "Print My ChefsBook"
- Auto-save (800ms debounce)
- Generate PDF button wired

This session completes the deferred UI items.

---

## Agent files — read ALL before writing any code

- `.claude/agents/wrapup.md`
- `.claude/agents/testing.md` — MANDATORY, run smoke test FIRST
- `.claude/agents/feature-registry.md`
- `.claude/agents/ui-guardian.md`
- `.claude/agents/image-system.md`
- `.claude/agents/data-flow.md`
- `.claude/agents/deployment.md`
- `.claude/agents/pdf-design.md`

---

## Step 0 — Regression smoke test (MANDATORY BEFORE ANY CODE)

The previous session skipped this. Run it now:

```bash
curl -I https://chefsbk.app/          # 200
curl -I https://chefsbk.app/dashboard  # 200 or 302
curl -I https://chefsbk.app/dashboard/print-cookbook  # 200
curl -I https://chefsbk.app/admin      # 200
```

Also verify the canvas editor loads correctly:
1. Navigate to `/dashboard/print-cookbook` in browser (via developer tools / curl)
2. Confirm no JS console errors on load
3. Confirm the sidebar shows "Print My ChefsBook"

Only proceed to building if smoke tests pass.

---

## Build priority order — complete in this sequence

### Priority 1 — Language selector (quick win, 30 min)

The `book-strings.ts` was built last session but never wired to the UI.

In the Book Settings panel, add a language dropdown:

```
Book Language
┌─────────────────────────┐
│  🌐  English (EN)     ▾ │
└─────────────────────────┘
```

Options: English · Français · Español · Italiano · Deutsch

- Default: user's current app language (read from i18n context or user profile)
- Saves to `book_layout.language` via the auto-save pipeline
- Passed to the PDF generate route so templates use `getStrings(language)`
- Verify the generate route actually passes language to the react-pdf templates

---

### Priority 2 — Image print quality checking

Create `apps/web/lib/print-quality.ts`:

**Quality tiers (300 DPI = great, 150-299 = acceptable, <150 = poor)**

Print size requirements for quality calculation:
| Usage | Print dimensions |
|---|---|
| Full-bleed recipe photo | 8.5" × 5.5" |
| Cover image (with bleed) | 8.75" × 11.25" |
| Half-page photo (split layout) | 4.25" × 11" |
| Custom page full image | 8.5" × 10.5" |

**Pre-flight:** Check if `recipe_user_photos` already stores `width_px`/`height_px`.
If it does, use those. If not, use `new Image()` to probe dimensions in the browser.

**Quality badges on image thumbnails:**
- 🟢 ≥300 DPI — no message shown (silent)
- 🟡 150-299 DPI — warning shown, "Use anyway" offered
- 🔴 <150 DPI — error shown, "Use anyway" NOT offered for recipe/cover photos
  (sentimental custom page photos: "Keep it — I understand" IS offered)

**Inline warning when 🟡 selected:**
```
⚠️  This photo (640×480 px) may print soft.
    For crisp results, use at least 1275×825 px.
    [Upload a better photo]  [Use it anyway]
```

**Pre-generate quality summary** (shown before "Generate PDF →" if issues exist):
```
⚠️  2 photos may not print crisply
    • Burger Buns — selected photo (soft at print size)
    • Cover image (soft at print size)
    [Review photos]     [Generate anyway →]
```

If any 🔴 image exists: replace "Generate anyway" with "Fix low-resolution photos first"
and block generation.

**Caching:** Store quality results in a `Map<imageUrl, QualityResult>` in component
state — never re-check the same URL twice in a session.

---

### Priority 3 — Custom page image upload

Custom page images upload to: `cookbook-pdfs/{user_id}/custom/{page_id}.jpg`

- Use existing Supabase Storage pattern from `image-system.md`
- Max 10MB, accept JPEG/PNG/WebP
- Show upload progress
- Run print quality check immediately after upload completes
- Show quality badge on the uploaded image

---

### Priority 4 — Flipbook Preview (3D page turn)

Create `apps/web/components/print/FlipbookPreview.tsx`

Opened via "Preview Book ▶" button in the canvas toolbar.
Shown as a full-page overlay (high z-index div, not a modal — no `position:fixed`
anywhere — use a flow div with `min-height: 100vh`).

**Page dimensions:** 196px × 254px (8.5:11 ratio at ~24% scale)
**Size badge:** "8.5 × 11 in · Letter / Lulu standard · ~24% scale"

**3D page turn animation:**
```css
/* Forward flip: right page folds left */
.turning-leaf-forward {
  transform-style: preserve-3d;
  transform-origin: left center;
  animation: flipForward 0.65s cubic-bezier(.645,.045,.355,1) forwards;
}
@keyframes flipForward {
  from { transform: rotateY(0deg); }
  to   { transform: rotateY(-180deg); }
}

/* Each leaf has front + back faces */
.leaf-front, .leaf-back {
  position: absolute;
  inset: 0;
  backface-visibility: hidden;
  overflow: hidden;
}
.leaf-back {
  transform: rotateY(180deg);
}
```

**Animation sequence (forward flip):**
1. Create turning leaf positioned over right page
2. Front face = current right page content
3. Back face = next left page content (at `rotateY(180deg)` — correctly oriented when parent reaches -180)
4. Update static left and right pages at 325ms (halfway)
5. On `animationend`: remove leaf, update spread index, re-render

**Backward flip:** Same pattern, leaf over left page, `transform-origin: right center`,
`rotateY(0 → 180deg)`

**Page content rendering:**
Each page renders a mini HTML version (not react-pdf) using:
- `getStrings(layout.language)` for all labels
- Template colours from the selected template's palette
- Recipe photo pages: photo placeholder + title overlay
- Content pages: ingredient list + numbered steps
- TOC: live from `computePageMap(layout)` 
- Index: alphabetical from card order
- Foreword: italic text preview
- Cover: template-matched style
- Back: dark ChefsBook branded

**Quality badges in flipbook:**
Thumbnails in the strip show a small coloured dot for 🟡/🔴 quality images.

**Keyboard support:** ← → arrow keys navigate spreads.

**Thumbnail strip:** Row of small page thumbs below the spread. Active spread
highlighted. Click any thumb to jump (no animation for distant jumps, just snap).

---

### Priority 5 — Admin template management

New page: `/admin/cookbook-templates`

Add to admin sidebar.

**List view:**
- All templates from `cookbook_templates` table
- Each row: preview image, name, description, category, active toggle, sort order
- Filter tabs: All / Classic / Holiday / Kids / BBQ / Seasonal
- "Generate New Template" button (links to `/admin/cookbook-templates/generate`)

**Per-template actions:**
- Toggle active/inactive (immediate DB update, template disappears from user picker)
- Edit metadata (inline edit or small form: name, description, category, tags, sort_order, is_premium)
- Preview (generates sample PDF with test recipes using this template)
- Upload/replace preview image

**New admin API routes:**
- `GET /api/admin/cookbook-templates` — list all with DB metadata
- `PATCH /api/admin/cookbook-templates/[id]` — update metadata
- `POST /api/admin/cookbook-templates/[id]/preview` — generate preview PDF

**Template picker update:**
The user-facing template picker in Book Settings now fetches from
`GET /api/print-cookbook/templates` (active only, ordered by sort_order).
Templates grouped by category with a label for each group.

---

### Priority 6 — AI template generation (if time permits)

Page: `/admin/cookbook-templates/generate`

If this priority is not reached in this session, log it clearly in AGENDA.md.

**Flow:**
1. Upload 1-5 inspiration images → Supabase Storage: `cookbook-templates/inspiration/{session-id}/`
2. Fill preferences: name, category, accent colour, background mood, photo style, typography feel
3. Call Claude via `@chefsbook/ai` — **follow `ai-cost.md` MANDATORY**
   - Log to `ai_usage_log`
   - Use `claude-opus-4-6` (vision required)
   - Prompt: analyse images + preferences → produce `TemplateConfig` JSON
4. Generate preview PDF immediately
5. Admin tweaks in visual config panel → regenerate
6. Approve → save to `cookbook_templates` + template file
7. Note in UI: "A deploy is required to activate code-based templates"

**Architecture note:** Opus must read the existing template code first and decide
what "a TemplateConfig" means based on the actual implementation. The config
structure should emerge from the existing templates, not be imposed from outside.
Write an architecture comment explaining the decision.

---

## Testing

### After each priority

**Priority 1 (Language):**
- Select French in Book Settings
- Generate a PDF
- Verify "Ingrédients", "Étapes", "Table des matières" appear in the PDF

**Priority 2 (Quality):**
- Select a known small image (< 640px wide) — verify 🔴 badge appears
- Verify "Generate PDF" is blocked with the low-quality image selected
- Select a large image — verify 🟢 badge appears and generation is not blocked

**Priority 3 (Custom page upload):**
- Add a custom page to a recipe card
- Upload an image
- Verify quality badge appears on the uploaded image

**Priority 4 (Flipbook):**
- Open flipbook from "Preview Book ▶"
- Click Next → page turns from right to left ✓
- Click Back → page turns from left to right ✓
- Verify TOC shows correct page numbers
- Verify dark pages (if Studio template) render correctly
- Keyboard ← → works

**Priority 5 (Admin templates):**
- `/admin/cookbook-templates` loads and shows 6 templates
- Toggle a template inactive → disappears from user-facing picker (verify in another tab)
- Toggle back active → reappears

### Full regression smoke test before wrapup

Run every item from `testing.md` regression checklist.
All items require actual verification — not code review.

---

## Deploy

Follow `deployment.md`. Deploy web to RPi5.
Run: `curl -I https://chefsbk.app/dashboard/print-cookbook` — must return 200.

---

## Wrapup

Follow `wrapup.md` fully.

Required proof:
1. Regression smoke test — all items checked, no regressions
2. Language: PDF generated with French labels visible
3. Quality: screenshot showing 🔴/🟡/🟢 badges on image thumbnails
4. Flipbook: screenshot mid-page-turn (turning leaf visible)
5. Admin templates: `/admin/cookbook-templates` screenshot showing 6 templates
6. All items NOT completed logged in AGENDA.md with clear next steps

Session name: CANVAS-EDITOR-2
