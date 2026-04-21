# ChefsBook — Session 164: Fix Watermark Badge Text + Hat Icon
# Source: Watermark badge has wrong text spacing and wrong hat icon
# Target: scripts/create-watermark-badge.mjs + scripts/apply-watermarks.mjs

---

## CONTEXT

Read CLAUDE.md and DONE.md before starting.

The watermark badge has two issues:
1. Text reads "Chefs book" (with a space) — must be "ChefsBook" (no space,
   capital B, exactly matching the brand logo)
2. The chef hat icon looks wrong — needs to match the actual ChefsBook
   hat icon style

The watermark IS appearing on images (confirmed by opening raw image
in new tab) but is hidden by CSS object-fit: cover on the recipe page.
The text and icon need to be corrected before re-applying.

---

## STEP 1 — Fix the badge text

The correct brand name is "ChefsBook" — one word, capital C, capital B.

In scripts/create-watermark-badge.mjs, find the SVG text elements.
Currently it has two separate text elements: "Chefs" and "book".

Replace with a single text element using tspan for color:

```svg
<text x="14" y="24"
  font-family="Arial, Helvetica, sans-serif"
  font-size="16"
  font-weight="700">
  <tspan fill="#ce2b37">Chefs</tspan><tspan fill="#1a1a1a">Book</tspan>
</text>
```

Note: NO space between tspan elements — they must render as one
continuous word "ChefsBook" with no gap.

---

## STEP 2 — Fix the chef hat icon

The current hat icon is drawn with basic ellipses and rectangles.
It needs to look like a proper chef's toque (tall chef hat).

Replace the hat SVG path with this clean toque shape:

```svg
<!-- Chef hat (toque) icon — clean minimal style -->
<g transform="translate(185, 9)">
  <!-- Hat brim/band -->
  <rect x="0" y="26" width="44" height="10" rx="2"
    fill="#ce2b37"/>
  <!-- Hat body (white puff) -->
  <rect x="4" y="6" width="36" height="22" rx="2"
    fill="white" stroke="#ce2b37" stroke-width="2"/>
  <!-- Top puff (rounded) -->
  <ellipse cx="22" cy="8" rx="18" ry="10"
    fill="white" stroke="#ce2b37" stroke-width="2"/>
</g>
```

Adjust the overall SVG width to accommodate the new layout:
- "ChefsBook" text: ~110px
- Gap: 12px
- Hat icon: ~50px
- Padding: 14px each side
- Total width: ~200px

Update SVG width to 200, keep height at 54.

---

## STEP 3 — Verify badge before applying

After updating the SVG in create-watermark-badge.mjs:

```bash
# Regenerate badge
node scripts/create-watermark-badge.mjs

# Verify dimensions
node -e "
import sharp from 'sharp'
const m = await sharp('apps/web/public/images/watermark-chefsbook.png').metadata()
console.log('Size:', m.width, 'x', m.height)
" --input-type=module

# Open the badge PNG visually — describe what you see
# The badge must show: white pill, "ChefsBook" (no space),
# red "Chefs" + black "Book", chef hat icon on the right
```

Do NOT proceed to apply-watermarks.mjs until the badge text
is confirmed correct ("ChefsBook" with no space, capital B).

---

## STEP 4 — Re-apply watermarks to all AI images

```bash
ssh rasp@rpi5-eth
cd /mnt/chefsbook/repo
git pull
export SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiAiSFMyNTYiLCAidHlwIjogIkpXVCJ9.eyJyb2xlIjogInNlcnZpY2Vfcm9sZSIsICJpc3MiOiAic3VwYWJhc2UiLCAiaWF0IjogMTc1MTAwMDAwMCwgImV4cCI6IDE5MDg3NjY0MDB9.d0A4kE4okczvSWbLw9WxzVr9sr2AMdzh09Lnu7T1eXQ
node scripts/apply-watermarks.mjs
```

---

## STEP 5 — Verify on a real image

After apply-watermarks.mjs completes:
1. Open any recipe with an AI image
2. Right-click the image → "Open image in new tab"
3. Zoom to bottom-right corner
4. Confirm: white pill badge, "ChefsBook" (no space, capital B),
   chef hat icon, clearly readable

---

## STEP 6 — Consider badge position

The badge is currently bottom-right but gets clipped by CSS
object-fit: cover on the recipe detail page.

Change badge position to bottom-LEFT instead:
- Bottom-left is less likely to be cropped
- Still clearly visible and branded

In scripts/apply-watermarks.mjs, change:
```javascript
// Current (bottom-right)
const left = width - watermarkMeta.width - 12
const top = height - watermarkMeta.height - 12

// Change to bottom-left
const left = 12
const top = height - watermarkMeta.height - 12
```

Also update generate-recipe-images.mjs to use bottom-left positioning.

---

## DEPLOYMENT

Commit the updated scripts and badge PNG:
```bash
git add scripts/create-watermark-badge.mjs
git add scripts/apply-watermarks.mjs
git add apps/web/public/images/watermark-chefsbook.png
git commit -m "fix: watermark badge text ChefsBook (no space) + improved hat icon + bottom-left position"
git push
```

No server restart needed — scripts run on RPi5 directly.

---

## COMPLETION CHECKLIST

- [ ] Badge text fixed: "ChefsBook" (no space, capital B)
- [ ] "Chefs" in red (#ce2b37), "Book" in black (#1a1a1a), no gap
- [ ] Chef hat icon updated to clean toque style
- [ ] Badge PNG verified: correct text and icon before applying
- [ ] apply-watermarks.mjs re-run on RPi5
- [ ] Badge position changed to bottom-LEFT (avoids CSS cropping)
- [ ] Raw image opened in new tab: badge visible bottom-left
- [ ] Text reads "ChefsBook" with no space confirmed
- [ ] generate-recipe-images.mjs also updated to bottom-left
- [ ] Scripts committed and pushed
- [ ] Run /wrapup
- [ ] At the end: describe exactly what the badge looks like
      (text, colors, position, hat style)
