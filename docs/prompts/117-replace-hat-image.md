# ChefsBook — Session 117: Replace Chef Hat Image with CBHat.png
# Source: New cropped hat asset provided at docs/pics/CBHat.png
# Target: apps/web + apps/mobile

---

## CONTEXT

Read CLAUDE.md, DONE.md, feature-registry.md, and ALL mandatory agents
per SESSION START sequence before touching anything.

A new chef hat image has been provided at docs/pics/CBHat.png.
Replace all existing hat images across web and mobile with this asset.
The edges were cropped on the new image — verify display at all sizes.

---

## STEP 1 — Copy the new asset to all required locations

```bash
# Web — replace both standard and HD versions
cp docs/pics/CBHat.png apps/web/public/images/chefs-hat.png
cp docs/pics/CBHat.png apps/web/public/images/chefs-hat-hd.png

# Mobile — replace existing hat asset
cp docs/pics/CBHat.png apps/mobile/assets/images/chefs-hat.png
```

Verify the file copied correctly:
```bash
file docs/pics/CBHat.png
ls -lh apps/web/public/images/chefs-hat*.png
ls -lh apps/mobile/assets/images/chefs-hat.png
```

---

## STEP 2 — Find every reference to the hat image

Search the entire codebase for all hat image references:

```bash
grep -r "chefs-hat\|chef.*hat\|CBHat\|chef_hat" \
  apps/web/app apps/web/components apps/web/public \
  apps/mobile/app apps/mobile/components apps/mobile/assets \
  --include="*.tsx" --include="*.ts" --include="*.css" \
  --include="*.json" -l
```

For each file found, read it and confirm the image path is correct
and points to the new asset location.

---

## STEP 3 — Verify display properties at every usage

Since the new image has cropped edges, every usage must have:
- `object-fit: contain` (never cover, never fill) — ensures the full
  hat is always visible without clipping
- Adequate padding around the image container so the hat does not
  touch the edges of its container
- Fixed width and height that match the intended display size

Check these specific locations:

### Web
1. RecipeImage component (recipe cards fallback) — confirm contain + padding
2. Landing page hero — confirm hat is not clipped at top/bottom
3. Footer hat logo — confirm correct size + contain
4. Dashboard recipe grid/list/table fallback cards
5. Any other location found in Step 2

### Mobile
1. RecipeImage component (recipe card fallback) — confirm contain + padding
2. Landing/auth screen hat — confirm full hat visible
3. Any other location found in Step 2

For each location, if object-fit or sizing is wrong, fix it.

---

## STEP 4 — Verify the asset loads correctly

Web:
```bash
# On RPi5 after deploy
curl -I https://chefsbk.app/images/chefs-hat.png
curl -I https://chefsbk.app/images/chefs-hat-hd.png
# Both must return HTTP 200
```

Mobile:
- Take an ADB screenshot showing a recipe card that uses the hat fallback
- Confirm the hat is fully visible, not clipped, properly centered
- Delete screenshot after capture:
  Remove-Item /tmp/cb_screen.png -Force

---

## STEP 5 — Deploy to RPi5

```bash
ssh rasp@rpi5-eth
cd /mnt/chefsbook/repo
git pull
cd apps/web
rm -rf node_modules/react node_modules/react-dom .next
NODE_OPTIONS=--max-old-space-size=1024 npm run build 2>&1 | tail -20
pm2 restart chefsbook-web
```

Only restart PM2 if build exits with code 0.

---

## COMPLETION CHECKLIST

- [ ] CBHat.png copied to all 3 asset locations (web standard, web HD, mobile)
- [ ] All hat image references found in codebase
- [ ] object-fit: contain confirmed at every usage
- [ ] Adequate padding so hat does not touch container edges
- [ ] Web: /images/chefs-hat.png returns HTTP 200 on RPi5
- [ ] Web: /images/chefs-hat-hd.png returns HTTP 200 on RPi5
- [ ] Mobile: ADB screenshot confirms hat fully visible, not clipped
- [ ] Landing page hero hat looks correct
- [ ] Recipe card fallback hat looks correct
- [ ] tsc --noEmit passes both apps
- [ ] Deployed to RPi5
- [ ] Run /wrapup
- [ ] At the end of the session, recap exactly what was completed from
      this prompt, what was left incomplete, and why.
