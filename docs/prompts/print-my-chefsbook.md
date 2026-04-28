# Prompt: Print My ChefsBook — Visual Book Editor

## LAUNCH PROMPT (paste this into Claude Code to start the session)

```
Read and execute docs/prompts/print-my-chefsbook.md fully and autonomously. This is a major architectural feature. Before writing a single line of code, read every agent file listed, run every pre-flight check, and study the existing print feature thoroughly. Only then begin building. Do not stop for questions unless you hit a genuine blocker that cannot be resolved by reading the codebase.
```

---

## TYPE: MAJOR FEATURE — WEB ONLY — NO MOBILE CHANGES

**CRITICAL: This feature is web-only. Do not touch apps/mobile, apps/mobile/**, 
or any mobile component. Any change to mobile files is a session failure.**

---

## Session model: USE OPUS — Architect first, build second

This is a complex, multi-layer feature. Before writing code, Opus must:
1. Read all agents fully
2. Study the existing print feature at `apps/web/app/dashboard/print/`
3. Design the complete data model on paper (in comments)
4. Plan all components and their relationships
5. Identify every existing pattern to reuse (drag-and-drop library, auth, storage)
6. Only then begin implementing, phase by phase

---

## Agent files — ALL required, read in this order

1. `.claude/agents/wrapup.md`
2. `.claude/agents/testing.md` — MANDATORY
3. `.claude/agents/feature-registry.md` — MANDATORY, check print feature before touching
4. `.claude/agents/ui-guardian.md` — MANDATORY, major new UI
5. `.claude/agents/data-flow.md` — MANDATORY, significant state management
6. `.claude/agents/image-system.md` — MANDATORY, image uploads throughout
7. `.claude/agents/deployment.md` — MANDATORY
8. `.claude/agents/pdf-design.md` — read to understand the PDF generation pipeline

Run ALL pre-flight checklists. Verify every relevant table schema on RPi5 before writing queries.

---

## Context: What exists today

The existing print feature lives at `apps/web/app/dashboard/print/`. It is a 6-step wizard:
1. Select recipes
2. Recipe order (up/down arrows)  
3. Image selection (thumbnail grid)
4. Book details (title, author, foreword)
5. Print options (size, binding, paper)
6. Generate & checkout

The new feature REPLACES steps 1-4 with a visual canvas editor. Steps 5-6 (print options
and checkout) remain unchanged. The existing wizard at `/dashboard/print` stays intact —
the new canvas is a NEW route at `/dashboard/print-cookbook`.

Study the existing wizard thoroughly — reuse its API routes, DB queries, and Supabase
calls wherever possible. Do not rewrite working code.

---

## New navigation

Add "Print My ChefsBook" to the web dashboard sidebar navigation.
- Route: `/dashboard/print-cookbook`
- Position: below "My Cookbooks" in the sidebar
- Icon: book/print icon consistent with existing sidebar icons
- Plan gate: Pro plan only (same as existing print feature)
- If user is not Pro: show the locked state with upgrade prompt

Find where the sidebar nav is defined and add the new item there. Check
`apps/web/app/dashboard/layout.tsx` or `apps/web/components/Sidebar.tsx` (find the
actual file — do not guess).

---

## Data model: book_layout JSONB

### Migration: add book_layout to printed_cookbooks

Confirm the next migration number from DONE.md, then:

```sql
ALTER TABLE printed_cookbooks
  ADD COLUMN book_layout JSONB;

COMMENT ON COLUMN printed_cookbooks.book_layout IS
  'Full structured book layout. See TypeScript BookLayout type in apps/web/lib/book-layout.ts';
```

The existing columns (`recipe_ids`, `selected_image_urls`, `foreword`, `cover_image_url`) 
remain for backward compatibility with the old wizard. New editor uses `book_layout` only.

### TypeScript types — create: `apps/web/lib/book-layout.ts`

```typescript
/**
 * BookLayout — the complete structure of a printed cookbook.
 * Stored as JSONB in printed_cookbooks.book_layout.
 * Version field allows future schema migrations.
 */
export interface BookLayout {
  version: 1
  cards: BookCard[]
}

/**
 * A BookCard represents one section of the book.
 * Cards are ordered in the array = order in the book.
 * Some cards are locked (cannot be moved or deleted).
 */
export type BookCard =
  | CoverCard
  | ForewordCard
  | TocCard
  | RecipeCard
  | IndexCard
  | BackCard

export interface CoverCard {
  id: string               // uuid, generated on creation
  type: 'cover'
  locked: true             // always first, cannot move
  image_url?: string       // user-uploaded cover photo
  title: string
  subtitle?: string
  author: string
  cover_style: 'classic' | 'modern' | 'minimal'
}

export interface ForewordCard {
  id: string
  type: 'foreword'
  locked: false
  text?: string            // user-written foreword/dedication, max 1000 chars
}

export interface TocCard {
  id: string
  type: 'toc'
  locked: false            // can be repositioned (e.g. after foreword)
  auto: true               // content computed from card order at PDF generation
}

export interface RecipeCard {
  id: string
  type: 'recipe'
  locked: false
  recipe_id: string
  display_name: string     // user-editable name for the book (defaults to recipe title)
  pages: RecipePage[]
}

/**
 * A RecipePage is one physical page within a recipe's section.
 * Pages are ordered within their card and can be reordered by the user.
 */
export type RecipePage =
  | ImagePage
  | ContentPage
  | CustomPage

export interface ImagePage {
  id: string
  kind: 'image'
  image_url?: string       // selected from recipe_user_photos; if empty, use styled placeholder
}

export interface ContentPage {
  id: string
  kind: 'content'          // auto-generated: ingredients + steps from recipe data
  part: 1 | 2             // most recipes = 1; long recipes may need 2 content pages
  // Note: content is generated at PDF time from the recipe_id — not stored here
}

export interface CustomPage {
  id: string
  kind: 'custom'           // user-created page inserted between existing pages
  layout: 'image_only' | 'text_only' | 'image_and_text'
  image_url?: string
  text?: string            // max 600 chars
  caption?: string         // max 100 chars; shown below image in image+text layout
}

