# ChefsBook — Session 180: Fix Watermark Badge Logo
# Target: scripts/create-watermark-badge.mjs, scripts/apply-watermarks.mjs

---

## CONTEXT

Read CLAUDE.md, DONE.md, .claude/agents/testing.md, and .claude/agents/deployment.md
before starting. Run all pre-flight checklists.

The watermark badge on AI-generated recipe images uses a hand-drawn SVG chef's hat
that does not match the real ChefsBook logo. Every previous fix attempt tweaked the
SVG geometry and failed. The correct asset already exists at docs/pics/cb_plus_hat.png.
This session replaces the SVG drawing with the real PNG. Nothing else changes.

---

## PART 1 — Confirm the asset exists

```bash
ls -la docs/pics/cb_plus_hat.png
file docs/pics/cb_plus_hat.png
```

Must confirm the file exists and is a valid PNG before touching any code.
If the file is missing, stop immediately and report — do not proceed.

---

## PART 2 — Copy asset to scripts folder

```bash
cp docs/pics/cb_plus_hat.png scripts/chefs-hat.png
ls -la scripts/chefs-hat.png
```

---

## PART 3 — Rewrite create-watermark-badge.mjs

Replace the entire hat-drawing section with a sharp composite using the real PNG.
The "Chefs" (red) + "Book" (black) text treatment stays unchanged.
Only the hat sourcing changes — from SVG geometry to the real asset file.

Full replacement implementation:

```js
import sharp from 'sharp'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

const BADGE_WIDTH = 200
const BADGE_HEIGHT = 46
const HAT_SIZE = 32
const PADDING = 10

async function createWatermarkBadge(outputPath) {
  // Load and resize the real logo asset
  const hatBuffer = await sharp(path.join(__dirname, 'chefs-hat.png'))
    .resize(HAT_SIZE, HAT_SIZE, {
      fit: 'contain',
      background: { r: 255, g: 255, b: 255, a: 0 }
    })
    .png()
    .toBuffer()

  // White pill background
  const bg = await sharp({
    create: {
      width: BADGE_WIDTH,
      height: BADGE_HEIGHT,
      channels: 4,
      background: { r: 255, g: 255, b: 255, a: 240 }
    }
  })
  .composite([{
    input: hatBuffer,
    left: BADGE_WIDTH - HAT_SIZE - PADDING,
    top: Math.floor((BADGE_HEIGHT - HAT_SIZE) / 2)
  }])
  .png()
  .toBuffer()

  // "Chefs" (red) + "Book" (black) text overlay
  const textSvg = `
    <svg width="${BADGE_WIDTH}" height="${BADGE_HEIGHT}">
      <text x="${PADDING}" y="${Math.floor(BADGE_HEIGHT / 2) + 6}"
            font-family="Arial, sans-serif" font-size="18" font-weight="bold">
        <tspan fill="#ce2b37">Chefs</tspan><tspan fill="#1a1a1a">Book</tspan>
      </text>
    </svg>`

  await sharp(bg)
    .composite([{ input: Buffer.from(textSvg), top: 0, left: 0 }])
    .png()
    .toFile(outputPath)
}

export { createWatermarkBadge }
```

After rewriting, run it locally to confirm it produces a valid PNG before
touching any images on RPi5:

```bash
node scripts/create-watermark-badge.mjs
ls -la scripts/watermark-badge.png
# Must produce a non-zero PNG file
```

---

## PART 4 — Re-run apply-watermarks.mjs on RPi5

```bash
ssh rasp@rpi5-eth
cd /mnt/chefsbook/repo
git pull
# Confirm the new scripts/chefs-hat.png is present on the Pi
ls -la scripts/chefs-hat.png
node scripts/apply-watermarks.mjs 2>&1 | tail -20
```

All images must process with 0 failures. If any fail, report the error
before continuing — do not deploy.

---

## PART 5 — Visual verification

Pull an image URL from the DB and open it:

```bash
psql $DATABASE_URL -c "
  SELECT image_url FROM recipe_user_photos
  WHERE source = 'ai_generated'
  ORDER BY created_at DESC
  LIMIT 1;
"
```

Open the URL in a browser. The badge must show:
- The cb_plus_hat.png logo exactly — not a geometric approximation
- "Chefs" in red (#ce2b37), "Book" in near-black
- Positioned bottom-left of the image

If the hat still looks wrong, stop and report — do not mark complete.

---

## PART 6 — Lock in CLAUDE.md to prevent regression

Add the following note to CLAUDE.md under the watermark / image generation section:

```
Watermark badge: ALWAYS use scripts/chefs-hat.png (source: docs/pics/cb_plus_hat.png).
NEVER redraw the chef's hat as SVG geometry — every attempt has produced the wrong result.
If scripts/chefs-hat.png is missing, copy from docs/pics/cb_plus_hat.png before proceeding.
```

---

## COMPLETION CHECKLIST

- [ ] docs/pics/cb_plus_hat.png confirmed present and valid PNG
- [ ] Copied to scripts/chefs-hat.png
- [ ] create-watermark-badge.mjs uses sharp composite with real PNG — zero SVG hat geometry
- [ ] Local test: node scripts/create-watermark-badge.mjs produces valid PNG
- [ ] apply-watermarks.mjs re-run on RPi5 — all images updated, 0 failures
- [ ] Visual check: badge shows cb_plus_hat.png logo exactly as intended
- [ ] CLAUDE.md updated with lock note
- [ ] Run /wrapup to update DONE.md and CLAUDE.md
