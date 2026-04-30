# Agent: publishing.md
# Scope: Any session touching Lulu orders, cookbook PDF generation, cover builds,
#        print-cookbook API routes, canvas editor, or image upscaling for print.
#        Read this agent alongside pdf-design.md — they cover different layers.
#        pdf-design.md = rendering (templates, fonts, layout)
#        publishing.md = production pipeline (Lulu API, Stripe, storage, image pipeline)

---

## MANDATORY: Read before this agent

- `.claude/agents/pdf-design.md` — template rendering rules (always paired with this agent)
- `.claude/agents/testing.md`
- `.claude/agents/deployment.md`

---

## Pre-flight checklist — run EVERY session before writing any code

- [ ] Read DONE.md — every session that has touched print is: LULU-PRINT,
      PDF-REACT-PDF, PDF-POLISH, PDF-REDESIGN, PDF-FIXES, PRINT-AUTH-FIX,
      COOKBOOK-BUILDER, COOKBOOK-BUILDER-2, COOKBOOK-BUILDER-3, CANVAS-EDITOR-1,
      CANVAS-EDITOR-4, PRINT-QUALITY-1 through PRINT-QUALITY-5, BOOK-PREVIEW-1.
      Know what changed in each before touching any shared file.
- [ ] Confirm LULU_SANDBOX value on RPi5 before any order-related work.
      `LULU_SANDBOX=true` = sandbox. `LULU_SANDBOX=false` = real money, real prints.
      Never deploy order flow changes without confirming which mode is active.
- [ ] Confirm go-live checklist status (bottom of this file) before any session
      that touches the Lulu submit or order routes.
- [ ] Run `npx tsc --noEmit` in `apps/web` and record the baseline error count
      before writing a single line. Do not deliver a session with more errors than you started with.
- [ ] For any file in the generate route or template files: read the actual code first.
      Do not assume the current state matches any previous session's description.

---

## File map — every file this agent owns

### API routes
```
apps/web/app/api/print-cookbooks/route.ts                    — create / list cookbooks
apps/web/app/api/print-cookbooks/[id]/route.ts               — GET / PATCH / DELETE
apps/web/app/api/print-cookbooks/[id]/generate/route.ts      — PDF generation (interior + cover)
apps/web/app/api/print-cookbooks/[id]/price/route.ts         — Lulu cost estimate
apps/web/app/api/print-cookbooks/[id]/order/route.ts         — Stripe payment intent
apps/web/app/api/print-cookbooks/[id]/submit/route.ts        — submit to Lulu after payment
apps/web/app/api/print-cookbooks/upload-cover/route.ts       — cover image upload proxy
apps/web/app/api/print-cookbooks/[id]/cover-image/route.ts   — cover image management
apps/web/app/api/print-orders/route.ts                       — list user orders
apps/web/app/api/print-orders/[id]/route.ts                  — single order detail
apps/web/app/api/webhooks/lulu/route.ts                      — Lulu status webhooks
```

### UI pages
```
apps/web/app/dashboard/print-cookbook/page.tsx               — cookbook list page
apps/web/app/dashboard/print-cookbook/[id]/page.tsx          — canvas editor
apps/web/app/dashboard/orders/page.tsx                       — order tracking
```

### PDF templates (owned jointly with pdf-design.md)
```
apps/web/lib/pdf-templates/types.ts                          — shared types
apps/web/lib/pdf-templates/book-strings.ts                   — localized PDF strings
apps/web/lib/pdf-templates/trattoria.tsx                     — Classic (red #CE2B37)
apps/web/lib/pdf-templates/studio.tsx                        — Modern (dark #1A1A1A)
apps/web/lib/pdf-templates/garden.tsx                        — Minimal (green #009246)
apps/web/lib/pdf-templates/heritage.tsx                      — Farmhouse (sage)
apps/web/lib/pdf-templates/nordic.tsx                        — Scandinavian (blue)
apps/web/lib/pdf-templates/bbq.tsx                           — Pitmaster (amber #D97706)
```

### Supporting files
```
apps/web/lib/book-layout.ts                                  — BookLayout types + helpers
apps/web/components/print/FlipbookPreview.tsx                — scaled PDF preview
packages/db/src/subscriptions.ts                             — canPrintCookbook plan gate
```

### Database tables
```
printed_cookbooks          — cookbook drafts (migration 059 + book_layout col migration 063)
printed_cookbook_orders    — orders with tracking (migration 059)
cookbook_templates         — seeded template records (migration 064)
cookbook-pdfs              — Supabase Storage bucket for generated PDFs
```