export interface IndexCard {
  id: string
  type: 'index'
  locked: false
  auto: true               // content computed from card order at PDF generation
}

export interface BackCard {
  id: string
  type: 'back'
  locked: true             // always last; ChefsBook branding only, user cannot edit
}

/**
 * Computed page numbers for TOC and Index.
 * Re-computed on every layout change.
 */
export interface PageMap {
  [cardId: string]: number   // starting page number for each card
}

/**
 * Create a default BookLayout for a new cookbook.
 */
export function createDefaultLayout(params: {
  title: string
  subtitle?: string
  author: string
  cover_style: 'classic' | 'modern' | 'minimal'
}): BookLayout {
  return {
    version: 1,
    cards: [
      {
        id: crypto.randomUUID(),
        type: 'cover',
        locked: true,
        title: params.title,
        subtitle: params.subtitle,
        author: params.author,
        cover_style: params.cover_style,
      },
      {
        id: crypto.randomUUID(),
        type: 'foreword',
        locked: false,
        text: undefined,
      },
      {
        id: crypto.randomUUID(),
        type: 'toc',
        locked: false,
        auto: true,
      },
      // Recipe cards inserted here by the user
      {
        id: crypto.randomUUID(),
        type: 'index',
        locked: false,
        auto: true,
      },
      {
        id: crypto.randomUUID(),
        type: 'back',
        locked: true,
      },
    ],
  }
}

/**
 * Compute page numbers for every card in the layout.
 * Cover = no page number. TOC starts at page 2.
 * Each recipe card's page count = pages.length.
 * Index and Back follow after all recipes.
 */
export function computePageMap(layout: BookLayout): PageMap {
  const map: PageMap = {}
  let currentPage = 1

  for (const card of layout.cards) {
    map[card.id] = currentPage

    switch (card.type) {
      case 'cover':
        currentPage += 1  // cover is page 1, no printed number
        break
      case 'foreword':
        currentPage += 1
        break
      case 'toc':
        currentPage += 1
        break
      case 'recipe':
        currentPage += card.pages.length
        break
      case 'index':
        currentPage += 1
        break
      case 'back':
        currentPage += 1
        break
    }
  }

  return map
}

/**
 * Create a default RecipeCard for a given recipe.
 * Determines how many content pages based on step count.
 */
export function createRecipeCard(recipe: {
  id: string
  title: string
  image_urls: string[]
  step_count: number
}): RecipeCard {
  const pages: RecipePage[] = [
    {
      id: crypto.randomUUID(),
      kind: 'image',
      image_url: recipe.image_urls[0],
    },
    {
      id: crypto.randomUUID(),
      kind: 'content',
      part: 1,
    },
  ]

  // Long recipes (12+ steps) get a second content page
  if (recipe.step_count >= 12) {
    pages.push({
      id: crypto.randomUUID(),
      kind: 'content',
      part: 2,
    })
  }

  return {
    id: crypto.randomUUID(),
    type: 'recipe',
    locked: false,
    recipe_id: recipe.id,
    display_name: recipe.title,
    pages,
  }
}
```

---

## The Visual Canvas: `/dashboard/print-cookbook`

### Page structure

```
/dashboard/print-cookbook
  → if no cookbook in progress: show "Start New Cookbook" 
  → if cookbook in progress: load canvas with book_layout
  → if cookbook completed: show "Generate PDF" option + start new

/dashboard/print-cookbook/[id]
  → the canvas editor for a specific cookbook
```

### Canvas layout

Full-page canvas. No wizard steps — this IS the editor.

```
┌─────────────────────────────────────────────────────────────────┐
│  Print My ChefsBook                              [Generate PDF →]│
│  Drag cards to reorder. Click to edit.                          │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  [+ Add Recipes]  [Book Settings]                               │
│                                                                  │
│  ┌──────────────────┐  ┌──────────────────┐                    │
│  │ 🔒 COVER          │  │    FOREWORD       │                    │
│  │ [cover preview]   │  │ "My intro..."     │                    │
│  │ my Chef's book    │  │ [Edit]            │                    │
│  └──────────────────┘  └──────────────────┘                    │
│                                                                  │
│  ┌──────────────────┐  ┌──────────────────┐                    │
│  │    TABLE OF       │  │ ⠿ RECIPE p.4     │                    │
│  │    CONTENTS       │  │ [photo thumb]     │                    │
│  │ (auto-generated)  │  │ Beautiful Burger  │                    │
│  │                   │  │ Buns              │                    │
│  │                   │  │ [📄 📄 +]         │  ← page thumbnails │
│  └──────────────────┘  └──────────────────┘                    │
│                                                                  │
│  ... more recipe cards ...                                       │
│                                                                  │
│  ┌──────────────────┐  ┌──────────────────┐                    │
│  │    INDEX          │  │ 🔒 BACK           │                    │
│  │ (auto-generated)  │  │ ChefsBook         │                    │
│  │                   │  │ (reserved)        │                    │
│  └──────────────────┘  └──────────────────┘                    │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### Card grid

2-column grid on desktop (width ≥ 1024px), 1-column on mobile.
Card min-height: 240px. Fixed card width = full column width.
Cards snap to a consistent grid — not freeform positioning.

---

## Card components

### CoverCard (locked, always first)

```
┌─────────────────────────────────────────────┐
│ 🔒  COVER                          Page 1   │
├─────────────────────────────────────────────┤
│                                             │
│  ┌─────────────────────────────────────┐    │
│  │         [cover image preview]       │    │  ← 16:9, object-fit: cover
│  │         or cream placeholder        │    │
│  └─────────────────────────────────────┘    │
│                                             │
│  my Chef's book                             │  ← title, truncated
│  Because it's that good                     │  ← subtitle
│  by Chef                                    │  ← author
│                                             │
│  [✏ Edit Cover]                            │
└─────────────────────────────────────────────┘
```

"Edit Cover" opens a sidebar panel (not a modal) with:
- Title input
- Subtitle input (optional)
- Author name input  
- Cover style selector (Classic / Studio / Garden — radio cards with previews)
- Cover image upload (drag or click, goes to `cookbook-covers` Supabase Storage bucket)
- Live preview updates as user types/selects

