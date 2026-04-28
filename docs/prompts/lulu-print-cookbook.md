# Prompt: ChefsBook Print — Lulu Direct Print-on-Demand Cookbook Integration (Web Only)

## LAUNCH PROMPT (paste this into Claude Code to start the session)

```
Read and execute docs/prompts/lulu-print-cookbook.md fully and autonomously, from pre-flight through deployment and /wrapup. Do not stop for questions unless you hit a genuine blocker.
```

---

## TYPE: FEATURE — WEB ONLY

## Overview

Users can select recipes from their ChefsBook collection, arrange them into a cookbook,
add a title and cover, and order a professionally printed physical book via Lulu Direct's
print-on-demand API. Lulu prints and ships directly to the customer. ChefsBook charges
the user (via Stripe) and pays Lulu, keeping the margin.

This feature is web-only. It will NOT be built on mobile.

---

## Agent files to read — ALL of these, in order, before writing a single line of code

- `.claude/agents/wrapup.md`
- `.claude/agents/testing.md`
- `.claude/agents/feature-registry.md`
- `.claude/agents/ui-guardian.md`
- `.claude/agents/data-flow.md`
- `.claude/agents/deployment.md`

Run ALL pre-flight checklists before writing any code.

---

## Pre-flight: before writing any code

1. Read Lulu API docs: https://api.lulu.com/docs/
2. Read Lulu sandbox docs: https://developers.sandbox.lulu.com/
3. Confirm Stripe is already configured in the project (check `.env.local` on RPi5
   and existing Stripe routes in `apps/web/app/api/`)
4. Confirm existing PDF generation capability (the existing print/PDF export feature)
   — the cookbook interior will be generated as a PDF using this pipeline
5. Check existing plan gating patterns — this feature is Pro plan only
6. Confirm the next available DB migration number from DONE.md

---

## Architecture

```
User builds cookbook in UI
        ↓
ChefsBook generates PDF interior + cover (Puppeteer/existing PDF pipeline)
        ↓
PDF uploaded to temporary storage (Supabase Storage)
        ↓
User previews and confirms order + enters shipping address
        ↓
Stripe payment collected by ChefsBook
        ↓
ChefsBook calls Lulu API with PDF URLs + shipping details
        ↓
Lulu prints and ships directly to customer
        ↓
Lulu webhook → ChefsBook updates order status
        ↓
User sees order tracking on their Orders page
```

---

## Environment variables needed

Add to `.env.local` on RPi5 and to `.env.example`:

```
LULU_API_KEY=
LULU_API_SECRET=
LULU_SANDBOX=true   # set to false when going live
LULU_WEBHOOK_SECRET=
```

Use sandbox credentials during development. Document where to get them:
https://developers.sandbox.lulu.com/user-profile/api-keys

---

## Database migrations

Confirm next migration number from DONE.md before writing.

### Migration: cookbooks table

```sql
CREATE TABLE cookbooks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  subtitle TEXT,
  author_name TEXT NOT NULL,
  cover_style TEXT NOT NULL DEFAULT 'classic',
  -- cover_style options: 'classic' | 'modern' | 'minimal'
  recipe_ids UUID[] NOT NULL DEFAULT '{}',
  -- ordered array of recipe IDs included in the book
  status TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'generating', 'ready', 'ordered')),
  interior_pdf_url TEXT,
  -- Supabase Storage URL for the generated interior PDF
  cover_pdf_url TEXT,
  -- Supabase Storage URL for the generated cover PDF
  page_count INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_cookbooks_user_id ON cookbooks(user_id);

ALTER TABLE cookbooks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users own cookbooks" ON cookbooks
  USING (user_id = auth.uid());
```

### Migration: cookbook_orders table

