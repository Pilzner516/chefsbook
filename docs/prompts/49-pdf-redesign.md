# ChefsBook — Session 49: PDF Export Redesign
# Source: PDF quality review 2026-04-10
# Target: apps/web (server-side PDF route)

---

## CONTEXT

The current PDF export at `/recipe/[id]/pdf` produces a poorly formatted document:
- UI elements (photo thumbnails, + button, photo count) appearing in output
- Large blank spaces from web layout bleeding into PDF
- No attribution/credit for original recipe submitter
- Wrong domain in footer (chefsbook.com instead of chefsbk.app)
- No consistent filename format

This session rebuilds the PDF route to produce a clean, beautiful,
print-ready document using `@react-pdf/renderer`.

Read .claude/agents/image-system.md before starting (images need proxy handling).

---

## FILENAME

The PDF download filename must always be:
```
ChefsBook - [Recipe Title].pdf
```

In the route response headers:
```ts
'Content-Disposition': `attachment; filename="ChefsBook - ${recipe.title}.pdf"`
```

Sanitize the title for filenames (remove characters invalid in filenames):
```ts
const safeTitle = recipe.title.replace(/[/\\?%*:|"<>]/g, '-');
`ChefsBook - ${safeTitle}.pdf`
```

---

## PDF LAYOUT — using @react-pdf/renderer

Design a clean, elegant single-column PDF layout:

### Page setup
```
Page size: A4
Margins: top 40px, bottom 40px, left 50px, right 50px
Font: use a clean serif for title, sans-serif for body
Background: white (#ffffff)
```

### Header (every page)
```
┌─────────────────────────────────────────────┐
│  [Chef's hat icon 24px]  ChefsBook          │
│                          chefsbk.app        │  ← small grey, right-aligned
└─────────────────────────────────────────────┘
  ─────────────────────────────────────────── ← thin red line (#ce2b37)
```

### Recipe hero section (page 1 only)
```
┌─────────────────────────────────────────────┐
│                                             │
│  [Recipe primary image — full width,        │
│   max height 220px, object-fit cover,       │
│   rounded corners 8px]                      │
│   (only shown if image available)           │
│                                             │
│  FOCACCIA                                   │  ← recipe title, 28px bold serif
│                                             │
│  Italian · Bread · 30 min · 4 servings      │  ← metadata row, 12px grey
│                                             │
│  ─────────────────────────────────────────  │  ← thin divider
│                                             │
│  [Recipe description if available, 13px]   │
│                                             │
└─────────────────────────────────────────────┘
```

### Attribution section (always shown if original_submitter exists)
```
┌─────────────────────────────────────────────┐
│  📖 Original recipe by @username            │  ← 11px, grey, italic
│  🔗 Shared by @username                     │  ← only if shared_by exists
└─────────────────────────────────────────────┘
```

### Ingredients section
```
INGREDIENTS                                    ← 14px bold, red (#ce2b37), uppercase
────────────────────────────────────────────── ← thin red line

• 1024g bread flour                            ← 13px, left-aligned
• 512g water                                   ← bullet point, consistent spacing
• 20g salt
...
```

Rules for ingredients:
- Each ingredient on its own line with bullet point
- Format: `[quantity] [unit] [name]` — never split across lines
- Group by section header if ingredients have sections (e.g. "For the dough:")
- Avoid page breaks mid-ingredient-list when possible

### Steps section
```
STEPS                                          ← 14px bold, red, uppercase
──────────────────────────────────────────────

1.  Mix flour and bread flour                  ← step number bold, instruction normal
    [timer indicator if step has time: ⏱ 72h]

2.  Let rise for 12 hours to 3 days

3.  Second rise for 3-4 hours
...
```

Rules for steps:
- Step number and instruction on same line
- Timer shown inline if present
- Never break a single step across pages
- If a step is long, keep it together with `break-inside: avoid`

