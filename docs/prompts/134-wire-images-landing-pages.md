# ChefsBook — Session 134: Wire All Generated Images into Landing Page Concepts
# Source: 26 images generated in session 133, only 2 used in concept-c
# Target: docs/landing-previews/ (all 3 concept HTML files)

---

## CONTEXT

Read docs/landing-previews/image-prompts.md to understand which image
goes where in each concept. Then read all 3 concept HTML files fully.

26 images exist in docs/landing-previews/images/. Only 2 are currently
used. Wire ALL relevant images into all 3 concepts to make them
visually rich and compelling.

---

## STEP 1 — Inventory available images

List all files in docs/landing-previews/images/ and cross-reference
with image-prompts.md to understand what each image shows and which
concept/section it belongs to.

---

## STEP 2 — Update concept-c.html (warm lifestyle)

This concept is food-photography led. Wire in ALL food and lifestyle
images:

- Hero section: use the warmest, most appetizing food image as full
  background or large featured image
- "Import Anywhere" section: show a phone-in-kitchen image
- "Plan Your Week" section: show an organized kitchen or meal prep image
- "Shop Smarter" section: show grocery/produce image
- "Cook Together" section: show a cooking/hands image
- Testimonial section: use food close-up images as decorative accents
- Final CTA: use a beautiful plated dish image

Each image should be sized appropriately:
- Hero: full width, 100vh height, object-fit cover with overlay for text
- Section images: 50% width alongside text, or full-width with padding
- Decorative: smaller, rounded corners

---

## STEP 3 — Update concept-a.html (clean editorial)

This was CSS-only. Add images tastefully:

- Hero: one clean editorial food image (overhead shot, light surfaces)
  as a right-side composition alongside the headline text
- "The Chaos" section: small scattered thumbnails of the food images
  representing the fragmented sources
- "Product Showcase" section: food images as context behind product UI
- Keep the clean Trattoria aesthetic — images should have light, airy feel

---

## STEP 4 — Update concept-b.html (dark premium)

This was CSS-only with dramatic CSS effects. Add images with dark
treatment:

- Hero: dark, moody food image (cast iron, dark marble surfaces)
  with a dark overlay (rgba 0,0,0,0.6) to maintain readability
- "The System" section: use close-up ingredient images with dark
  color treatment (CSS filter: brightness(0.4) or similar)
- Keep the near-black premium aesthetic — images must work WITH
  the dark palette, not against it

Use CSS filters to darken/mood images to match concept B palette:
```css
.dark-image {
  filter: brightness(0.5) contrast(1.2) saturate(0.8);
}
```

---

## STEP 5 — Verify all concepts

Serve from the same python http.server and confirm:
- All images load (no broken image icons)
- Images enhance rather than clash with each concept's design
- Text remains readable over any image backgrounds
- Concepts still look distinct from each other
- Responsive layout not broken by added images

---

## RULES

- All image paths must be relative: `images/filename.jpg`
- All images must have alt text
- Hero images used as backgrounds need overlay divs for text contrast
- Never stretch images — use object-fit: cover or contain
- Images must not break the mobile layout

---

## COMPLETION CHECKLIST

- [ ] All 26 images inventoried and mapped to sections
- [ ] concept-c.html: 8+ images wired across all sections
- [ ] concept-a.html: 4+ images added tastefully
- [ ] concept-b.html: 3+ images added with dark treatment
- [ ] No broken image paths in any concept
- [ ] Text remains readable over all image backgrounds
- [ ] Mobile layout intact on all 3 concepts
- [ ] All 3 concepts visually distinct from each other
- [ ] Run /wrapup
- [ ] At the end of the session, recap how many images are now used
      in each concept and describe the overall visual improvement.
