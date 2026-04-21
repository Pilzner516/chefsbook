# Prompt C — Recipe Image Lightbox Gallery
## Scope: apps/web only. Recipe detail page image viewer.

---

## AGENTS TO READ FIRST (in order)
1. `.claude/agents/wrapup.md`
2. `CLAUDE.md`
3. `DONE.md`
4. `.claude/agents/testing.md`
5. `.claude/agents/feature-registry.md`
6. `.claude/agents/deployment.md`
7. `.claude/agents/ui-guardian.md`
8. `.claude/agents/image-system.md`

Run ALL pre-flight checklists before writing a single line of code.
Inspect the recipe detail page component before touching anything:
`apps/web/app/recipe/[id]/page.tsx`

---

## OBJECTIVE

Add a lightbox gallery to the recipe detail page. When the user clicks the hero/main recipe
image, a full-screen modal opens showing the image at full size. The user can navigate
through all images for that recipe using arrows, keyboard, or swipe.

This is a pure UI feature — no API calls, no schema changes, no AI. All images are
already loaded on the recipe detail page.

---

## BEHAVIOUR SPEC

### Opening the lightbox
- Clicking the **hero/main image** opens the lightbox.
- The lightbox always opens at the **first image** (index 0 — the current hero/main image),
  regardless of which thumbnail is showing in the strip.
- The existing thumbnail strip does NOT open the lightbox — thumbnails continue to work
  as they do today (switching the hero image). Do not change existing thumbnail behaviour.

### Navigation
- **Left arrow button** — previous image (wraps from first → last)
- **Right arrow button** — next image (wraps from last → first)
- **Keyboard**: `ArrowLeft` / `ArrowRight` to navigate, `Escape` to close
- **Touch swipe**: swipe left to go forward, swipe right to go back
  - Minimum swipe distance: 50px horizontal movement before triggering
  - Ignore swipes that are more vertical than horizontal

### Closing
- **X button** — top-right corner of the lightbox
- **Click outside** the image (on the dark overlay) closes the lightbox
- **Escape key** closes the lightbox

### Image counter
- Show `{current} / {total}` centred below the image
- Example: `2 / 5`
- Only show if there are 2 or more images. Hide if there is only 1 image.

### Arrow button visibility
- Only show left/right arrows if there are 2 or more images
- Hide both arrows if there is only 1 image

---

## VISUAL DESIGN

Follow the Trattoria design system:
- Background overlay: `rgba(0, 0, 0, 0.92)` — near-black, not pure black
- The lightbox is full-screen (fixed, z-index above everything)
- Image: centred, `max-height: 90vh`, `max-width: 90vw`, `object-fit: contain`
  (never stretch or crop — show the whole image)
- Image has a subtle drop shadow

**X close button** (top-right):
- Position: `fixed` top-right, inside the overlay, clearly visible
- White icon on dark background, 40×40px tap target
- Use a standard × or X icon consistent with other modals in the app
- Check what close icon pattern is used in existing modals (e.g. ChefsDialog) and match it

**Arrow buttons** (left and right):
- Vertically centred on the image
- White circular buttons with dark semi-transparent background
- Large enough tap target (48×48px minimum)
- Left arrow: `←` or chevron-left icon
- Right arrow: `→` or chevron-right icon
- Consistent with icon library already in use in the project

**Image counter**:
- White text, small (`text-sm`), centred below the image
- Subtle — not bold, not prominent

**Cursor**:
- Hero image should show `cursor-zoom-in` to signal it is clickable
- Inside the lightbox overlay (outside the image): `cursor-default`

---

## IMPLEMENTATION NOTES

### Component
Create a new component: `apps/web/components/RecipeLightbox.tsx`

Props:
```typescript
interface RecipeLightboxProps {
  images: string[];        // array of image URLs, index 0 = hero/main
  isOpen: boolean;
  onClose: () => void;
}
```

Manage the current index with `useState(0)`. Reset to 0 whenever `isOpen` changes
from false to true.

### Wiring into the recipe detail page
In `apps/web/app/recipe/[id]/page.tsx`:
- Add `lightboxOpen` state (boolean, default false)
- Wrap the existing hero image in a `<button>` or add an `onClick` handler
- Pass the full images array to `RecipeLightbox`
- Render `<RecipeLightbox>` at the bottom of the page component

### Image array
The recipe detail page already has the images loaded. Identify where the hero image
and additional user photos are stored in the component's state/data. Build the array
as: `[heroImage, ...otherImages]` deduplicated. If the recipe has only the AI-generated
or scraped image and no user photos, the array has 1 item — lightbox still opens but
arrows and counter are hidden.

### Keyboard handler
Use `useEffect` with `addEventListener('keydown', ...)` inside `RecipeLightbox`.
Only attach the listener when `isOpen === true`. Clean up on unmount and when
`isOpen` becomes false.

### Swipe handler
Implement with `onTouchStart` / `onTouchEnd` on the overlay div.
Track `touchStartX` in a ref. On `touchEnd`, calculate delta.
If `Math.abs(deltaX) > 50` AND `Math.abs(deltaX) > Math.abs(deltaY)`:
  - deltaX < 0 → next image
  - deltaX > 0 → previous image

### Body scroll lock
When lightbox opens: `document.body.style.overflow = 'hidden'`
When lightbox closes: `document.body.style.overflow = ''`
Clean up in the `useEffect` return.

### Image loading
The images are already proxied through `/api/image?url=` for Supabase storage URLs
(see CLAUDE.md — Kong returns 401 without apikey header; the proxy handles this).
Use the same URL format that the existing hero image uses — do not construct raw
Supabase URLs.

---

## IMPLEMENTATION ORDER

1. Create `apps/web/components/RecipeLightbox.tsx`
2. Wire into `apps/web/app/recipe/[id]/page.tsx` — add state, onClick on hero, render component
3. TypeScript check: `cd apps/web && npx tsc --noEmit` — must be clean
4. Deploy per `deployment.md`

---

## GUARDRAILS

- Do NOT change thumbnail strip behaviour — thumbnails still switch the hero image as today.
- Do NOT add lightbox to the thumbnail strip clicks.
- Do NOT make any API calls from this component.
- Do NOT change how images are fetched or stored.
- The lightbox must not interfere with the existing "Change image" hover popup or the
  image generation controls — check for z-index conflicts.
- Use `createPortal` (render into `document.body`) if z-index stacking context causes
  the lightbox to be obscured by other fixed elements on the recipe detail page.

---

## TESTING REQUIREMENTS

Before marking done, verify in the browser:

1. Click hero image → lightbox opens showing the hero image
2. If recipe has multiple images: left/right arrows navigate through them, counter updates
3. If recipe has 1 image: no arrows, no counter
4. Keyboard: ArrowRight advances, ArrowLeft goes back, Escape closes
5. Click outside image (on dark overlay) closes lightbox
6. X button closes lightbox
7. Body scroll is locked while lightbox is open, restored on close
8. Swipe left/right navigates on a touch device or browser devtools mobile emulator
9. `cursor-zoom-in` visible on hero image hover

Provide browser verification notes (or screenshot) for items 1–4.

---

## WRAPUP REQUIREMENT

DONE.md entry must include:
- New component file path
- Lines changed in recipe/[id]/page.tsx
- tsc clean confirmed
- Deploy confirmed (chefsbk.app recipe detail — lightbox opens on hero image click)
- Confirmation that thumbnail strip behaviour is unchanged
