# ChefsBook — Landing Page Redesign: World-Class Consumer Brand
# Source: Design brief in docs/prompts/landing-page-brief.md
# Output: docs/landing-previews/ (3 standalone HTML files)
# Target: apps/web (for future integration — build standalone first)

---

## CONTEXT

Read CLAUDE.md and DONE.md to understand what ChefsBook is and what
features exist. Do NOT read other agents — this is a design/frontend
session only.

You are producing 3 standalone HTML landing page concepts for review.
These are PREVIEW files only — they do not replace the live site.
Save all output to docs/landing-previews/:
- docs/landing-previews/concept-a.html
- docs/landing-previews/concept-b.html
- docs/landing-previews/concept-c.html

Each file must be completely self-contained (inline CSS + JS, no
external dependencies except CDN fonts and optionally Framer Motion
via CDN). They must open directly in a browser with no build step.

---

## BRAND CONSTRAINTS (non-negotiable)

These must be respected across all 3 concepts:

### Colors
Each concept may choose ONE of two palette approaches:

PALETTE A — Existing Trattoria (safe, drop-in compatible):
- Background: #faf7f0 (cream)
- Primary accent: #ce2b37 (pomodoro red)
- Green accent: #009246 (basil green)
- Text: #1a1a1a

PALETTE B — Premium Evolution (darker, more refined):
- Background: #faf7f0 (keep the warm cream — it works)
- Primary accent: #9F2D24 (deep garnet red — more premium)
- Green accent: #2D6A4F (deeper basil)
- Text: #1a1a1a

Concept A → use Palette A
Concept B → use Palette B
Concept C → your creative choice between A or B

### Typography
Use Google Fonts via CDN. Suggested pairings:
- Playfair Display (serif) + Inter (sans) — editorial premium
- Fraunces (serif) + DM Sans — warm modern
- Cormorant Garamond + Plus Jakarta Sans — luxury editorial

### What ChefsBook actually does (use real features):
- Import recipes from ANY URL, Instagram, YouTube, scan photos,
  speak aloud, upload PDF/Word files, ISBN barcode scan
- AI meal planning wizard (generates a full week)
- Smart shopping lists (grouped by store, department, AI purchase units)
- 5 languages (English, French, Spanish, Italian, German)
- Family sharing (up to 6 members)
- Follow other cooks, comment, like recipes
- Browser extension for one-click import
- Works offline (mobile)
- Free plan available

### Pricing tiers (real):
- Free — view and save recipes
- Chef — $4.99/mo — full features
- Family — $9.99/mo — up to 6 members
- Pro — $14.99/mo — all features + priority support

### Links that must work:
- "Start Free" → /auth
- "Sign in" → /auth
- "Download extension" → /extension
- "Privacy Policy" → /privacy
- Pricing CTAs → /dashboard/plans

---

## THREE CONCEPT DIRECTIONS

### CONCEPT A — "The Unified Kitchen"
Positioning: ChefsBook as the single place that ends cooking fragmentation.

Hero headline options:
- "Cooking is scattered across 7 apps. ChefsBook puts it all in one place."
- "From saved recipe to dinner plan — finally connected."

Key sections:
1. Hero — bold headline, product mockup staged in device frame, Start Free CTA
2. The Chaos — show 6-7 fragmentation sources (Instagram, tabs, screenshots,
   cookbooks, notes, memory) as a visual scatter that resolves into ChefsBook
3. The Workflow — Import → Organize → Plan → Shop → Cook → Share as an
   elegant connected flow (not a features grid)
4. Product Showcase — 3 signature moments: import from anywhere,
   AI meal plan generation, smart shopping list
5. Emotional Benefits — outcomes, not features (calmer evenings,
   less decision fatigue, fewer wasted ingredients)
6. Social proof — placeholder testimonials, "Loved by home cooks in 5 languages"
7. Pricing — clean 4-tier cards, Chef highlighted as Most Popular
8. Final CTA — "Bring order to everything you cook."

Visual approach:
- Clean, spacious, editorial
- Product UI shown in floating card compositions
- Subtle fade-in animations on scroll
- Mobile-first responsive

---

### CONCEPT B — "The Operating System for Modern Cooking"
Positioning: ChefsBook as infrastructure, not just an app.

Hero headline:
- "The Operating System for Modern Cooking."
- Subhead: "Import, organize, plan, shop, and share — all in one intelligent system."

