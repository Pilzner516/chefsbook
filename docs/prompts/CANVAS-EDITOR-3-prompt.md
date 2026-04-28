# CANVAS-EDITOR-3 — Launch Prompt

## SESSION START — READ IN THIS ORDER BEFORE WRITING ANY CODE

1. Read `.claude/agents/wrapup.md` — understand what will be required at session end
2. Read `CLAUDE.md` fully
3. Read `DONE.md` — understand what was last built (canvas editor built in CANVAS-EDITOR-1)
4. Read `.claude/agents/testing.md` — MANDATORY
5. Read `.claude/agents/feature-registry.md` — MANDATORY (check canvas editor + PDF pipeline status)
6. Read `.claude/agents/deployment.md` — MANDATORY (this session touches apps/web and deploys to RPi5)
7. Read `.claude/agents/ui-guardian.md` — MANDATORY (this session touches screens and components)
8. Read `.claude/agents/pdf-design.md` — MANDATORY (this session touches PDF generation and validation)
9. Read `.claude/agents/image-system.md` — this session adds image upload to the cover card
10. Run ALL pre-flight checklists from every agent loaded above
11. Run `\d printed_cookbooks` and `\d cookbook_templates` on RPi5 to verify current schema
12. Only then begin writing code

Do not skip any step. Do not write a single line of code before completing steps 1–11.

---

## Session Identity

**Session name:** `CANVAS-EDITOR-3`  
**Route:** `/dashboard/print-cookbook/[id]`  
**Builds on:** CANVAS-EDITOR-1 (canvas editor built), COOKBOOK-BUILDER-3 (PDF templates, cover upload API)

---

## Context

The visual canvas editor at `/dashboard/print-cookbook/[id]` was built in CANVAS-EDITOR-1. It renders a vertical card stack: Book Settings → Cover → one card per recipe → Back Page card (WRONG — must be removed). The user configures the book here and clicks Generate to produce a PDF via the existing generate route.

Six issues need fixing this session. Work them in priority order.

---

## Issue 1 — 🔴 Generate validation fires incorrectly (BUG)

**Symptom:** Clicking Generate shows "minimum 5 recipes required" even when 6 recipes are selected.

**Where to look:**
- Find the validation function that checks recipe count before generation
- Check whether it reads from `recipes.length` vs `selectedRecipes.length` vs a separate count field — one is wrong
- Check for stale closure or async state that hasn't settled before the count is evaluated
- `grep -r "minimum 5\|min.*recipe\|recipe.*min" apps/web` to find the exact location

**Fix:** Validation must read from the same source of truth as the canvas UI. Add a `console.log` of the value being checked so it is visible in the fix. Error must not appear when ≥ 5 recipes are present on the canvas.

---

## Issue 2 — 🔴 Recipe cards not editable (missing page thumbnails + Add Page)

**Symptom:** Each recipe card shows no page previews and has no way to add or edit pages.

**What each recipe card must show:**
1. Header row: recipe title + drag handle + collapse toggle (already exists — do not break)
2. A horizontal strip of **page thumbnails** — small (~80×110px) styled divs that look like miniature book pages. Each recipe starts with two default pages: **Photo Page** and **Content Page**
3. Photo Page thumbnail: cream background + centered camera icon (or actual image if uploaded)
4. Content Page thumbnail: cream background + faint horizontal rules suggesting text
5. Each thumbnail is clickable → opens a page editor modal (stub: "Page editor — coming soon" is acceptable for this session)
6. **`+ Add Page`** button at the end of the strip, with a type picker: Text Page / Photo Page / Photo + Text
7. Pages within a recipe are reorderable (arrow buttons left/right or drag)

**Thumbnail styling:** `border-radius: 4px`, `border: 1px solid #e0d9d0`, `box-shadow: 0 1px 4px rgba(0,0,0,0.10)`, cream/off-white background (`#FAF7F2`). Not grey boxes.

**Fix:** Implement the full recipe card interior. The page editor modal stub is acceptable. Thumbnail strip and `+ Add Page` button must be fully functional.

---

## Issue 3 — 🟡 Page size selector missing from Book Settings

**Symptom:** No way to choose page dimensions in Book Settings.

**Options to add:**