---

## Known failure patterns — do not repeat these

Every item below was introduced and fixed at least once. Read all of them.

### Authentication & authorization

**PATTERN 1 — anon client cannot validate JWTs**
All print API routes MUST use `supabaseAdmin.auth.getUser(token)` to validate the
Authorization header. The anon client cannot verify JWTs and returns Unauthorized.
This broke all 8 print routes in session PRINT-AUTH-FIX. Never use `supabase.auth.getUser()`
(anon) in print routes — always `supabaseAdmin.auth.getUser()`.

**PATTERN 2 — anon client blocked by RLS in generate route**
The generate route MUST use `supabaseAdmin` directly to fetch recipes. Using `getRecipe()`
or any anon-client query in an API route has no auth context — RLS blocks the read and
returns "Could not fetch minimum 5 recipes" even when the user has 6+ recipes on the canvas.
Fixed in session PRINT-QUALITY-1. Rule: all data fetches in server-side generate route
use `supabaseAdmin`, not the anon client.

---

### Image handling

**PATTERN 3 — Replicate cannot reach Tailscale network**
Before sending any image URL to Replicate for upscaling, convert Tailscale/internal
storage URLs (100.110.47.62) to public URLs (api.chefsbk.app). Replicate's servers
cannot reach the private Tailscale network. This silently fails upscaling for all images.
Fixed in session PRINT-QUALITY-1.

**PATTERN 4 — Replicate cannot provide apikey header for Supabase storage**
Direct Supabase storage URLs at api.chefsbk.app require the `apikey` header. Replicate
cannot provide this header, so it gets a 401 when fetching images to upscale.
Fix: generate signed URLs for images before passing them to Replicate.
Fixed in session PRINT-QUALITY-5. Never pass raw storage URLs to Replicate.

**PATTERN 5 — Auth-required image URLs break react-pdf**
react-pdf cannot provide auth headers when fetching images from URLs. Any image that
requires authentication (cover image, recipe images from storage) MUST be converted
to base64 before being passed to the PDF template. Use `fetchImageAsBase64()` for
preview and `fetchImageWithUpscaling()` for print. Never pass a raw Supabase storage
URL directly to an `<Image>` component in a template. Fixed in session COOKBOOK-BUILDER-3.

**PATTERN 6 — Preview and print image paths must be explicitly separated**
The generate route has two paths: preview (fast, no upscaling) and print (upscaling enabled).
These MUST be explicitly separated with comments and must never be merged.
- Preview: `fetchImageAsBase64()` — no Replicate calls, no upscaling
- Print: `fetchImageWithUpscaling()` — upscales via Replicate Real-ESRGAN 4x

Mixing these paths causes upscaling charges on previews or missing upscaling on print.
Fixed in session PRINT-QUALITY-3. The comments `// Preview path — no upscaling` and
`// Print path — upscaling enabled` must remain in the code permanently.

**PATTERN 7 — Cover image upload must use server-side proxy route**
Direct browser-to-storage image uploads are blocked by CORS. Always use
`/api/print-cookbooks/upload-cover` (which uses supabaseAdmin) for cover image uploads.
Never attempt a direct fetch from browser to Supabase storage for uploads.
Fixed in session COOKBOOK-BUILDER-2.

**PATTERN 8 — Cover image storage bucket MIME type**
The cookbook-pdfs bucket originally only accepted PDF MIME types. When uploading cover
images, the bucket must accept `image/jpeg`. All uploaded images are converted to JPEG
via sharp before storage — never store PNG in the cover bucket.
Fixed in session COOKBOOK-BUILDER-3.

---

### PDF rendering

**PATTERN 9 — FlipbookPreview must be a dynamic import with ssr: false**
react-pdf uses browser APIs (DOMMatrix, Canvas) that do not exist in the Next.js server
environment. FlipbookPreview MUST be imported with:
```typescript
const FlipbookPreview = dynamic(() => import('@/components/print/FlipbookPreview'), { ssr: false });
```
If SSR is not disabled, the preview page crashes on load. Fixed in session PRINT-QUALITY-2.
Never remove the `ssr: false` flag.