### Notes section (if present)
```
NOTES                                          ← 14px bold, red, uppercase
──────────────────────────────────────────────

[Notes text, 13px, grey, italic]
```

### Footer (every page)
```
  ─────────────────────────────────────────── ← thin grey line
│  Saved with ChefsBook · chefsbk.app         │  ← 10px grey, left
│  Original recipe by @username               │  ← 10px grey, right (if attributed)
│                             Page 1 of 3     │  ← page number, right-aligned
```

---

## WHAT MUST NOT APPEAR IN THE PDF

Explicitly exclude these UI elements — they must never render in the PDF:
- "Your Photos N/10" section header
- Photo thumbnail strip
- The `+` add photo button
- Any navigation buttons (Dashboard, Share, Print, Favourite, etc.)
- The share action bar
- The cooking log section
- Comment section
- Like button / count
- Edit controls
- Plan gate prompts
- Any loading states or skeleton placeholders

Build the PDF from raw data (recipe object from DB), NOT from rendering the web page.
The PDF route fetches the recipe data directly and constructs the layout from scratch
using `@react-pdf/renderer` — it never renders the web UI.

---

## IMAGE HANDLING IN PDF

Recipe images are in Supabase storage and require the apikey header. In the server-side
PDF route, fetch the image as a buffer before passing to @react-pdf/renderer:

```ts
// In the PDF route (server-side, has access to service role key):
const imageResponse = await fetch(primaryPhotoUrl, {
  headers: { apikey: process.env.SUPABASE_ANON_KEY }
});
const imageBuffer = await imageResponse.arrayBuffer();
const imageBase64 = Buffer.from(imageBuffer).toString('base64');
const imageSrc = `data:image/jpeg;base64,${imageBase64}`;

// Pass imageSrc to @react-pdf/renderer <Image> component
```

If image fetch fails, render the PDF without an image (do not crash).

---

## ATTRIBUTION IN PDF

Always include attribution if `original_submitter_username` is set on the recipe:

- In the hero section below the title: `Original recipe by @username`
- In the footer on every page: `Original recipe by @username`
- If `shared_by_username` also exists: `Shared by @username` on a second line

---

## PAGE BREAK RULES

Use @react-pdf/renderer's `break` props to prevent bad breaks:
```tsx
<View break={false}>  // keeps section header + first item together
<View style={{ breakInside: 'avoid' }}>  // keeps individual steps together
```

Force a page break before Steps if Ingredients section would be orphaned:
- If fewer than 3 ingredients fit on page 1, start Ingredients on page 2

---

## DEPLOYMENT

After implementing, deploy to RPi5:
```bash
ssh rasp@rpi5-eth
cd /mnt/chefsbook/repo
git pull
cd apps/web
npm run build 2>&1 | tail -20
pm2 restart chefsbook-web
```

Test by downloading a PDF for a recipe with:
- An image
- Both ingredients and steps
- Attribution (@original_submitter)
- At least 2 pages worth of content

---

## COMPLETION CHECKLIST

- [ ] Filename always "ChefsBook - [Recipe Title].pdf"
- [ ] PDF built from raw data, never from web page rendering
- [ ] Header with chef's hat logo + ChefsBook + chefsbk.app on every page
- [ ] Recipe image shown if available (fetched server-side with apikey header)
- [ ] No UI elements in PDF (no photo strip, no buttons, no navigation)
- [ ] Ingredients section: clean bullet list, no page breaks mid-list
- [ ] Steps section: numbered, timers shown inline, no breaks mid-step
- [ ] Notes section: shown if present
- [ ] Attribution: @original_submitter in hero + footer of every page
- [ ] @shared_by shown if present
- [ ] Footer: chefsbk.app (not chefsbook.com), page numbers
- [ ] Page breaks: no orphaned headers, no split steps
- [ ] PDF tested with a multi-page recipe — clean layout throughout
- [ ] Deployed to RPi5 and verified by downloading a real PDF
- [ ] Run /wrapup to update DONE.md and CLAUDE.md
