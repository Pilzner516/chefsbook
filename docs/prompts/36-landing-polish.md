# ChefsBook — Session 36: Landing Page Visual Polish
# Source: Design review after session 35 deployment
# Target: apps/web (landing page only)

---

## CONTEXT

Four visual polish items on the landing page identified from live review.
Read .claude/agents/ui-guardian.md before starting.
After changes, rebuild and restart PM2 on RPi5 — see deployment steps at end.

---

## FIX 1 — Chef's hat logo: higher resolution + larger size

### Problem
The chef's hat icon in the hero is blurry and too small.

### Fix
1. Find the highest resolution chef's hat asset available in the project
   (check `apps/mobile/assets/`, `apps/web/public/images/`).
2. If the existing PNG is under 512×512px, generate a new one:
   - Use the existing asset as reference
   - Export at minimum 512×512px, ideally 1024×1024px
   - Save to `apps/web/public/images/chefs-hat-hd.png`
3. In the hero section, update the image:
   - Switch src to the HD asset
   - Double the display size from current (if currently ~64px, make it 128px)
   - Add `image-rendering: crisp-edges` if using a pixel-art style icon
   - Use `object-fit: contain` — never stretch or distort
   - Add `2x` srcset if both sizes are available:
     ```html
     <img
       src="/images/chefs-hat-hd.png"
       srcSet="/images/chefs-hat-hd.png 2x"
       width={128}
       height={128}
       alt="ChefsBook"
     />
     ```

---

## FIX 2 — Feature cards: remove emoji icons, increase header size

### Problem
The emoji icons (📷, 📋, 🌍, 🤖) on the 4 feature cards look out of place and cheap.

### Fix
1. Remove ALL emoji icons from the feature card headers entirely — no replacement,
   just the text header.
2. Increase the card header font size:
   - Current: likely 18–20px
   - New: 22–24px, font-weight 600
   - Colour: keep existing dark text colour (not red — headers should be neutral)
3. Add a subtle left border accent instead of an icon to give the cards visual
   structure:
   ```css
   border-left: 3px solid #ce2b37;  /* pomodoro red */
   padding-left: 16px;
   ```
   Apply this to the card header only, not the entire card.
4. The feature list items (checkmarks + text) remain unchanged.

---

## FIX 3 — "How it works" steps: redesign as prominent cards

### Problem
The 4 steps are plain circles + text — visually weak and easy to scroll past.

### New design
Replace with 4 side-by-side cards, each with:

```
┌─────────────────────┐
│                     │
│   ①                 │  ← large step number, red circle, 48px
│                     │
│   Sign up           │  ← step title, 20px bold
│                     │
│   Free, takes       │  ← description, 14px grey
│   30 seconds.       │
│                     │
└─────────────────────┘
```

Card styling:
- White background (`#ffffff`)
- Rounded corners (`border-radius: 12px`)
- Subtle shadow: `box-shadow: 0 2px 12px rgba(0,0,0,0.08)`
- Padding: 32px
- Step number circle: 48px diameter, red background (`#ce2b37`), white text, 24px bold
- Step title: 20px, font-weight 600, dark text
- Description: 14px, `#6b7280` grey, line-height 1.6
- Cards sit on the cream background section (`#faf7f0`)

Layout:
- Desktop: 4 cards in a row with 24px gap
- Tablet (< 900px): 2×2 grid
- Mobile (< 600px): single column stack

Connector line between cards (desktop only):
- A thin horizontal dashed line (`border-top: 2px dashed #e5e7eb`) connecting the
  center of each step number circle
- Positioned behind the cards using z-index

Section background:
- Give this section a slightly different background to make it stand out:
  `background: #ffffff` (white) instead of the cream — creates a visual break
  between the features section (cream) and pricing section (cream)

---

## FIX 4 — Monthly/Annual toggle: fix alignment

### Problem
"Monthly", the toggle switch, and "Annual Save 20%" are not vertically aligned —
the toggle appears offset from the text labels.

### Fix
```css
.toggle-row {
  display: flex;
  align-items: center;  /* vertically center all three items */
  justify-content: center;
  gap: 12px;
  font-size: 15px;
}

.toggle-label {
  line-height: 1;  /* prevent line-height from pushing text off-center */
}

.save-badge {
  background: #009246;  /* basil green */
  color: white;
  font-size: 12px;
  font-weight: 600;
  padding: 2px 8px;
  border-radius: 12px;
  line-height: 1.4;
}
```

The toggle switch itself should have a fixed height (e.g. 24px) and be
`display: flex; align-items: center` internally so it sits at the same baseline
as the text labels.

---

## DEPLOYMENT

After all changes are made and verified locally, deploy to RPi5:

```bash
ssh rasp@rpi5-eth
cd /mnt/chefsbook/repo
git pull
cd apps/web
npm run build 2>&1 | tail -20
pm2 restart chefsbook-web
```

Confirm build succeeds (exit code 0) before restarting PM2.
If build fails, do NOT restart PM2 — the old version keeps serving.

---

## COMPLETION CHECKLIST

- [ ] Chef's hat uses HD asset at 128px display size, no blurriness
- [ ] Feature card emoji icons removed
- [ ] Feature card headers increased to 22-24px with red left border accent
- [ ] "How it works" redesigned as 4 white cards with large red step numbers
- [ ] Cards responsive: 4-col desktop, 2-col tablet, 1-col mobile
- [ ] Section background is white to create visual break
- [ ] Monthly/Annual toggle labels and switch vertically centered on same line
- [ ] "Save 20%" badge styled in basil green
- [ ] Deployed to RPi5 — chefsbk.app shows updated design
- [ ] Run /wrapup to update DONE.md and CLAUDE.md
