# ChefsBook — Session 65: Onboarding Help Bubbles
# Source: Feature request 2026-04-11
# Target: apps/web only

---

## CONTEXT

First-time users get contextual help bubbles that point at specific UI elements
and explain features as they discover each section. Bubbles are off by default
after the tour completes or is dismissed, and can be re-enabled in settings.

Read .claude/agents/ui-guardian.md and .claude/agents/deployment.md before starting.

---

## DB CHANGES

Migration `026_onboarding.sql`:

```sql
ALTER TABLE user_profiles
  ADD COLUMN IF NOT EXISTS onboarding_enabled BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS onboarding_completed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS onboarding_seen_pages TEXT[] DEFAULT '{}';
  -- tracks which pages the user has seen bubbles for
```

Apply to RPi5.

---

## BUBBLE COMPONENT — `OnboardingBubble`

Create `apps/web/components/OnboardingBubble.tsx`:

```tsx
interface OnboardingBubbleProps {
  id: string;           // unique bubble ID e.g. 'dashboard-search'
  target: string;       // CSS selector of the element to point at
  title: string;
  body: string;
  position: 'top' | 'bottom' | 'left' | 'right';
  step: number;         // current step on this page
  totalSteps: number;   // total steps on this page
  isLastOnPage: boolean;
  nextPageLabel?: string;  // e.g. "Go to Scan page"
  nextPageHref?: string;
  onNext: () => void;
  onSkipAll: () => void;
  onDismissOne: () => void;
}
```

### Visual design

```
        ▲  (arrow pointing at target element)
┌──────────────────────────────────────┐
│  Search & Discover              [✕]  │  ← title + X button
│                                      │
│  Find recipes by cuisine, course,    │  ← body text, max 2 sentences
│  ingredients or tags. Follow other   │
│  chefs to see their latest recipes.  │
│                                      │
│  Step 2 of 4          [Skip All]     │  ← step indicator + skip
│                                      │
│  ┌──────────────────────────────┐    │
│  │           Next →             │    │  ← primary action
│  └──────────────────────────────┘    │
│                                      │
│  (or on last bubble of page:)        │
│  ┌──────────────────────────────┐    │
│  │    Next Page: Scan →         │    │
│  └──────────────────────────────┘    │
└──────────────────────────────────────┘
```

Style spec:
- Background: `#ffffff`, border-radius 12px
- Box shadow: `0 4px 24px rgba(0,0,0,0.15)`
- Max width: 320px
- Title: 16px, font-weight 600, `#1a1a1a`
- Body: 14px, `#6b7280`, line-height 1.6
- Step indicator: 12px, `#9ca3af`
- Next button: pomodoro red `#ce2b37`, white text, pill shape
- Skip All: plain text, `#9ca3af`, 12px
- X button: top-right corner, `#9ca3af`, 20px
- Arrow: CSS triangle pointing at the target element, colour matches bubble bg
- Backdrop: none — bubbles appear over normal page content, no dimming

### Dismiss behaviour
- **X button tapped:** Show inline message inside the bubble:
  ```
  ┌──────────────────────────────────────┐
  │  Keep help bubbles on?               │
  │                                      │
  │  You can always turn them back on    │
  │  in Settings.                        │
  │                                      │
  │  [Keep On]        [Turn Off]         │
  └──────────────────────────────────────┘
  ```
  "Keep On" → dismiss just this bubble, continue tour
  "Turn Off" → set `onboarding_enabled = false`, hide all bubbles

- **Skip All:** Same confirmation as X

- **Completing all pages:** Show celebration screen:
  ```
  ┌──────────────────────────────────────┐
  │            🎉                        │
  │  You're all set!                     │
  │                                      │
  │  You've explored all of ChefsBook.   │
  │  Help tips are now off — you can     │
  │  turn them on again in Settings.     │
  │                                      │
  │  [Start Cooking →]                   │
  └──────────────────────────────────────┘
  ```
  Then set `onboarding_completed_at = now()`, `onboarding_enabled = false`

---

## ONBOARDING HOOK — `useOnboarding`

```ts
// apps/web/hooks/useOnboarding.ts
export function useOnboarding(pageId: string) {
  // Returns: { showBubbles, markPageSeen, disableOnboarding }
  // showBubbles = true if onboarding_enabled AND this page not yet seen
}
```

When user visits a page, check if `pageId` is in `onboarding_seen_pages`.
If not, show bubbles for that page. After viewing the last bubble, add `pageId`
to `onboarding_seen_pages` and save to DB.

---

## BUBBLE SEQUENCE — all pages and bubbles

Define all bubbles in `apps/web/lib/onboardingContent.ts`.
Never repeat the same concept on different pages.

### Page: Dashboard (`/dashboard`)
1. **Welcome** — target: ChefsBook logo
   - "Welcome to ChefsBook — Your recipe library, meal planner, and shopping hub in one place."
