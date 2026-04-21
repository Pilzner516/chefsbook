Read docs/prompts — this is a targeted single-component fix. No specialist agents needed
beyond the mandatory set.

## AGENTS TO READ FIRST
1. `.claude/agents/wrapup.md`
2. `CLAUDE.md`
3. `DONE.md`
4. `.claude/agents/testing.md`
5. `.claude/agents/deployment.md`

---

## BUG

On the My Recipes dashboard page, the banner:
"You have 5 recipes that need attention. They're saved as private until you complete them.
Review now →"

The "Review now →" link does nothing. It should filter the recipe list to show only
incomplete recipes — the same result as clicking the "Incomplete" pill filter that already
exists on the page.

---

## FIX

Find the My Recipes dashboard page: `apps/web/app/dashboard/recipes/page.tsx`
(or wherever the recipe list and the incomplete banner both live).

The page already has:
- An active filter state that controls which pill is selected (All, Incomplete, Favourites, etc.)
- An "Incomplete" filter pill that works correctly when clicked

The fix is to wire "Review now →" to set the active filter to "Incomplete".

Depending on how the filter state is managed:

**If filter state is local (useState):**
- Lift the state if needed so both the banner and the pill row can read/write it
- "Review now →" calls the same setter as clicking the Incomplete pill
- The Incomplete pill becomes visually selected (active state) when triggered this way

**If filter state is in URL params (e.g. `?filter=incomplete`):**
- "Review now →" should navigate to `?filter=incomplete`
- The pill row already reads this param — it will highlight automatically

**If filter state is in Zustand:**
- "Review now →" dispatches the same action as clicking the Incomplete pill

Match whatever pattern is already in use. Do not introduce a new state management
approach.

Also ensure:
- After clicking "Review now →", the page scrolls to the recipe list (not the top of page)
  if the banner is above the fold. Use `scrollIntoView` on the filter row or recipe grid.
- The "Incomplete" pill visually reflects the active state (same styling as when clicked
  directly)

---

## ALSO FIX IN THIS SESSION

Two strings from the Prompt A Sous Chef rename have an incorrect lowercase "your":

1. `apps/web/app/dashboard/scan/page.tsx` line ~717:
   `"your Sous Chef will format it for you."` → `"Your Sous Chef will format it for you."`

2. `apps/web/app/dashboard/speak/page.tsx` line ~139:
   `"your Sous Chef will format it for you."` → `"Your Sous Chef will format it for you."`

Simple capitalisation fix — change lowercase "your" to "Your".

---

## IMPLEMENTATION ORDER
1. Fix the two lowercase "Your Sous Chef" strings
2. Fix the "Review now →" link
3. TypeScript check: `cd apps/web && npx tsc --noEmit` — must be clean
4. Deploy per `deployment.md`

---

## TESTING REQUIREMENTS
1. Click "Review now →" — recipe list filters to Incomplete, Incomplete pill is visually active
2. Clicking the Incomplete pill directly still works as before
3. Clicking "All" pill clears the filter as before
4. Grep proof: `grep -n "your Sous Chef" apps/web/app/dashboard/scan/page.tsx` returns nothing

## WRAPUP REQUIREMENT
DONE.md entry must include:
- Which filter state pattern was in use (useState / URL param / Zustand)
- Confirmation both lowercase fixes applied
- tsc clean + deploy confirmed