```sql
CREATE TABLE cookbook_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id),
  cookbook_id UUID NOT NULL REFERENCES cookbooks(id),
  lulu_print_job_id TEXT,
  stripe_payment_intent_id TEXT,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN (
      'pending', 'payment_complete', 'submitted_to_lulu',
      'in_production', 'shipped', 'delivered', 'cancelled', 'failed'
    )),
  quantity INTEGER NOT NULL DEFAULT 1,
  -- Pricing (stored in cents)
  lulu_print_cost_cents INTEGER,    -- what Lulu charges us
  shipping_cost_cents INTEGER,       -- Lulu shipping cost
  our_margin_cents INTEGER,          -- ChefsBook markup
  total_charged_cents INTEGER,       -- what user pays
  -- Shipping address
  shipping_name TEXT NOT NULL,
  shipping_street1 TEXT NOT NULL,
  shipping_street2 TEXT,
  shipping_city TEXT NOT NULL,
  shipping_state TEXT,
  shipping_postcode TEXT NOT NULL,
  shipping_country_code TEXT NOT NULL,
  shipping_phone TEXT NOT NULL,
  shipping_level TEXT NOT NULL DEFAULT 'GROUND'
    CHECK (shipping_level IN ('MAIL', 'PRIORITY_MAIL', 'GROUND', 'EXPEDITED', 'EXPRESS')),
  -- Tracking
  tracking_number TEXT,
  tracking_url TEXT,
  estimated_delivery_date DATE,
  lulu_webhook_data JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_cookbook_orders_user_id ON cookbook_orders(user_id);

ALTER TABLE cookbook_orders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users own orders" ON cookbook_orders
  USING (user_id = auth.uid());
```

After migrations: `docker restart supabase-rest`

---

## Lulu product specification

ChefsBook cookbooks will use a single standard format:

```
pod_package_id: 0850X1100FCSTDPB060CW444GXX
```

Breaking this down:
- **8.5" × 11"** — standard cookbook size
- **Full colour** interior (recipes with photos if available)
- **Standard** quality
- **Perfect bind** (softcover)
- **60lb** paper
- **Colour wrap** cover

This `pod_package_id` must be verified against the Lulu API
`GET /print-jobs/cost-calculations` before hardcoding. Confirm the ID is valid
in sandbox before proceeding.

---

## Pricing model

```
Lulu print cost (varies by page count) + $0.75 fulfilment fee
+ Shipping cost
+ ChefsBook margin: $4.99 flat
= Total charged to user
```

Calculate Lulu's cost dynamically using:
`POST https://api.lulu.com/print-jobs/cost-calculations/`

Show the price breakdown to the user before checkout:
- "Print & production: $X.XX"
- "Shipping: $X.XX"
- "ChefsBook service fee: $4.99"
- **"Total: $X.XX"**

---

## Feature: Cookbook Builder UI

### Route: `/dashboard/print`

**Step 1 — Select Recipes**
- Grid of the user's recipes (same card style as recipe list)
- Checkbox on each card to select/deselect
- Selected count shown: "12 recipes selected"
- Drag to reorder selected recipes (determines order in the book)
- Minimum 5 recipes required
- Maximum 80 recipes (page count limit)
- "Continue →" button