**PATTERN 10 — Emoji characters render as ñ or ã in react-pdf**
react-pdf cannot render emoji characters (⏱, 🔥, etc.) — the fonts don't support them.
They render as ñ, ã, or other corrupted characters depending on font fallback.
Rules:
- Never use emoji in step instructions, ingredient lists, or any PDF text content
- Timer display: use the text string "(X min)" inline, not an emoji character
- Step badges: use View with borderRadius + Text for circle badges (see BBQ template StepBadge component)
- Use `fixTimerCharacter()` to sanitize any recipe data before rendering
Introduced and fixed across sessions COOKBOOK-BUILDER, PDF-FIXES, PRINT-QUALITY-1, and
PDF-STEP-BADGE-FIX. This pattern has recurred 5 times — do not introduce emoji in PDF content.
Session PDF-STEP-BADGE-FIX: replaced emoji keycap digits (1️⃣) with View+Text circle badge.

**PATTERN 11 — Inter font has no italic variants registered**
Inter fonts are registered with weights 300, 400, 500, 600. No italic variants are
registered. Never use `fontStyle: 'italic'` with Inter in any template — react-pdf
throws "Could not resolve font" and the PDF fails to generate. For emphasis, use
`fontWeight: 300` (light) instead. Fixed in session PDF-REDESIGN.

**PATTERN 12 — CustomPage must render AFTER RecipeContentPage**
Page order within a recipe section is: PhotoPage → AdditionalImagePage → RecipeContentPage
→ CustomPage. CustomPage was inserted before RecipeContentPage in session PRINT-QUALITY-3
and broke the reading order in 5 of 6 templates. BBQ already had the correct order.
Always verify page component order in templates when adding new page types.
Fixed in session PRINT-QUALITY-4.

**PATTERN 13 — Fixed-height step containers break on non-letter page sizes** [RESOLVED]
Step row `<View>` elements must never have a `height`, `minHeight`, or `maxHeight`.
On 8×8 Square pages, the narrower text column causes steps to wrap to more lines than
on letter-size pages, overflowing fixed containers and creating text overlap.
Step rows must be auto-height (sized by content only) with `wrap={false}` to prevent
mid-step page breaks. Verified resolved as of session PDF-STEP-BADGE-FIX — all 6 templates
have auto-height step rows with `wrap={false}`, no fixed heights.

**PATTERN 14 — Page size must be a prop, never hardcoded** [RESOLVED]
Templates must receive page dimensions via a `pageSize` prop from FlipbookPreview.
Never hardcode `size="LETTER"` or any fixed size string in a `<Page>` component.
FlipbookPreview must pass the correct dimensions for the selected size:
```typescript
const PAGE_SIZES = {
  'letter':      { width: 612, height: 792 },
  'trade':       { width: 432, height: 648 },
  'large-trade': { width: 504, height: 720 },
  'digest':      { width: 396, height: 612 },
  'square':      { width: 576, height: 576 },
};
```
Fixed in session CANVAS-FIXES-1 — all 6 templates use `getPageSize(pageSize)` prop.

**PATTERN 15 — TOC leaders must use flexbox, not text-based dots**
Text-based dot leaders (.......) wrap to multiple lines for long recipe titles, breaking
the TOC layout. TOC entries must use a flex row with:
- `tocRecipe` (flexShrink: 0) — recipe name, won't compress
- `tocLeader` (flex: 1, borderBottom dotted) — fills remaining space
- `tocPageNumber` (flexShrink: 0) — page number, won't compress
Fixed in session PDF-FIXES. Never revert to text-based dots.

---

### Lulu API integration

**PATTERN 16 — Stripe payment intent BEFORE Lulu job submission, always**
The order of operations in `/api/print-cookbooks/[id]/submit` is immutable:
1. Verify Stripe payment intent is `succeeded`
2. Only then call Lulu API to create print job
Never reverse this order. A user who gets charged but has no Lulu print job has no
recourse. A Lulu job created before payment confirmation wastes production capacity.

**PATTERN 17 — Lulu fetches PDFs by public URL**
Lulu's print servers fetch interior.pdf and cover.pdf directly using the URLs provided
in the print job API call. These URLs must be publicly accessible without authentication.
If the `cookbook-pdfs` bucket is private or URLs require auth headers, every print job
silently fails at Lulu's end. Verify bucket public access before any order testing.

**PATTERN 18 — Lulu webhook events arrive out of order**
Lulu webhooks for `IN_PRODUCTION`, `SHIPPED`, `DELIVERED`, and `CANCELLED` can arrive
out of sequence, especially in sandbox. The webhook handler in `/api/webhooks/lulu`
must be idempotent — processing the same event twice must produce the same result.
Status updates must never downgrade a status (e.g. do not set IN_PRODUCTION if order
is already SHIPPED). Always check current status before updating.