Key sections:
1. Hero — dark premium hero (dark cream/charcoal bg), large confident
   typography, subtle product glow/depth effect
2. Problem Statement — stark, minimal: "You save recipes in 7 places.
   You remember nothing. Dinner is still stressful." Pure typography section.
3. The System — cinematic visualization of ChefsBook as a connected
   ecosystem. Six nodes (Import, Organize, Plan, Shop, Cook, Share) connected
   by elegant lines, each expanding to show a product moment
4. Intelligence Layer — showcase AI features: meal planning wizard,
   smart purchase units, recipe moderation, dish identification from photo
5. For Every Kitchen — show 3 user types: Solo Cook, Busy Family,
   Food Enthusiast. Each with their specific workflow
6. Global — multilingual capability: "Your recipes. Your language.
   5 languages, one beautiful app."
7. Pricing — minimal, confident
8. Final CTA — "One system. Every meal."

Visual approach:
- Darker, moodier premium feel
- Bold typography as the primary design element
- Minimal imagery
- Product shown as glowing UI fragments
- More animation/motion

---

### CONCEPT C — "Beautiful Food. Organized Life."
Positioning: Lifestyle and warmth over technology.

Hero headline:
- "Beautiful food. Organized life."
- "The recipe app that actually understands how you cook."

Key sections:
1. Hero — warm, appetizing food photography as hero background (use
   high-quality Unsplash food images via CDN), headline overlaid with
   elegant typography, very warm and inviting
2. Import Anywhere — "Spotted something delicious? Save it in seconds."
   Show all import methods as gentle icons with brief descriptions
3. Plan Your Week — "Stop staring at the fridge wondering what's for dinner."
   Show the meal planning calendar
4. Shop Smarter — "Your shopping list, sorted by aisle, ready to go."
   Show the shopping list grouped by store
5. Cook Together — social features, following, comments, family sharing
6. Speak Your Language — multilingual section with recipe in 5 languages
7. Testimonials — warm, personal quotes
8. Pricing — approachable, friendly
9. Final CTA — "Start cooking with clarity." + App store badges (placeholder)

Visual approach:
- Warmest of the three
- Food photography led
- Approachable typography (less editorial, more friendly)
- Strong mobile presentation
- Clear CTAs throughout

---

## TECHNICAL REQUIREMENTS

Each HTML file must:
1. Be completely self-contained (one file, no build step)
2. Use CSS custom properties for the color palette
3. Have smooth scroll-triggered animations (Intersection Observer or
   CSS animations — no JS framework required)
4. Be fully responsive (mobile-first, breakpoints at 768px and 1200px)
5. Have working sticky header with nav links
6. Have a mobile hamburger menu
7. Load in under 3 seconds (no heavy assets)
8. Use placeholder product UI (CSS-drawn mockups, not real screenshots)
9. Use Unsplash source URLs for any food photography
   (format: https://source.unsplash.com/1200x800/?food,cooking)

## CODE QUALITY

- Use CSS Grid and Flexbox (no Bootstrap)
- CSS custom properties for all colors and spacing
- Semantic HTML (header, nav, main, section, footer)
- Accessible (alt tags, ARIA labels, sufficient contrast)
- No jQuery — vanilla JS only
- Comments marking each major section

---

## WHAT SUCCESS LOOKS LIKE

Open each file in a browser and the immediate reaction should be:
"This looks significantly more premium than a typical recipe app."

Each concept should feel distinct — not just color variations of the
same layout.

---

## COMPLETION CHECKLIST

- [ ] docs/landing-previews/ directory created
- [ ] concept-a.html — "The Unified Kitchen" — Palette A
- [ ] concept-b.html — "The Operating System" — Palette B
- [ ] concept-c.html — "Beautiful Food. Organized Life." — either palette
- [ ] All 3 are self-contained, open in browser with no build step
- [ ] All 3 are fully responsive (check at 375px, 768px, 1440px)
- [ ] Sticky nav on all 3
- [ ] Mobile hamburger menu on all 3
- [ ] Scroll animations on all 3
- [ ] Pricing section on all 3 with correct real prices
- [ ] All CTAs link to correct routes
- [ ] No broken links or missing assets
- [ ] Run /wrapup
- [ ] At the end of the session, recap which concept felt strongest and why,
      what was completed, what was left incomplete, and why.