**Step 2 — Book Details**
- Title input (required, max 60 chars)
- Subtitle input (optional, max 80 chars)
- Author name (pre-filled from user's display name, editable)
- Cover style selector — show visual previews of 3 options:
  - Classic (cream background, serif font — matches Trattoria theme)
  - Modern (dark background, sans-serif)
  - Minimal (white, clean lines)
- "Preview Cover →" button

**Step 3 — Preview & Generate**
- Show a visual mock of the cover based on chosen style
- Page count estimate: "Approximately X pages"
- Price breakdown (fetched from Lulu cost calculation API)
- "Generate My Cookbook" button
- On click: triggers PDF generation (see PDF Generation section below)
- Show progress indicator: "Generating your cookbook... This takes 1–2 minutes"

**Step 4 — Review & Order**
- Show thumbnail preview of first few pages (if feasible) or cover only
- Quantity selector (1–10)
- Shipping address form
- Shipping speed selector with costs (GROUND / EXPEDITED / EXPRESS)
- Final price summary
- "Order Now" → Stripe checkout
- After payment: submit to Lulu API

**Step 5 — Confirmation**
- Order confirmed page
- "Your cookbook is being printed. You'll receive an email when it ships."
- Link to order tracking page

---

## PDF Generation

### Interior PDF

Use the existing Puppeteer/PDF export pipeline as the base. For cookbooks, generate
a multi-page PDF with:

**Page structure:**
1. Title page (cookbook title, subtitle, author, ChefsBook logo small at bottom)
2. Table of contents (auto-generated from recipe list)
3. For each recipe: 1–2 pages depending on content
   - Recipe title, description
   - Ingredients list
   - Steps
   - Photo if available (fetch from recipe data)
   - Nutrition info if available
4. Back page: "Created with ChefsBook — chefsbook.app"

**PDF spec for Lulu interior:**
- Page size: 8.5" × 11" (612pt × 792pt)
- Bleed: 0.125" on all sides
- Margins: 0.75" top/bottom, 0.875" inner, 0.625" outer
- Font: use the ChefsBook brand font
- Resolution: 300 DPI for any images

### Cover PDF

Generate a one-piece cover PDF based on the chosen cover style:
- Lulu provides a spine width calculator based on page count
- `GET https://api.lulu.com/print-jobs/cost-calculations/` returns spine width
- Cover must be a single PDF: front cover + spine + back cover
- Use a simple but attractive template for each of the 3 styles
- Back cover: brief description + "Created with ChefsBook"
- Barcode placeholder area (bottom right of back cover — Lulu adds ISBN barcode)

### Storage

Upload both PDFs to Supabase Storage bucket `cookbook-pdfs`:
- `cookbooks/{cookbook_id}/interior.pdf`
- `cookbooks/{cookbook_id}/cover.pdf`

Update `cookbooks` table with the public URLs after upload.
PDFs must be publicly accessible URLs for Lulu to fetch them.

---

## API routes

### `POST /api/cookbooks` — create/update a cookbook draft
### `GET /api/cookbooks` — list user's cookbooks
### `GET /api/cookbooks/[id]` — get a cookbook
### `POST /api/cookbooks/[id]/generate` — trigger PDF generation
### `GET /api/cookbooks/[id]/price` — get Lulu price estimate

```typescript
// calls Lulu cost calculation API
// returns: { lulu_cost, shipping_cost, our_margin, total }
```

### `POST /api/cookbooks/[id]/order` — create Stripe payment intent
### `POST /api/cookbooks/[id]/submit` — submit to Lulu after payment
### `POST /api/webhooks/lulu` — receive Lulu order status updates

```typescript
// Lulu sends webhooks for: IN_PRODUCTION, SHIPPED, DELIVERED, CANCELLED
// Update cookbook_orders.status accordingly
// On SHIPPED: save tracking_number and tracking_url
```

### `GET /api/orders` — list user's cookbook orders
### `GET /api/orders/[id]` — get order status + tracking

---

## Plan gating

This feature is **Pro plan only**.

- If user is not on Pro: show a locked state on `/dashboard/print` with upgrade prompt
- Use the existing plan gating pattern from feature-registry.md

---

## Navigation

Add "Print Cookbook" to the web dashboard sidebar navigation under a new
"Create" section, below the existing recipe management links.

Icon: use a book/print icon consistent with the existing sidebar icon style.

---

## Orders page

Add `/dashboard/orders` page showing all cookbook orders:
- Order date, cookbook title, status badge, tracking link when available
- Status badges: Pending / In Production / Shipped / Delivered / Cancelled
- Link to re-order the same cookbook

---

## Email notifications

When `cookbook_orders.status` changes to `shipped`:
- Send email to user: "Your ChefsBook cookbook is on its way!"
- Include: tracking number, tracking URL, estimated delivery date
- Use the existing email sending pattern in the codebase

---

## Testing

### Sandbox testing (use Lulu sandbox for all dev/staging)
1. Create a test cookbook with 5+ recipes
2. Trigger PDF generation — confirm both PDFs are created in Supabase Storage
3. Fetch price estimate — confirm it returns a valid price breakdown
4. Place a test order using Stripe test card `4242 4242 4242 4242`
5. Confirm the order is submitted to Lulu sandbox API
6. Simulate a Lulu webhook: `POST /api/webhooks/lulu` with test payload
7. Confirm order status updates correctly in the DB
8. Confirm the order appears on `/dashboard/orders`

### psql verification
```sql
SELECT id, title, status, page_count FROM cookbooks
WHERE user_id = (SELECT id FROM auth.users LIMIT 1);

SELECT id, status, total_charged_cents, tracking_number
FROM cookbook_orders ORDER BY created_at DESC LIMIT 5;
```

### Web UI verification
- Step through all 5 steps of the cookbook builder
- Confirm price shows correctly before checkout
- Confirm Pro plan gate works for non-Pro users
- No console errors throughout

---

## Deploy

Follow `deployment.md`. Deploy web to RPi5.
Add new env vars to RPi5 `.env.local` before deploying.
Run regression smoke test from `testing.md` before wrapup.

---

## Wrapup

Follow `wrapup.md` fully.
Log Lulu sandbox credentials location in DONE.md.
Add production go-live checklist to AGENDA.md:
- [ ] Get production Lulu API credentials
- [ ] Set LULU_SANDBOX=false in RPi5 .env.local
- [ ] Add credit card to Lulu API account for production charges
- [ ] Test one real order end-to-end before announcing feature