**PATTERN 19 — LULU_SANDBOX mode controls real vs sandbox orders**
`LULU_SANDBOX=true` on RPi5 = sandbox API (no real prints, no real charges to Lulu account)
`LULU_SANDBOX=false` on RPi5 = production API (real money, real prints, real shipping)
The go-live checklist (below) must be complete before setting `LULU_SANDBOX=false`.
Confirm the current value on RPi5 before any order-related session.

**PATTERN 20 — Cost calculation uses post-generation page count**
The Lulu cost estimate endpoint calls `POST /print-jobs/cost-calculations/` with the
exact page count of the generated interior PDF. Do not estimate page count before
generation — Lulu's price depends on the actual page count and must be calculated
after `generate` completes. Show the user a price only after PDFs are generated.

---

### Cover PDF

**PATTERN 21 — Cover spine width is page-count-dependent**
The one-piece cover PDF (back + spine + front) requires the spine width, which Lulu
calculates from the interior page count. If the interior is regenerated (recipe list
changed, recipe content changed), the cover PDF must also be regenerated — the old
cover PDF will have the wrong spine width. Never allow the interior and cover PDFs to
become out of sync after a recipe content change.

---

## Plan gating

`canPrintCookbook` is available on Chef, Family, and Pro plans. Free users are blocked.

```typescript
// In subscriptions.ts
canPrintCookbook: tier === 'chef' || tier === 'family' || tier === 'pro'
```

Routes that must enforce this gate:
- `/api/print-cookbooks/[id]/generate` — returns 403 `{ error: "upgrade_required" }` for free users
- `/dashboard/print-cookbook/[id]` — redirects to `/dashboard/plans?reason=print`
- `/dashboard/print-cookbook` — redirects free users to plans page

When changing plan gating, update `packages/db/src/subscriptions.ts` only —
never hardcode plan checks in individual routes or pages.

---

## Image quality and upscaling

Images are classified by estimated print DPI before generation:

| Badge | Threshold | Behavior at print time |
|-------|-----------|------------------------|
| Green — Print ready | ≥ 300 DPI estimated | Used as-is |
| Yellow — Will be enhanced | 150–299 DPI estimated | Upscaled via Replicate |
| Red — Will be enhanced | < 150 DPI estimated | Upscaled via Replicate |

Quality badges are informational only — they do not block PDF generation.
Upscaling is handled automatically in the print path using Replicate Real-ESRGAN 4x.
Log every upscale call to `ai_usage_log`: action `upscale`, model `real-esrgan-4x`, cost `0.002`.
Always fall back to the original image if upscaling fails — never abort PDF generation.

---

## Upscaling cost tracking

Upscaling calls must be logged to `ai_usage_log`:
```typescript
await logAiCall({
  action: 'upscale',
  model: 'real-esrgan-4x',
  cost: 0.002,
  user_id: userId,
});
```

---

## Go-live checklist — MUST be complete before LULU_SANDBOX=false

- [ ] Get production Lulu API credentials from https://developers.lulu.com
- [ ] Add credit card to Lulu API account to cover production print charges
- [ ] Set `LULU_SANDBOX=false` in RPi5 `.env.local`
- [ ] Verify `cookbook-pdfs` bucket is publicly accessible
- [ ] Test one real end-to-end order (place real order, verify Lulu receives print job,
      verify tracking webhook updates order status)
- [ ] Confirm Stripe is in live mode (not test mode) for production charges
- [ ] Set up monitoring for `/api/webhooks/lulu` — failed webhooks = lost order status updates

Do not set `LULU_SANDBOX=false` until every item above is checked. Record completion
date in DONE.md.

---

## Post-flight checklist — run before /wrapup

- [ ] `npx tsc --noEmit` in `apps/web` — 0 new errors introduced
- [ ] Preview path still uses `fetchImageAsBase64()` (no Replicate calls)
- [ ] Print path still uses `fetchImageWithUpscaling()` (upscaling enabled)
- [ ] No emoji characters in any template or string that flows into PDF content
- [ ] All print API routes still use `supabaseAdmin.auth.getUser(token)` for JWT validation
- [ ] All data fetches in generate route still use `supabaseAdmin`
- [ ] FlipbookPreview still has `ssr: false` on its dynamic import
- [ ] Cover image still converts to base64 before passing to react-pdf
- [ ] Image uploads still use `/api/print-cookbooks/upload-cover` (not direct browser fetch)
- [ ] LULU_SANDBOX value on RPi5 is what you expect — confirm before deploy
- [ ] Deployed to RPi5 via `deploy-staging.sh`
- [ ] `curl -I https://chefsbk.app/dashboard/print-cookbook` returns HTTP 200
- [ ] `pm2 logs chefsbook-web --lines 30` shows no startup errors