### ForewordCard (draggable, default second)

```
┌─────────────────────────────────────────────┐
│ ⠿  FOREWORD                       Page 2   │
├─────────────────────────────────────────────┤
│                                             │
│  ┌─────────────────────────────────────┐    │
│  │ "This collection represents years   │    │  ← first 120 chars of text
│  │ of cooking, sharing, and loving..." │    │
│  │                         [Edit ✏]   │    │
│  └─────────────────────────────────────┘    │
│  or: "Click to add a foreword"              │  ← empty state
│                                             │
└─────────────────────────────────────────────┘
```

Clicking "Edit" opens an inline textarea below the preview:
- `<textarea>` with max 1000 chars, character counter
- "Save" button saves to layout state (auto-saves to DB on blur)
- Close collapses the textarea

### TocCard (draggable, auto-generated)

```
┌─────────────────────────────────────────────┐
│ ⠿  TABLE OF CONTENTS              Page 3   │
├─────────────────────────────────────────────┤
│                                             │
│  Beautiful Burger Buns .............. 4    │
│  Chimichurri Sauce .................. 6    │
│  Chicken Liver Pâté ................. 8    │
│  ···                                        │
│  (auto-updates as you reorder recipes)      │
│                                             │
└─────────────────────────────────────────────┘
```

Content computed live from card order + `computePageMap()`.
Shows first 5 recipe names with page numbers, then "···" if more.
No user editing — fully automatic.

### RecipeCard (draggable, expandable)

**Collapsed state:**

```
┌─────────────────────────────────────────────┐
│ ⠿  RECIPE                         p.4-6   │  ← drag handle, page range
├─────────────────────────────────────────────┤
│                                             │
│  ┌─────────────────────────────────────┐    │
│  │         [recipe image]              │    │  ← 16:9 image, object-fit cover
│  │         or styled placeholder       │    │
│  └─────────────────────────────────────┘    │
│                                             │
│  Beautiful Burger Buns              [✏]    │  ← display_name, click ✏ to rename
│  American · side · 40 min                  │  ← meta, read-only
│                                             │
│  [📷][📄][📄]  [+ Add Page]   [▼ Pages]  │  ← page count icons, expand button
│                                             │
└─────────────────────────────────────────────┘
```

Page icons: 📷 = image page, 📄 = content page, ✨ = custom page
Count of pages shown as icons. Clicking "▼ Pages" expands.

**Expanded state (click "▼ Pages"):**

```
┌─────────────────────────────────────────────┐
│ ⠿  RECIPE                         p.4-6   │
├─────────────────────────────────────────────┤
│  Beautiful Burger Buns              [✏]    │
│  American · side · 40 min                  │
│                                             │
│  Pages:                                     │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  │
│  │ ⠿ p.4   │  │ ⠿ p.5   │  │ ⠿ p.6   │  │  ← each is draggable within card
│  │ 📷 IMAGE │  │ 📄 STEPS │  │ + CUSTOM │  │
│  │ [change] │  │ (auto)   │  │ [edit]   │  │
│  └──────────┘  └──────────┘  └──────────┘  │
│                                             │
│  [+ Add Page]                               │
│                                             │
│                           [▲ Collapse]      │
└─────────────────────────────────────────────┘
```

**Image page mini-card:**
- Shows current image as thumbnail
- "Change" opens image picker: shows all `recipe_user_photos` for this recipe
- "None" option renders a styled text placeholder in the PDF
- Images fetched via `getPrimaryPhotos()` from `@chefsbook/db` — NEVER use `recipe.image_url` directly

**Content page mini-card:**
- Shows "Ingredients & Steps" label
- Locked content (auto-generated from recipe data at PDF time)
- Cannot be deleted (at least 1 content page required per recipe)
- Drag to reorder within the recipe's pages

**Custom page mini-card:**
- Shows layout badge (📷 / 📝 / 📷📝)
- "Edit" opens inline editor:
  - Layout toggle: Image Only / Text Only / Image + Text
  - If image: upload button (goes to `cookbook-pdfs/{user_id}/custom/` bucket)
  - If text: textarea max 600 chars
  - If both: image on top, text below, caption field max 100 chars
- Can be deleted (× button top-right of mini-card)

**Display name editing (✏ button):**
- Click ✏ → title text becomes an inline `<input>`
- Enter or blur saves
- Original recipe title preserved in DB — only `display_name` in layout changes

**"+ Add Page" button:**
Opens a popover with 3 options:
```
Add a page to this recipe
┌──────────────┐ ┌──────────────┐ ┌──────────────┐
│      📷      │ │      📝      │ │    📷 + 📝   │
│   Full Photo │ │  Text Only   │ │  Photo + Text │
└──────────────┘ └──────────────┘ └──────────────┘
```
New custom page inserted at the END of the recipe's pages array.
User can then drag it to the desired position.

**Delete recipe card:**
X button top-right of card header. Confirm dialog: "Remove [recipe name] from the cookbook?"
Uses `ChefsDialog` / `useConfirmDialog` — never raw `alert()`.

### IndexCard (draggable, auto-generated)

```
┌─────────────────────────────────────────────┐
│ ⠿  INDEX                                   │
├─────────────────────────────────────────────┤
│                                             │
│  B  Beautiful Burger Buns ........... 4    │
│  C  Chicken Liver Pâté .............. 8    │
│     Chimichurri Sauce ............... 6    │
│  ···                                        │
│  (alphabetical, auto-updates)               │
│                                             │
└─────────────────────────────────────────────┘
```

Alphabetical by `display_name`. Computed from card order + `computePageMap()`.
Shows first 6 entries, then "···". Fully automatic.

### BackCard (locked, always last)

```
┌─────────────────────────────────────────────┐
│ 🔒  BACK COVER              (Reserved)      │
├─────────────────────────────────────────────┤
│                                             │
│  [ChefsBook hat icon]                       │
│  ChefsBook                                  │
│  Your recipes, beautifully collected.       │
│  chefsbk.app                               │
│                                             │
│  This page is reserved for ChefsBook        │
│  branding and cannot be edited.             │
│                                             │
└─────────────────────────────────────────────┘
```