| Label | Dimensions | Value key |
|---|---|---|
| 8.5 × 11 in (Letter) | default | `letter` |
| 6 × 9 in (Trade) | | `trade` |
| 7 × 10 in (Large Trade) | | `large-trade` |
| 5.5 × 8.5 in (Digest) | | `digest` |
| 8 × 8 in (Square) | | `square` |

**Fix:** Add `pageSize` to the `BookLayout` type in `apps/web/lib/book-layout.ts`. Add a styled radio group or segmented control to the Book Settings card. Persist to `book_layout` JSONB. Pass selected `pageSize` into the generate API call.

---

## Issue 4 — 🟡 Cover card has no image upload

**Symptom:** The Cover card shows a "No cover image" placeholder with zero interactivity.

**Note:** The upload API route already exists at `/api/print-cookbooks/upload-cover` (built in COOKBOOK-BUILDER-2). Wire it up — do not rebuild it.

**Fix:**
1. Make the placeholder area a click target that triggers `<input type="file" accept="image/*">`
2. Support drag-and-drop onto the card
3. On selection: POST to `/api/print-cookbooks/upload-cover`, show a preview of the uploaded image filling the cover preview area
4. Overlay a small "Change photo" button (bottom-right, semi-transparent) on the preview
5. Store the resulting URL in the cookbook's `coverImageUrl` / `cover_image_url` field

---

## Issue 5 — 🟡 Remove Back Page card from canvas

**Symptom:** A "Back Page" card appears at the bottom of the canvas. The back cover is auto-generated by the PDF template — this card must not exist.

**Fix:** `grep -r "BackPage\|back_page\|backPage\|back.*card" apps/web/app/dashboard/print-cookbook` to locate it. Remove the card from the canvas state array, any initial state, and the render list entirely. Zero DOM presence, zero state entry.

---

## Issue 6 — 🟠 UX polish pass

**Design direction:** Editorial / refined cookbook aesthetic. Premium, not generic.

**Specific changes required:**

1. **Canvas background:** `background: #F2EDE8` (warm off-white). Add subtle noise or paper texture via CSS `background-image`.

2. **Cards:**
   - `border-radius: 12px`
   - `box-shadow: 0 2px 8px rgba(0,0,0,0.08), 0 0 0 1px rgba(0,0,0,0.04)`
   - Card headers: `background: #EDE8E3`, visually separated from card body
   - Gap between cards: `24px`
   - Internal card padding: `20–24px`

3. **Typography:** Apply `Playfair Display` (Google Font) for card titles and section headers. Body/label text stays sans-serif.

4. **Drag handles:** Three horizontal lines (≡), muted color, grab cursor, visible on hover only.

5. **Generate button:** Full-width or wide, `background: #C0392B` (deep crimson), white text, book icon, prominent. This is the primary CTA.

6. **Empty states:** Any "No cover image" or similar empty state must have an icon, one line of helper copy, and a CTA — not just placeholder text.

---

## Acceptance Criteria

Before `/wrapup`, verify every item:

- [ ] Generate with ≥ 5 recipes → no false validation error
- [ ] Generate with < 5 recipes → error fires correctly
- [ ] Each recipe card shows Photo Page + Content Page thumbnails in a horizontal strip
- [ ] Clicking a thumbnail opens a modal (stub accepted)
- [ ] `+ Add Page` button present; type picker appears on click
- [ ] Book Settings has a working page size selector, value persisted to `book_layout`
- [ ] Cover card accepts click-to-upload and drag-and-drop; shows image preview after upload
- [ ] Back Page card is completely absent from canvas DOM and state
- [ ] Canvas background is warm, cards have depth and rounded corners
- [ ] Generate button is prominent crimson CTA
- [ ] TypeScript: `cd apps/web && npx tsc --noEmit` passes (no new errors)
- [ ] Deployed to RPi5 staging; manually verify canvas loads and Generate runs

---

## Screenshot Evidence

Screenshots for issues 3, 5, and 6 will be pasted into this chat. Review them before starting work on those issues.

---

## Commit Convention

- `fix(canvas):` for bug fixes (issues 1, 5)
- `feat(canvas):` for new features (issues 2, 3, 4)
- `style(canvas):` for polish (issue 6)
