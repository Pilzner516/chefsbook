# Prompt: Cookbook PDF Redesign — Award-Winning Template

## LAUNCH PROMPT (paste this into Claude Code to start the session)

```
Read and execute docs/prompts/cookbook-pdf-redesign.md fully and autonomously, from pre-flight through deployment and /wrapup. Do not stop for questions unless you hit a genuine blocker.
```

---

## ORDER OF OPERATIONS

Run these two prompts in sequence — do NOT combine into one session:

**Session 1 — Agent file only:**
```
Copy the file docs/prompts/pdf-design-agent.md to .claude/agents/pdf-design.md and commit it with message "feat: add pdf-design agent". Do not build anything else.
```

**Session 2 — Redesign (this file):**
```
Read and execute docs/prompts/cookbook-pdf-redesign.md fully and autonomously, from pre-flight through deployment and /wrapup. Do not stop for questions unless you hit a genuine blocker.
```

---

## TYPE: UI POLISH — NO DATABASE CHANGES

---

## Agent files to read — ALL of these, in order, before writing a single line of code

- `.claude/agents/wrapup.md`
- `.claude/agents/testing.md`
- `.claude/agents/feature-registry.md`
- `.claude/agents/ui-guardian.md`
- `.claude/agents/pdf-design.md`  ← THE MOST IMPORTANT ONE FOR THIS SESSION

`pdf-design.md` is the authoritative design spec. Every decision in this session
must be grounded in that file. Do not invent design choices not covered by it.

---

## Step 1 — Save the agent file first

Copy the file at `docs/prompts/pdf-design-agent.md` to `.claude/agents/pdf-design.md`.
This is a new permanent agent file. Commit it before doing anything else.

---

## Step 2 — Find and read the current PDF template

Locate the Puppeteer HTML template for the cookbook interior. It will be in one of:
- `apps/web/components/CookbookPdf.tsx`
- `apps/web/lib/cookbook-pdf.ts`
- `apps/web/app/api/cookbooks/[id]/generate/route.ts`

Read it fully before making any changes. Understand the current structure.

Also find the cover template (`CookbookCoverPdf` or similar) and read it.

---

## Step 3 — Fix every known bug first (before redesigning)

These bugs are documented in `pdf-design.md` under "Known Bugs to Always Fix":

1. **Timer character "ñ"** — find where timers are rendered and replace the `ñ`
   character with `⏱ ` (the emoji followed by a space). This is a data pipeline
   issue — find the source and fix it there, not just in the template.

2. **Bullet inconsistency** — normalise all ingredient bullets to `•`

3. **White background** — change `background: white` to `background: #faf7f0`
   on the page/body element in the Puppeteer HTML

4. **Excessive `<br>` whitespace** — remove all `<br>` spacers, replace with
   CSS `margin-bottom` on the appropriate elements

Fix and verify each bug before proceeding to the redesign.

---

## Step 4 — Redesign the interior template

Rebuild the Puppeteer HTML template to match `pdf-design.md` exactly.

Work through each page type in order:

### 4a — Title page
- Warm cream background (#faf7f0)
- ChefsBook hat icon (find it in `apps/web/public/` or embed as SVG)
- Book title in Playfair Display Bold 52pt
- Subtitle in Playfair Display Italic 22pt (if provided)
- Thin red divider line
- "by [Author Name]" in Inter Light 14pt
- "Created with Chefsbook · chefsbk.app" at bottom in Inter Light 9pt, muted
- For Classic cover style: inset border frame in --cb-red

### 4b — Table of Contents
- "Contents" heading: Playfair Display Bold 38pt, red
- Red divider line below heading
- Each entry: recipe name left, dotted leader, page number right
- Background: #f0ece0

### 4c — Recipe pages
- Full-width photo (280pt max height, object-fit: cover)
  - If no photo: cream placeholder block with cuisine emoji centred
- Recipe title: Playfair Display Bold 30pt
- Meta line (cuisine · course · time · servings): Inter Regular 10pt, muted
- Description: Inter Light 11pt
- Section labels (INGREDIENTS/STEPS/NOTES): Inter SemiBold 9pt ALL CAPS, red,
  letter-spacing: 2px, with 0.5pt red bottom border
- Ingredients: Inter Regular 11pt, bullet `•`, group headers in SemiBold
- Step numbers: Playfair Display Bold 14pt, red, floated left
- Step text: Inter Regular 11pt
- Timer: new line, indented, Inter Italic 10pt, green (#009246), prefix with ⏱
- Notes: Inter Italic 10.5pt
- Running footer: three-column (Chefsbook | Recipe Title | Page N)

### 4d — Back page
- Chefsbook hat icon centred, large
- "Chefsbook" wordmark in Playfair Display Bold 32pt
- Tagline: "Your recipes, beautifully collected." Inter Light 14pt, muted
- "chefsbk.app" Inter Regular 12pt, red

---

## Step 5 — Generate a test PDF

Use the existing test recipe data (the same 12 recipes from the sample PDF provided)
to generate a new test PDF using the redesigned template.

Command to trigger generation (find the actual route from the codebase):
```bash
curl -X POST http://localhost:3000/api/cookbooks/[test-cookbook-id]/generate \
  -H "Authorization: Bearer [admin-token]"
```

Or trigger it through the UI by going to `/dashboard/print` and generating a cookbook.

Download and open the resulting PDF. Verify every item on the Output Quality Checklist
in `pdf-design.md`.

---

## Step 6 — Cover template

Review the cover template separately. The cover (for Lulu) is a one-piece PDF:
front cover + spine + back cover.

For the Classic cover style:
- Front: cream background, inset red border frame, title in Playfair Display Bold
- Spine: red background (#ce2b37), title rotated 90°, "Chefsbook" at bottom
- Back: cream, "Created with Chefsbook" + chefsbk.app, ISBN barcode placeholder

Ensure the cover PDF uses the same fonts (Playfair Display + Inter) as the interior.

---

## Deploy

Follow `deployment.md`. Deploy web to RPi5 via `/mnt/chefsbook/deploy-staging.sh`.

---

## Wrapup

Follow `wrapup.md` fully.

Required proof for wrapup:
1. Confirm `.claude/agents/pdf-design.md` is committed
2. Generate a test PDF and confirm it opens cleanly
3. List every bug fixed with before/after description
4. Confirm all items on the Output Quality Checklist in `pdf-design.md` are checked
5. Note any checklist items that could not be verified (with reason)

The generated test PDF filename must be recorded in DONE.md.
