# ChefsBook Landing Page — Additional Image Prompts (concept-f)

Generate via Nano Banana / Ideogram / flux-dev. Save to `docs/landing-previews/images/` with the exact filenames below.

---

## Image 1 — `concept-f-dinner-table.jpg`

**Dimensions:** 1440 × 900

**Prompt:**
> Intimate dinner table scene overhead view, three white plates of pasta with red sauce, candles lit, warm evening light, linen napkins, wine glasses half full, shallow depth of field, editorial food photography, natural candlelight, professional food styling, warm golden tones, no people, high resolution, no text, no watermarks

**Intended use:** Final CTA full-bleed background (replaces `hero-c-warm-pasta.jpg` fallback in `.final-bg`). The warmer, more intimate dinner framing is meant to land the emotional close of the page.

---

## Image 2 — `concept-f-organized-kitchen.jpg`

**Dimensions:** 1200 × 800

**Prompt:**
> Beautifully organized kitchen counter, ceramic bowls of fresh vegetables, wooden cutting board with herbs, open recipe book, warm morning window light, Scandinavian minimal aesthetic, natural linen textures, pale wood surfaces, editorial lifestyle photography, shallow depth of field, no people, high resolution, no text, no watermarks

**Intended use:** Optional hero-side editorial accent or community card background. Anchors the "calm, organized home kitchen" mood that concept-f's moat pitch assumes.

---

## Image 3 — `concept-f-chaos-phones.jpg`

**Dimensions:** 1200 × 800

**Prompt:**
> Seven smartphone screens scattered on a white marble surface, each showing different apps, Instagram, browser tabs, notes app, screenshots of recipes, disorganized and overlapping, overhead flat lay, editorial lifestyle photography, natural window light, no people's faces, high resolution, no text on screens, no watermarks

**Intended use:** Future "problem we solve" section — visual shorthand for the fragmented status quo that ChefsBook consolidates. Pairs well with a future `.chaos` block above or below the Import magic moment.

---

## Generation notes

- flux-dev on Replicate accepts `aspect_ratio` (not `width`/`height`). Closest ratios:
  - 1440×900 → `16:10`
  - 1200×800 → `3:2`
- Cost: 3 × $0.025 ≈ $0.08 total on flux-dev
- Existing `scripts/generate-landing-images.mjs` can be adapted by appending these three entries to its `images` array; the 429 retry + 11s pacing is already in place for accounts with <$5 credit burst limits
