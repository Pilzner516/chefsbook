You are starting session CANVAS-EDITOR-4. Before writing any code:

1. Read .claude/agents/wrapup.md
2. Read CLAUDE.md fully
3. Read DONE.md
4. Read .claude/agents/testing.md
5. Read .claude/agents/feature-registry.md
6. Read .claude/agents/deployment.md
7. Read .claude/agents/ui-guardian.md
8. Read .claude/agents/pdf-design.md
9. Read .claude/agents/image-system.md
10. Run all pre-flight checklists from every agent above
11. Run \d printed_cookbooks on RPi5 to verify schema
12. Only then begin writing code

Do not write a single line of code until all 12 steps are complete.

---

SESSION: CANVAS-EDITOR-4
Route: /dashboard/print-cookbook/[id]
Builds on: CANVAS-EDITOR-1, CANVAS-EDITOR-3 (previous session)

---

CONTEXT

The canvas editor is partially built. Recipe cards exist and show page rows as text
(p.1 Image, p.2 Content Part 1). Three things are missing or broken based on visual
review of the current state. Fix all three before deploying.

---

FIX 1 — Page rows must be visual thumbnails, not text rows (HIGHEST PRIORITY)

Current state: Each page shows as a plain text row ("p.1  📷 Image", "p.2  📄 Content Part 1").
This is wrong. Pages must render as small visual book-page thumbnails.

Each thumbnail must be:
- Size: ~80px wide × 110px tall (portrait book page ratio)
- Background: #FAF7F2 (cream)
- Border: 1px solid #E0D9D0
- Border-radius: 4px
- Box-shadow: 0 1px 4px rgba(0,0,0,0.10)
- Displayed in a horizontal scrolling strip, not a vertical list

Thumbnail content by page type:
- Image page: centered camera icon (SVG or lucide CameraIcon), muted color (#B0A89E)
  If a recipe photo exists, show it as a cover fill with object-fit: cover
- Content page: 4-5 faint horizontal lines (~60% width, #D8D0C8, 1px tall, spaced 8px apart)
  suggesting text content
- Custom page: show a small uploaded image preview if one exists, else a "+" icon

Below each thumbnail, show the page label in 9px muted sans text ("Image", "Content", "Custom").

Arrange thumbnails in a horizontal flex row with gap: 8px, inside the expanded recipe card body.
Replace the current vertical text row list entirely.

Each thumbnail must be clickable. On click, open a page editor modal (see FIX 2).

---

FIX 2 — Page editor modal must open and be functional

Current state: Clicking p.1 or p.2 does nothing.

When a thumbnail is clicked, open a modal with:
- Title: "Edit Page — [Image / Content / Custom]"
- For Image pages:
  - Show current image (if any) or upload zone (click or drag-and-drop)
  - Upload via existing /api/print-cookbooks/upload-custom route
  - Show image quality badge (🟢 Good / 🟡 Fair / 🔴 Poor) immediately after upload
  - Caption field (optional, max 120 chars)
- For Content pages:
  - Read-only notice: "Content is auto-generated from your recipe. Add a custom page to append extra text."
  - Close button
- For Custom pages:
  - Image upload zone (optional)
  - Text area (optional, max 500 chars)
  - Caption field (optional, max 120 chars)
  - Save button — persists to book_layout JSONB

Modal close: X button and click-outside.

---

FIX 3 — Image quality badges must appear on recipe card images

Current state: Quality badges (🟢🟡🔴) built in previous session but not visible on the
canvas recipe card images.

Find where quality checking logic lives (apps/web/lib/print-quality.ts from previous session).
Verify it is actually being called when recipe cards render.

Each recipe card hero image must show a small badge in the top-right corner:
- 🟢 if image resolution is excellent (≥300 DPI equivalent)
- 🟡 if acceptable (150–299 DPI)
- 🔴 if poor (<150 DPI) — also show tooltip "This image may appear blurry in print"

If the quality check is failing silently, add console.log output to diagnose, fix, then remove logs.
The pre-generate blocking for 🔴 images (built last session) must still work after this fix.

---

ACCEPTANCE CRITERIA

Before /wrapup verify all of these:

- [ ] Recipe page rows are rendered as visual thumbnails (cream, portrait ratio, not text rows)
- [ ] Image page thumbnail shows camera icon or recipe photo fill
- [ ] Content page thumbnail shows faint horizontal lines
- [ ] Clicking any thumbnail opens the page editor modal
- [ ] Image page editor has upload zone + quality badge + caption field
- [ ] Content page editor shows read-only message
- [ ] Custom page editor has image + text + caption + save
- [ ] Quality badges (🟢🟡🔴) visible on recipe card hero images in canvas
- [ ] 🔴 badge shows tooltip text
- [ ] Pre-generate blocking for 🔴 images still works
- [ ] TypeScript: cd apps/web && npx tsc --noEmit passes with no new errors
- [ ] Deployed to RPi5 and visually verified in browser
