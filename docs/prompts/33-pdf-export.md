# ChefsBook — Session 33: PDF Export (Pro Plan)
# Depends on: Sessions 27 (plan tiers), 32 (share links)
# Target: apps/web + apps/mobile

---

## CROSS-PLATFORM REQUIREMENT — READ FIRST

Every feature in this session MUST be implemented on BOTH platforms:
- `apps/mobile` — React Native / Expo
- `apps/web` — Next.js

Both must be fully working before /wrapup. Do not leave either platform with a TODO.

---

## CONTEXT

Pro plan users can export/share any recipe as a formatted PDF.
Generated server-side at chefsbk.app/recipe/[id]/pdf.
Read all applicable agents before starting.

---

## SERVER-SIDE PDF GENERATION

### Route: `GET /recipe/[id]/pdf`

In `apps/web/app/recipe/[id]/pdf/route.ts`:

1. Verify the requesting user is authenticated and has Pro plan
   (check via Authorization header or session cookie)
2. Fetch the full recipe from Supabase
3. Generate PDF using `@react-pdf/renderer` or `puppeteer`

**Recommended: `@react-pdf/renderer`** — lighter than Puppeteer, no browser needed,
runs in Next.js API routes cleanly.

```bash
cd apps/web && npm install @react-pdf/renderer
```

### PDF layout

```
┌─────────────────────────────────┐
│  [ChefsBook Logo]  chefsbk.app  │
│─────────────────────────────────│
│                                 │
│  [Recipe Image if available]    │
│                                 │
│  Recipe Title                   │
│  Cuisine · Course · Cook time   │
│  Servings: 4                    │
│                                 │
│  Description                    │
│                                 │
│  INGREDIENTS                    │
│  • 2 cups flour                 │
│  • 1 tsp salt                   │
│  ...                            │
│                                 │
│  STEPS                          │
│  1. Preheat oven to 375°F       │
│  2. Mix dry ingredients...      │
│  ...                            │
│                                 │
│  NOTES                          │
│  Any tips or variations...      │
│                                 │
│─────────────────────────────────│
│  Shared from chefsbk.app        │
│  Original recipe by @username   │
└─────────────────────────────────┘
```

### Response headers
```ts
return new Response(pdfBuffer, {
  headers: {
    'Content-Type': 'application/pdf',
    'Content-Disposition': `attachment; filename="${recipe.title}.pdf"`,
  },
});
```

---

## MOBILE PDF SHARE

When user taps "Share as PDF" in the share action sheet:

1. Show loading indicator: "Generating PDF..."
2. Call `GET https://api.chefsbk.app/recipe/[id]/pdf` with auth token
3. Download the PDF to a temp local file via `expo-file-system`
4. Open Android share sheet with the PDF file via `expo-sharing`

```ts
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';

const pdfUri = FileSystem.cacheDirectory + `${recipe.title}.pdf`;
await FileSystem.downloadAsync(
  `https://api.chefsbk.app/recipe/${recipe.id}/pdf`,
  pdfUri,
  { headers: { Authorization: `Bearer ${session.access_token}` } }
);
await Sharing.shareAsync(pdfUri, {
  mimeType: 'application/pdf',
  dialogTitle: `Share ${recipe.title}`,
});
```

---

## PLAN GATE

If non-Pro user taps "Share as PDF":
```
┌─────────────────────────────────────────┐
│  🔒 PDF Export — Pro Plan               │
│                                         │
│  Export beautifully formatted PDFs      │
│  of your recipes with the Pro plan.     │
│                                         │
│  [See Plans]        [Maybe Later]       │
└─────────────────────────────────────────┘
```

---

## WEB PDF DOWNLOAD

On the web recipe detail page (for Pro users):
Add a "Download PDF" button in the recipe actions area.
Clicking opens `/recipe/[id]/pdf` in a new tab — browser handles the download.

---

## COMPLETION CHECKLIST

- [ ] @react-pdf/renderer installed in apps/web
- [ ] /recipe/[id]/pdf route created and generates formatted PDF
- [ ] PDF includes logo, image (if available), all recipe fields, attribution
- [ ] Route protected — Pro plan required, returns 403 for others
- [ ] Mobile: PDF generated and shared via Android share sheet
- [ ] Loading indicator shown during PDF generation
- [ ] Non-Pro users see upgrade prompt
- [ ] Web: "Download PDF" button for Pro users on recipe detail
- [ ] Run /wrapup to update DONE.md and CLAUDE.md
