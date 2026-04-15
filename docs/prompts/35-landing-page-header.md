# ChefsBook — Session 35: Landing Page Refresh + Header Unit Toggle Fix
# Source: Post-queue tracker items C + D
# Target: apps/web

---

## CONTEXT

Two web UI updates: (1) the landing page needs a full content refresh to reflect all
features built and the new tier plans, and (2) the metric/imperial toggle in the web
header is getting clipped — move it to the sidebar menu above Settings.

Read .claude/agents/ui-guardian.md before starting.

---

## FIX 1 — Move metric/imperial toggle to sidebar

### Current behaviour
The kg/lb toggle sits in the web header next to the language selector, where it gets
clipped on narrower screens.

### Fix
Remove the toggle from the header entirely. Place it in the sidebar navigation menu,
positioned directly above the Settings link at the bottom of the sidebar.

Style it as a compact inline toggle — same pill style as the mobile header toggle
(`[kg | lb]`) but integrated into the sidebar list naturally. Label: "Units" with
the toggle to the right.

The language selector can remain in the header — it's less likely to overflow since
it's just a flag + 2-letter code.

---

## FIX 2 — Landing page full refresh

### Keep
- Overall Trattoria aesthetic (cream `#faf7f0`, pomodoro red `#ce2b37`, basil green
  `#009246`)
- Current layout structure (hero → features → how it works → CTA)
- Typography style and spacing

### Add / Update

**Hero section:**
- Integrate the ChefsBook chef's hat logo prominently (top-left or centered above
  the headline)
- Update headline to reflect the social + AI angle:
  e.g. "Your recipes. Your community. Powered by AI."
- Update subheadline to mention key features: scan, speak, share, discover

**Features section — update to reflect what's actually built:**

Organise into feature groups with icons:

*Import & Capture*
- Scan recipe photos (multi-page, cookbook pages)
- Import from any URL
- Speak a recipe (voice entry)
- Instagram import
- Identify dishes from photos with AI

*Organise & Plan*
- Recipe versioning (multiple versions of one recipe)
- AI meal planner
- Smart shopping lists (store-grouped, unit-aware)
- Cookbook organisation

*Discover & Share*
- Public recipe discovery
- Share recipes via link (chefsbk.app)
- Follow chefs, see What's New feed
- Likes and family-friendly comments
- Attribution tracking (original recipe credit)

*AI Powered*
- Auto-tagging
- Recipe translation (5 languages)
- Dish identification
- AI meal plan generation
- Content moderation

**Pricing / Plans section (new section):**

Four tier cards in a 2×2 grid (or horizontal scroll on mobile):

```
┌──────────────┐ ┌──────────────┐ ┌──────────────┐ ┌──────────────┐
│   FREE       │ │   CHEF       │ │   FAMILY     │ │   PRO        │
│   $0         │ │  $4.99/mo   │ │  $9.99/mo   │ │ $14.99/mo   │
│              │ │  $3.99 ann  │ │  $7.99 ann  │ │ $11.99 ann  │
│ • View public│ │ • 75 recipes │ │ • 200 recipes│ │ • Unlimited  │
│   recipes    │ │ • AI features│ │ • 3 family  │ │ • 5 images/  │
│ • 1 list     │ │ • 5 lists   │ │   members   │ │   recipe     │
│ • Shared     │ │ • Sharing   │ │ • Shared    │ │ • PDF export │
│   links      │ │ • Social    │ │   lists     │ │ • Priority AI│
│              │ │ • 10 cook-  │ │ • 25 cook-  │ │ • Unlimited  │
│              │ │   books     │ │   books     │ │   everything │
│ [Get started]│ │ [Start free]│ │ [Start free]│ │ [Start free] │
└──────────────┘ └──────────────┘ └──────────────┘ └──────────────┘
```

- Monthly/annual toggle above the cards (show 20% savings on annual)
- Chef card highlighted as "Most Popular"
- Each card's CTA button links to `/sign-up` with the plan pre-selected
- Add promo code note: "Have a promo code? Enter it at signup"

**How it works section:**
Update to show the actual user journey:
1. Sign up (free, 30 seconds)
2. Import recipes (scan a photo, paste a URL, speak it, or import from Instagram)
3. Organise + plan (meal planner, shopping lists, cookbooks)
4. Discover + share (follow chefs, share recipes, build your collection)

**Footer:**
- Add links: Features, Pricing, Sign In, Download App
- chefsbk.app branding
- "© 2026 ChefsBook"

**Chef's hat logo integration:**
- Use in the hero section (large, centered or left-aligned)
- Use as favicon (confirm `apps/web/public/favicon.ico` uses the chef's hat)
- Use in the footer wordmark

---

## COMPLETION CHECKLIST

- [ ] kg/lb toggle removed from web header
- [ ] kg/lb toggle added to sidebar above Settings, styled as compact pill
- [ ] Chef's hat logo in hero section of landing page
- [ ] Hero headline and subheadline updated
- [ ] Features section updated with all current features in organised groups
- [ ] Pricing section added with 4 tier cards
- [ ] Monthly/annual pricing toggle on pricing section
- [ ] Chef plan highlighted as "Most Popular"
- [ ] How it works section updated to match actual user journey
- [ ] Footer updated with links and branding
- [ ] Favicon confirmed as chef's hat
- [ ] Trattoria colour palette preserved throughout
- [ ] Responsive layout — pricing cards stack correctly on mobile viewport
- [ ] All CTA buttons link to correct routes
- [ ] Run /wrapup to update DONE.md and CLAUDE.md