No edit controls. Lock icon visible. Muted styling to indicate read-only.

---

## Drag and drop

### Pre-flight: identify existing library

```bash
grep -r "dnd-kit\|react-beautiful-dnd\|sortable\|useDrag\|useDroppable\|DndContext" \
  apps/web/ --include="*.tsx" --include="*.ts" -l | head -10

cat apps/web/package.json | grep -i "dnd\|drag\|sort"
```

USE THE EXISTING LIBRARY. Do not install a new one.
Study how the admin menu implements drag-and-drop and replicate that exact pattern.

### Card-level drag (reorder cards in the book)

- Drag handle: ⠿ icon in card header (3x2 grid of dots)
- Only draggable cards can be dragged (locked cards show a lock icon, no handle)
- Drag constraints: locked cards (Cover, Back) cannot be moved to a different position
- TocCard, ForewordCard, IndexCard CAN be moved but cannot go before Cover or after Back
- RecipeCards can be moved freely between non-locked boundary positions
- Visual feedback while dragging:
  - Dragged card: 90% opacity, subtle shadow
  - Drop target zone: dashed border in `#ce2b37`
  - Other cards shift smoothly with CSS transition

### Page-level drag (reorder pages within a recipe card)

- Only visible when card is expanded
- Drag handle on each page mini-card
- Pages stay within their parent recipe card
- Content pages (kind: 'content') can be reordered relative to other pages
- At least 1 content page must remain — cannot drag all content pages out

---

## "+ Add Recipes" flow

Clicking "+ Add Recipes" in the toolbar opens a panel (right sidebar or full-width overlay) showing the user's recipes:
- Same recipe grid as Step 1 of the existing wizard
- Already-added recipes shown with a checkmark (cannot be added twice)
- Click to add: creates a new `RecipeCard` with default pages and inserts it before the IndexCard
- Fetch recipes using existing query patterns from `@chefsbook/db`
- Images via `getPrimaryPhotos()` + `getRecipeImageUrl()` — NEVER `recipe.image_url`

---

## "Book Settings" panel

Opens a right sidebar with:
- Title (text input)
- Subtitle (text input, optional)
- Author name (text input)
- **Book language** (dropdown — see Language section below)
- Cover style (template picker)
- Cover image upload
- Print options (size, binding, paper, finish — from existing print options step)

Changes sync to the Cover card in the layout and to `printed_cookbooks` metadata columns.

---

## Language selection

The user can choose the language for all auto-generated text in the printed book.
This affects every label the template generates — section headers, card titles,
foreword label, TOC title, index title, timer prefix, metadata labels, and the
ChefsBook branding line on the back page.