2. **Your Recipes** — target: Recipes nav item
   - "All your recipes live here. Import from any website, scan a photo, or speak a recipe aloud."
3. **Search** — target: Search nav item
   - "Search by cuisine, ingredient, or tag. Discover public recipes from the community."
4. **Shopping** — target: Shopping nav item
   - "Smart shopping lists grouped by store. Add recipes and we calculate what you need."
5. **Meal Plan** — target: Plan nav item
   - "Plan your week visually. Add recipes to any day and generate your shopping list instantly."

### Page: Recipe Detail (`/recipe/[id]`)
1. **Like & Share** — target: action bar
   - "Like recipes to save them to Favourites. Share via link or download as a PDF (Pro)."
2. **Add to Plan** — target: + Meal Plan button
   - "Add this recipe to any day in your meal plan with one tap."
3. **Add to Shopping** — target: Add to Shopping List button
   - "Add all ingredients to your shopping list. We handle unit conversion automatically."
4. **Translate** — target: language selector (EN flag)
   - "Reading in another language? Switch here and your recipes translate automatically."
5. **Cook Mode** — target: Cook Mode button
   - "Start cooking with a distraction-free step-by-step view."

### Page: Scan (`/dashboard/scan`)
1. **Scan a Recipe** — target: Scan Photo button
   - "Point your camera at any recipe — printed, handwritten, or from a cookbook page."
2. **Speak a Recipe** — target: Speak a Recipe button
   - "Dictate a recipe aloud and AI formats it instantly into your collection."
3. **Import URL** — target: Import URL button
   - "Paste any recipe website URL and we extract the recipe automatically."
4. **Instagram** — target: Instagram button
   - "Share directly from Instagram or paste a post link to import the recipe."

### Page: Shopping (`/dashboard/shop`)
1. **Store Groups** — target: first store group header
   - "Lists are grouped by store. Tap any list to see your items by department."
2. **New List** — target: New List button
   - "Create a list for any store. We remember your stores and show their logos."
3. **Combined View** — target: All [Store] row (if visible)
   - "Multiple lists for one store? Tap 'All [Store]' to see everything combined."

### Page: Meal Plan (`/dashboard/plan`)
1. **Week Navigation** — target: week nav arrows
   - "Navigate between weeks. Your meal plan saves automatically."
2. **Add a Meal** — target: + Add recipe button on a day card
   - "Tap any day to add a recipe. Slots are colour-coded — green is empty, red is filled."
3. **Day to Cart** — target: cart icon on a day card
   - "Tap the cart icon to add all that day's ingredients to a shopping list at once."
4. **Daypart Pill** — target: DINNER pill on a recipe card
   - "Tap the meal type pill to change it. Tap the servings pill to adjust portions."

### Page: Settings (`/dashboard/settings`)
1. **Your Plan** — target: plan section
   - "View and upgrade your plan here. Use a promo code at signup for special access."
2. **Help Bubbles** — target: help bubbles toggle
   - "This is where you can turn help tips on or off at any time."

---

## SETTINGS TOGGLE

In the Settings page, add a "Help Tips" toggle:
```
Help Tips
Show guided help bubbles when visiting new sections
[Toggle ON/OFF]
```

Toggle reads/writes `user_profiles.onboarding_enabled`.
When toggled on after being off: reset `onboarding_seen_pages = []` so user
sees bubbles again on next visit to each page.

---

## POSITIONING

Use a positioning library or manual calculation to place each bubble
near its target element. Recommended: install `floating-ui` for React:

```bash
npm install @floating-ui/react
```

This handles collision detection (bubbles near screen edges flip position
automatically) and arrow placement.

---

## DEPLOYMENT

```bash
ssh rasp@rpi5-eth
cd /mnt/chefsbook/repo
git pull
cd apps/web
NODE_OPTIONS=--max-old-space-size=1024 npm run build 2>&1 | tail -20
pm2 restart chefsbook-web
```

Note: always use `NODE_OPTIONS=--max-old-space-size=1024` for builds on the Pi.

---

## COMPLETION CHECKLIST

- [ ] Migration 026 applied to RPi5
- [ ] `OnboardingBubble` component built with correct styling
- [ ] Arrow points at target element correctly
- [ ] X dismisses with "Keep On / Turn Off" confirmation
- [ ] Skip All shows same confirmation
- [ ] Step indicator shows "Step N of M"
- [ ] Last bubble on page offers "Next Page →" navigation
- [ ] All bubbles defined for 6 pages (dashboard, recipe, scan, shop, plan, settings)
- [ ] Each page's bubbles only shown once (tracked in onboarding_seen_pages)
- [ ] Completion celebration screen shown after all pages visited
- [ ] Settings toggle to re-enable help tips
- [ ] `@floating-ui/react` handles positioning and collision detection
- [ ] Bubbles never repeat concepts across pages
- [ ] Deployed to RPi5 and verified live — bubbles appear for new session
- [ ] Run /wrapup to update DONE.md and CLAUDE.md
