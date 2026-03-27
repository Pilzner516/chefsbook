# Chefsbook Web — apps/web

Next.js 15 (App Router) + React 19 + Tailwind CSS 3.

## Trattoria Theme

All pages use these colours via the `cb-*` Tailwind prefix (defined in `tailwind.config.ts`):

| Token        | Value     | Usage                           |
|--------------|-----------|---------------------------------|
| `cb-bg`      | `#faf7f0` | Page background (warm cream)    |
| `cb-card`    | `#ffffff` | Card / panel backgrounds        |
| `cb-border`  | `#e8e0d0` | Borders, dividers               |
| `cb-primary` | `#ce2b37` | Buttons, links, active states   |
| `cb-green`   | `#009246` | CTAs ("Start cooking"), success  |
| `cb-text`    | `#1a1a1a` | Primary body text               |
| `cb-muted`   | `#7a6a5a` | Secondary / helper text          |

- Font: Inter (Google Fonts, loaded in `globals.css`)
- Border radius: `rounded-card` (12px) for cards, `rounded-input` (8px) for inputs
- No gradients, no shadows — flat and clean

## Pages

| Route                          | File                                  | Description                                                    |
|--------------------------------|---------------------------------------|----------------------------------------------------------------|
| `/`                            | `app/page.tsx`                        | Landing: header, hero + 2 CTAs, 3-col features, pricing, footer |
| `/pricing`                     | `app/pricing/page.tsx`                | 3 tier cards (Free / Pro $4.99 / Family $8.99), Stripe stubs   |
| `/dashboard`                   | `app/dashboard/page.tsx`              | Recipe grid: search, filter pills, cards with tags/source URL  |
| `/dashboard/scan`              | `app/dashboard/scan/page.tsx`         | 3 panels: OCR image upload, URL import, bookmark import        |
| `/dashboard/plan`              | `app/dashboard/plan/page.tsx`         | Weekly meal plan calendar, link to templates                   |
| `/dashboard/plan/templates`    | `app/dashboard/plan/templates/page.tsx` | Reusable menu templates: create, preview grid, deploy to planner |
| `/dashboard/shop`              | `app/dashboard/shop/page.tsx`         | Shopping lists grouped by aisle, checkboxes                    |
| `/dashboard/cookbooks`         | `app/dashboard/cookbooks/page.tsx`    | Cookbook shelf: ingredient search, grid with covers + ratings   |
| `/recipe/[id]`                 | `app/recipe/[id]/page.tsx`            | Public recipe: hero, servings scaler, ingredients, steps, share, CTA |
| `/share/[token]`               | `app/share/[token]/page.tsx`          | Shared recipe landing: full recipe view, "Add to my Chefsbook" CTA |
| `/chef/[username]`             | `app/chef/[username]/page.tsx`        | Public chef profile (scaffold)                                 |

### Dashboard layout

`app/dashboard/layout.tsx` — sidebar with nav links (Recipes, Scan, Plan, Shop, Cookbooks, Discover) + Upgrade button.

### Bookmark import flow (scan page, third panel)

1. Drop zone accepts `bookmarks.html` (exported from Chrome/Safari/Firefox)
2. Parser extracts URLs grouped by folder name
3. Preview table: checkbox per row, favicons, folder colour tags, select all/none per folder
4. Progress: bar + live feed of imported titles
5. Complete: summary ("284 imported, 18 skipped, 10 failed"), collapsible failed list

## API Routes

| Route                      | Method | Description                                       |
|----------------------------|--------|---------------------------------------------------|
| `/api/import/url`          | POST   | Fetches URL, strips HTML, returns text for AI      |
| `/api/webhooks/stripe`     | POST   | Handles Stripe subscription events, updates plan   |

## Imports

- Database: `import { supabase, listRecipes, createRecipe, ... } from '@chefsbook/db'`
- AI: `import { scanRecipe, importFromUrl } from '@chefsbook/ai'`
- Utilities: `import { formatDuration, formatQuantity, scaleQuantity, groupBy } from '@chefsbook/ui'`

Never call `createClient()` directly. Never call the Claude API directly in app code.