**Supported languages** (matching ChefsBook's existing 5 locales):
- English (EN) — default
- French (FR) — Français
- Spanish (ES) — Español
- Italian (IT) — Italiano
- German (DE) — Deutsch

**Where it lives in the data model:**

Add `language` to `BookLayout` at the top level:

```typescript
export interface BookLayout {
  version: 1
  language: 'en' | 'fr' | 'es' | 'it' | 'de'  // default: 'en'
  cards: BookCard[]
}
```

Default to the user's current app language (read from their i18n preference) when
creating a new cookbook. The user can override it in Book Settings.

**Translation string table for PDF templates:**

React-pdf renders server-side — it cannot use react-i18next hooks. Create a static
string lookup at `apps/web/lib/pdf-templates/book-strings.ts`:

```typescript
export type BookLocale = 'en' | 'fr' | 'es' | 'it' | 'de'

export interface BookStrings {
  foreword: string        // "Foreword" / "Avant-propos" / "Prólogo" / "Prefazione" / "Vorwort"
  contents: string        // "Contents" / "Table des matières" / "Índice" / "Sommario" / "Inhalt"
  index: string           // "Index" / "Index" / "Índice" / "Indice" / "Register"
  ingredients: string     // "Ingredients" / "Ingrédients" / "Ingredientes" / "Ingredienti" / "Zutaten"
  steps: string           // "Steps" / "Étapes" / "Pasos" / "Procedimento" / "Zubereitung"
  notes: string           // "Notes" / "Notes" / "Notas" / "Note" / "Hinweise"
  servings: string        // "servings" / "portions" / "porciones" / "porzioni" / "Portionen"
  timerPrefix: string     // "⏱" (same across all — keep as emoji)
  createdWith: string     // "Created with ChefsBook" / "Créé avec ChefsBook" / etc.
  tagline: string         // "Your recipes, beautifully collected." (translated)
  pageLabel: string       // "Page" (for running footers, if needed)
}

export const BOOK_STRINGS: Record<BookLocale, BookStrings> = {
  en: {
    foreword: 'Foreword',
    contents: 'Contents',
    index: 'Index',
    ingredients: 'Ingredients',
    steps: 'Steps',
    notes: 'Notes',
    servings: 'servings',
    timerPrefix: '⏱',
    createdWith: 'Created with ChefsBook',
    tagline: 'Your recipes, beautifully collected.',
    pageLabel: 'Page',
  },
  fr: {
    foreword: 'Avant-propos',
    contents: 'Table des matières',
    index: 'Index',
    ingredients: 'Ingrédients',
    steps: 'Étapes',
    notes: 'Notes',
    servings: 'portions',
    timerPrefix: '⏱',
    createdWith: 'Créé avec ChefsBook',
    tagline: 'Vos recettes, magnifiquement rassemblées.',
    pageLabel: 'Page',
  },
  es: {
    foreword: 'Prólogo',
    contents: 'Índice',
    index: 'Índice',
    ingredients: 'Ingredientes',
    steps: 'Pasos',
    notes: 'Notas',
    servings: 'porciones',
    timerPrefix: '⏱',
    createdWith: 'Creado con ChefsBook',
    tagline: 'Tus recetas, bellamente reunidas.',
    pageLabel: 'Página',
  },
  it: {
    foreword: 'Prefazione',
    contents: 'Sommario',
    index: 'Indice',
    ingredients: 'Ingredienti',
    steps: 'Procedimento',
    notes: 'Note',
    servings: 'porzioni',
    timerPrefix: '⏱',
    createdWith: 'Creato con ChefsBook',
    tagline: 'Le tue ricette, meravigliosamente raccolte.',
    pageLabel: 'Pagina',
  },
  de: {
    foreword: 'Vorwort',
    contents: 'Inhalt',
    index: 'Register',
    ingredients: 'Zutaten',
    steps: 'Zubereitung',
    notes: 'Hinweise',
    servings: 'Portionen',
    timerPrefix: '⏱',
    createdWith: 'Erstellt mit ChefsBook',
    tagline: 'Deine Rezepte, wunderschön gesammelt.',
    pageLabel: 'Seite',
  },
}

export function getStrings(locale: BookLocale): BookStrings {
  return BOOK_STRINGS[locale] ?? BOOK_STRINGS['en']
}
```

**How templates use it:**

Every template receives the `language` from `book_layout.language` and calls
`getStrings(language)` to get its label set. No hardcoded English strings in template
code — all labels come from `BookStrings`.

```typescript
// In any template renderer:
const s = getStrings(options.language ?? 'en')
// Then use: s.ingredients, s.steps, s.foreword, etc.
```

**Language picker UI in Book Settings:**

```
Book language
┌─────────────────────────────┐
│ 🌐 English (EN)           ▾ │
└─────────────────────────────┘
  Options: English · Français · Español · Italiano · Deutsch
```

A simple select/dropdown. Changing language immediately updates the flipbook preview
(re-renders page content with new labels) so the user can see the effect before
generating the PDF.

**Flipbook language support:**

The `FlipbookPreview` component also uses `getStrings(language)` for its mini page
previews — the TOC page shows "Table des matières" if French is selected, the
content pages show "Ingrédients" and "Étapes", etc. This gives the user a true
preview of the final printed language.

**Note on recipe content:**

The language setting controls UI labels only — it does not translate recipe titles,
ingredient names, or step text. Those remain in the language the user wrote them in.
The assumption is users write their recipes in their preferred language already.

---

## "Generate PDF →" button

Top-right of the canvas. Triggers PDF generation using the existing pipeline.

Before generating, serialize `book_layout` into the format expected by the react-pdf templates:
- Extract `recipe_ids` from recipe cards in order
- Extract `selected_image_urls` from image pages
- Extract `foreword` from foreword card text
- Pass `cover_image_url` from cover card
- Pass `cover_style` from cover card

This means the existing PDF generation API routes work unchanged — the canvas
just assembles the input differently.

After generation, show: download link + "Order Printed Copy" button (links to existing checkout).

---

## State management

### Local state (React state — not Zustand)

The canvas manages `layout: BookLayout` in local React state using `useReducer`.
Actions: `MOVE_CARD`, `MOVE_PAGE`, `UPDATE_CARD`, `ADD_CARD`, `REMOVE_CARD`,
         `ADD_PAGE`, `REMOVE_PAGE`, `UPDATE_PAGE`

Use `useReducer` with a typed reducer function. Do not put book layout in Zustand —
it's local to this page and doesn't need to be shared.

### Auto-save

Auto-save to DB on every layout change using debounce (800ms):
```typescript
const debouncedSave = useDebouncedCallback(async (layout: BookLayout) => {
  await supabase
    .from('printed_cookbooks')
    .update({ book_layout: layout })
    .eq('id', cookbookId)
}, 800)
```

Show a "Saving..." / "Saved" indicator in the toolbar.

### Page map

`computePageMap(layout)` is called on every render — it's cheap (O(n)) and
produces the page numbers shown on each card and used in TOC/Index.

---

## API routes

### `POST /api/print-cookbook` — create a new cookbook
Creates a `printed_cookbooks` row with `book_layout` from `createDefaultLayout()`.
Returns the new cookbook ID. Redirects to `/dashboard/print-cookbook/[id]`.

### `PATCH /api/print-cookbook/[id]` — update layout
Accepts `{ book_layout: BookLayout }`. Updates `printed_cookbooks.book_layout`.
Also syncs derived columns: `recipe_ids`, `foreword`, `cover_image_url`.
Auth: verify session user owns the cookbook.

### `POST /api/print-cookbook/[id]/generate` — trigger PDF generation
Reads `book_layout`, assembles input for the react-pdf templates, calls the
existing PDF generation pipeline. Returns PDF URL.

These are NEW routes. The existing `/api/cookbooks/*` routes are UNCHANGED.

---

## Image upload for custom pages

Custom page images upload to:
`cookbook-pdfs/{user_id}/custom/{page_id}.jpg`

Use the existing Supabase Storage client pattern from `image-system.md`.
Max file size: 10MB. Accept: image/jpeg, image/png, image/webp.
Show upload progress indicator.

---

## Image print quality checking

**This is mandatory for every image used in the cookbook — recipe photos, cover image,
and custom page images. A user who orders a printed book with blurry photos will not
order again.**

### Print resolution requirements

Lulu prints at 300 DPI. The required pixel dimensions depend on how large the image
prints on the page:

| Usage | Print size | Minimum (150 DPI) | Recommended (300 DPI) |
|---|---|---|---|
| Full-bleed recipe photo | 8.5" × 5.5" | 1275 × 825 px | 2550 × 1650 px |
| Full-bleed cover image | 8.75" × 11.25" (with bleed) | 1313 × 1688 px | 2625 × 3375 px |
| Half-page photo (split layout) | 4.25" × 11" | 638 × 1650 px | 1275 × 3300 px |
| Custom page full image | 8.5" × 10.5" | 1275 × 1575 px | 2550 × 3150 px |
| Custom page half image (top) | 8.5" × 5.25" | 1275 × 788 px | 2550 × 1575 px |

### Quality tiers

```typescript
export type PrintQuality = 'great' | 'acceptable' | 'poor' | 'unknown'

export interface QualityResult {
  quality: PrintQuality
  widthPx: number
  heightPx: number
  effectiveDpi: number      // based on the larger dimension vs print size
  minimumNeededPx: { width: number; height: number }
  recommendedPx: { width: number; height: number }
  message: string           // human-readable, shown to user
  suggestion: string        // what to do about it
}

// Thresholds
// ≥ 300 DPI → 'great'   — "This photo will print crisply"
// 150–299 DPI → 'acceptable' — "This photo may appear slightly soft at print size"
// < 150 DPI → 'poor'    — "This photo is too low resolution for print quality results"
// Cannot determine → 'unknown'
```

### Quality check utility

Create `apps/web/lib/print-quality.ts`:

```typescript
export async function checkImagePrintQuality(
  imageUrl: string,
  printWidthInches: number,
  printHeightInches: number
): Promise<QualityResult> {
  // Load image in browser to get natural dimensions
  const { width, height } = await getImageDimensions(imageUrl)

  // Calculate effective DPI (use the more constrained dimension)
  const dpiW = width / printWidthInches
  const dpiH = height / printHeightInches
  const effectiveDpi = Math.min(dpiW, dpiH)

  const quality: PrintQuality =
    effectiveDpi >= 300 ? 'great' :
    effectiveDpi >= 150 ? 'acceptable' : 'poor'

  return {
    quality,
    widthPx: width,
    heightPx: height,
    effectiveDpi: Math.round(effectiveDpi),
    minimumNeededPx: {
      width: Math.ceil(printWidthInches * 150),
      height: Math.ceil(printHeightInches * 150),
    },
    recommendedPx: {
      width: Math.ceil(printWidthInches * 300),
      height: Math.ceil(printHeightInches * 300),
    },
    message: qualityMessage(quality, effectiveDpi),
    suggestion: qualitySuggestion(quality, width, height, printWidthInches, printHeightInches),
  }
}

async function getImageDimensions(url: string): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight })
    img.onerror = reject
    img.src = url
  })
}
```

**Pre-flight check in Opus:** Before implementing, check whether `recipe_user_photos`
already stores `width_px` / `height_px` columns. If so, use those instead of loading
the image (faster, works server-side). If not, note in the architecture proposal whether
adding those columns is worthwhile for performance.

### Where quality checks appear

**1. Recipe card image picker (canvas editor)**

When the user selects or changes a recipe photo, run the quality check immediately.
Show a badge on the selected image thumbnail:

```
┌──────────┐  ┌──────────┐  ┌──────────┐
│  🟢      │  │  🟡      │  │  🔴      │
│ [photo1] │  │ [photo2] │  │ [photo3] │
│ Print    │  │ Soft at  │  │ Too low  │
│ ready    │  │ print    │  │ res      │
└──────────┘  └──────────┘  └──────────┘
```

On selecting a 🟡 or 🔴 image, show an inline warning below the picker:

```
⚠️  This photo (640 × 480 px) may print soft.
    For crisp results, use at least 1275 × 825 px.
    [Upload a better photo]  [Use it anyway]
```

For 🔴 (poor):
```
🚫  This photo (320 × 240 px) is too low resolution for print.
    It will appear noticeably blurry in the printed book.
    Minimum needed: 1275 × 825 px.
    [Upload a better photo]
```

Note: for 🔴 quality, "Use it anyway" is NOT offered — we don't want users
accidentally printing blurry books. They must acknowledge by uploading or choosing
a different image.

**2. Cover image upload**

Cover images have the highest quality bar (largest print size).
Show quality indicator immediately after upload:

```
✅ Cover photo looks great (3024 × 4032 px · 346 DPI at print size)
```

or:

```
⚠️ Cover photo may print soft (1200 × 1600 px · 137 DPI at print size)
   For a crisp cover, upload a photo at least 2625 × 3375 px.
   [Replace photo]  [Keep this one]
```

**3. Custom page image upload**

Same inline check immediately after upload. For custom pages with the user's
own memories (family photos, etc.), we should be particularly gentle in the message —
they may not have a higher resolution version:

```
⚠️  This photo is 800 × 600 px. It may appear soft when printed.
    If you have a higher quality version of this photo, use that instead.
    [Replace photo]  [Keep it — I understand]
```

Allow "Keep it" for custom pages (sentimental photos deserve to be included even
if imperfect). The warning is still shown but not blocking.

**4. Pre-generate quality summary**

Before the user clicks "Generate PDF →", if any images are below 300 DPI, show
a summary warning in the Generate button area:

```
┌──────────────────────────────────────────────────────┐
│  ⚠️  3 photos may not print crisply                   │
│  • Burger Buns — photo 2 (soft at print size)         │
│  • Chimichurri — photo (soft at print size)           │
│  • Cover image (soft at print size)                   │
│                                                        │
│  [Review photos]          [Generate anyway →]         │
└──────────────────────────────────────────────────────┘
```

"Review photos" scrolls the canvas to the first affected card.
"Generate anyway" proceeds but adds a watermark-style note in the admin cost log
that quality warnings were overridden (for support purposes).

If ANY image is 🔴 (poor quality), "Generate anyway" is replaced with:
```
[Fix low-resolution photos first]
```
— generation is blocked until all 🔴 images are replaced or removed.

**5. Flipbook preview quality indicator**

In the flipbook, recipe photo pages with quality issues show a subtle badge
in the corner of the thumbnail strip:
- 🟡 small dot on the thumbnail = acceptable
- 🔴 small dot = poor (user should fix before printing)

### Quality check timing

- **On image selection** in the picker: check immediately (fast — just load image dims)
- **On upload**: check immediately as part of the upload success handler
- **On canvas load**: batch-check all currently selected images in the background
  (don't block the UI — fill in quality badges as results arrive)
- **On "Generate PDF" click**: re-validate all images synchronously before proceeding

### Storage of quality results

Cache quality results in component state — don't re-check the same URL repeatedly.
Use a `Map<imageUrl, QualityResult>` in the canvas state.

---

## Database verification before starting

Run these on RPi5 before writing any migration:

```bash
ssh rasp@rpi5-eth "psql postgresql://supabase_admin:<pw>@localhost:5432/postgres -c '\d printed_cookbooks'"
ssh rasp@rpi5-eth "psql postgresql://supabase_admin:<pw>@localhost:5432/postgres -c '\d printed_cookbook_orders'"
ssh rasp@rpi5-eth "psql postgresql://supabase_admin:<pw>@localhost:5432/postgres -c 'SELECT column_name, data_type FROM information_schema.columns WHERE table_name = '\''printed_cookbooks'\'' ORDER BY ordinal_position'"
```

Also check the current migration count:
```bash
ls supabase/migrations/ | tail -5
```

---

## Security

### RLS on printed_cookbooks
Confirm existing RLS allows users to read/write only their own cookbooks.
The new `book_layout` column inherits the existing table RLS.

### API route auth
Every API route must verify the user owns the cookbook:
```typescript
const { data: cookbook } = await supabase
  .from('printed_cookbooks')
  .select('user_id')
  .eq('id', id)
  .single()

if (cookbook.user_id !== session.user.id) {
  return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
}
```

---

## DO NOT CHANGE

- `apps/mobile/**` — zero mobile changes
- `apps/web/app/dashboard/print/**` — existing wizard stays intact
- `apps/web/app/api/cookbooks/**` — existing cookbook API routes unchanged
- `apps/web/lib/pdf-templates/**` — PDF templates unchanged (canvas calls them)
- Any admin page
- Any mobile component

If any of these files are in a diff, stop and reconsider.

---

---

## Template Architecture — Extensibility Layer

**OPUS MUST DESIGN THIS — do not assume any specific architecture.**

Six templates already exist: Trattoria, Studio, Garden, Heritage, Nordic, BBQ.
The template picker UI is already working. BBQ is the most recently built template.

### Pre-flight: understand what already exists

Before designing anything, fully audit the existing template system:

```bash
find apps/web/lib/pdf-templates apps/web/app -name "*.tsx" -o -name "*.ts" | \
  xargs grep -l "template\|Template\|cover_style\|trattoria\|studio\|garden\|bbq\|heritage\|nordic" 2>/dev/null

find apps/web -name "*.tsx" | xargs grep -l "Template Style\|templateStyle\|TemplateCard" 2>/dev/null

find apps/web/app/api -name "route.ts" | xargs grep -l "template\|cover_style" 2>/dev/null

grep -r "cover_style\|template_id\|templateId" apps/web --include="*.ts" --include="*.tsx" | head -30
```

Answer these questions from the code before writing anything:
1. How are templates currently stored? (hardcoded imports, registry, DB?)
2. How does `cover_style` flow from selection to PDF renderer?
3. What does BBQ's implementation look like vs Trattoria? What's shared?
4. Does any template config system already exist, or is each template bespoke?
5. How does the existing picker get its list of templates?
6. What would it take TODAY to add a 7th template? How many files need changing?

### What Opus must design (goals, not prescription)

After fully understanding the existing system, design an architecture that achieves:

**Goal 1 — Adding a template requires touching ONE place only.**
After this work, adding a new template = one file + one registry entry. Nothing else.

**Goal 2 — Admin can activate/deactivate templates without a deploy.**
A DB table controls which templates are visible. Admin toggles off → disappears immediately.

**Goal 3 — Admin can manage template metadata.**
Name, description, category (Classic, Holiday, Kids, BBQ, Seasonal), sort order,
premium flag, preview image — all editable by admin without touching code.

**Goal 4 — AI can generate new templates from inspiration images.**
Admin uploads photos of cookbook layouts → describes the mood → AI produces a new
template. Opus decides what "a template" is structured as so AI generation is possible
(JSON config driving a universal renderer, generated TypeScript, or other approach).

**Goal 5 — Template changes are additive, never breaking.**
Existing cookbooks using old template IDs still render correctly.
Generate route handles unknown/deprecated template IDs gracefully (fall back to Trattoria).

### What Opus must produce (in this order)

1. **Architecture proposal comment block** — at the top of the new registry/config file,
   write what approach was chosen, why it fits the existing code, what trade-offs were made.
   Required proof that Opus read the codebase before building.

2. **`cookbook_templates` DB migration** — with all 6 existing templates seeded.

3. **The extensibility layer** — whatever architecture Opus determines fits best.

4. **Admin UI** — `/admin/cookbook-templates` page:
   - List all templates (active/inactive) with preview images
   - Per template: toggle active/inactive, edit metadata, sort order, premium flag
   - "Generate New Template" button → AI generation flow
   - "Preview" button → sample PDF with test recipes

5. **AI template generation flow:**
   - Admin uploads 1–5 inspiration images + fills preferences form
   - System calls Claude via `@chefsbook/ai` — follow `ai-cost.md` MANDATORY
   - Use `claude-opus-4-6` (vision required)
   - Log every call to `ai_usage_log`
   - Claude produces whatever representation fits the architecture Opus chose
   - Preview generated immediately with test recipes
   - Admin tweaks → approves → template live

6. **Update the template picker** — reads from DB/registry so new templates appear
   automatically, grouped by category.

## Implementation phases — build in this order

### Phase 1: Foundation (no UI yet)
1. Apply DB migrations:
   - Add `book_layout` column to `printed_cookbooks`
   - Create `cookbook_templates` table with seed data for 3 built-in templates
2. Create `apps/web/lib/pdf-templates/config-types.ts` — `TemplateConfig` interface
3. Create `apps/web/lib/pdf-templates/registry.ts` — registration system
4. Create `apps/web/lib/pdf-templates/configurable-renderer.tsx` — JSON-driven renderer
5. Refactor existing `trattoria.tsx`, `studio.tsx`, `garden.tsx` to use registry + configs
6. Create `apps/web/lib/book-layout.ts` with all BookLayout types and helper functions
   - Update `cover_style` type from fixed enum to `string` (template ID)
7. Create API routes: POST, PATCH, generate, template list
8. Verify TypeScript compiles: `npx tsc --noEmit`
9. Add "Print My ChefsBook" nav item to sidebar (routes to placeholder page)

### Phase 2: Canvas shell
1. Create `/dashboard/print-cookbook/page.tsx` (list of cookbooks + "Start New")
2. Create `/dashboard/print-cookbook/[id]/page.tsx` (canvas wrapper)
3. Implement `useReducer` state management with all actions
4. Implement auto-save with debounce
5. Show static (non-draggable) card grid with correct card types

### Phase 3: Card components
Build each card component in isolation, verify visually before moving on:
1. `CoverCard` with edit panel
2. `ForewordCard` with inline textarea
3. `TocCard` (static, auto-computed content)
4. `RecipeCard` — collapsed and expanded states
5. `IndexCard` (static, auto-computed)
6. `BackCard` (locked, read-only)

### Phase 4: Drag and drop
1. Wrap canvas in drag context (using existing library)
2. Implement card-level drag with locked card constraints
3. Implement page-level drag within expanded recipe cards
4. Verify page numbers update on drag

### Phase 5: Recipe management
1. "+ Add Recipes" panel
2. Recipe card image picker (using `getPrimaryPhotos()`)
3. Custom page add/edit/delete
4. Display name inline editing

### Phase 6: Generate PDF
1. Wire "Generate PDF →" button to generate API route
2. Show progress and result
3. "Order Printed Copy" links to existing checkout

### Phase 7: Flipbook Preview

A "Preview Book ▶" button in the canvas toolbar opens a full-screen overlay showing
the book as an interactive flipbook with 3D CSS page-turn animation.

**Design requirements:**
- Page dimensions reflect the actual print size: 8.5" × 11" (196px × 254px at ~24% scale)
- A size badge shows "8.5 × 11 in · 24% scale · Letter / Lulu standard" above the book
- Dimension markers (bracket lines with labels) sit below and beside the spread
  confirming the physical dimensions to the user
- Two-page spread layout (left + right) with a visible spine between pages

**Page turn animation (CSS 3D):**
- Uses `transform-style: preserve-3d` and `perspective: 2800px` on the container
- Forward flip: right page folds left — `rotateY(0) → rotateY(-180deg)`, 
  `transform-origin: left center`, duration 0.65s `cubic-bezier(.645,.045,.355,1)`
- Backward flip: left page folds right — `rotateY(0) → rotateY(180deg)`,
  `transform-origin: right center`
- Each turning leaf has a front face and back face using `backface-visibility: hidden`
  - Front face: the page currently showing
  - Back face: `transform: rotateY(180deg)` — the next page to reveal
- A shadow overlay on the leaf animates opacity 0→1→0 for physical page-curl feel
- The underlying static pages update halfway through the animation (at 325ms)
- Keyboard ← → arrow keys supported

**Page content rendering:**
- Each page renders a mini version of its actual template content using the same
  colour scheme as the chosen template (Trattoria/Studio/Garden)
- Recipe photo pages: full-bleed emoji/image placeholder + title overlay
- Content pages: ingredient list + numbered steps with red step numbers and green timers
- TOC: live dotted-leader list computed from `computePageMap(layout)`
- Index: alphabetical listing computed from `computePageMap(layout)`
- Cover: template-matched preview (cream / dark / white based on cover_style)
- Custom pages: placeholder showing layout type (photo / text / both)
- Foreword: italic text preview
- Back: dark ChefsBook branded page (always)

**Thumbnail strip:**
- Row of small page thumbnails below the spread
- Active pages highlighted with red border
- Click any thumbnail to jump directly (no page-turn animation for distant jumps)

**Component location:** `apps/web/components/print/FlipbookPreview.tsx`
Opened as an overlay (not a modal — use a full-page div with high z-index)
from the canvas toolbar "Preview Book ▶" button.

**Performance note:** Flipbook is client-side only — reads from `layout` state,
no API calls. Renders fast even for 80-recipe books.

---

## Testing

### After Phase 1
```bash
npx tsc --noEmit  # must pass
psql: SELECT column_name FROM information_schema.columns WHERE table_name = 'printed_cookbooks';
# Must include: book_layout
```

### After Phase 3
- Visually verify each card renders correctly at `/dashboard/print-cookbook`
- Cover card edit panel saves to DB (verify via psql)
- Foreword card saves text to `book_layout.cards[foreword].text`

### After Phase 4
- Drag a recipe card — page numbers update
- Cannot drag Cover or Back cards
- Cannot drag recipe cards before Cover or after Back

### After Phase 6
- Generate PDF button works end-to-end
- Downloaded PDF matches layout order

### After Phase 7
- "Preview Book ▶" button opens flipbook overlay
- Page dimensions show correct 8.5"×11" size badge and dimension markers
- Forward page turn: right page folds left with 3D CSS animation
- Backward page turn: left page folds right correctly
- Keyboard ← → keys work throughout the preview
- TOC page shows live page numbers matching the canvas card order
- Dark pages (Studio template / back page) render correctly in the flipbook
- Thumbnail strip highlights the current spread
- Quality badges (🟢/🟡/🔴) appear on image thumbnails in the picker
- Selecting a 🔴 quality image blocks "Generate PDF" with a clear message
- Pre-generate quality summary lists all affected photos by name
- No console errors during page turns

### Regression smoke test (from testing.md)
Run the full regression checklist from `testing.md` before wrapup.
Confirm zero changes to mobile, admin, or existing wizard.

---

## Deploy

Follow `deployment.md`. Deploy web to RPi5 via `/mnt/chefsbook/deploy-staging.sh`.
After deployment: `curl -I https://chefsbk.app/dashboard/print-cookbook` must return 200.

---

## Wrapup

Follow `wrapup.md` fully. Session name: PRINT-BOOK-EDITOR.

Required proof:
1. `npx tsc --noEmit` passes
2. psql confirms `book_layout` column AND `cookbook_templates` table exist with 3 seed rows
3. Screenshot of canvas with at least 3 recipe cards visible
4. Screenshot of expanded recipe card showing page mini-cards
5. Drag working: before + after screenshot showing reorder
6. "Print My ChefsBook" nav item visible in sidebar
7. Flipbook opens from "Preview Book ▶" button — screenshot showing 3D page turn mid-animation
8. `/admin/cookbook-templates` page loads and lists the 3 built-in templates
9. Deactivating a template via admin removes it from the user-facing template picker
10. Regression smoke test: all items from testing.md checked

Update `feature-registry.md` with new feature entry.
Update `pdf-design.md` — note registry + configurable renderer pattern replaces per-file templates.
Log any incomplete phases in AGENDA.md with clear next steps.
