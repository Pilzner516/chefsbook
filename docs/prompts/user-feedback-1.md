# Prompt: ChefsBook — Got an Idea iOS Fix + Feedback Tags + Meal Plan Shopping Cart Quantities

## LAUNCH PROMPT (paste this into Claude Code to start the session)

```
Read and execute docs/prompts/user-feedback-1.md fully and autonomously, from pre-flight through deployment and /wrapup. Do not stop for questions unless you hit a genuine blocker.
```

---

## TYPE: BUG FIX + FEATURE — MOBILE + WEB

## Overview

Three issues this session:
1. CRITICAL: "Got an Idea" modal on iOS completely blocks the app after typing — Send Feedback and close buttons are unreachable, requires full device restart.
2. "Got an Idea" messages need pill tags (Bug / Feature Request / Question / Other) matching the mobile app, and should route to the User Feedback section in admin — not User Ideas. Remove the User Ideas admin section.
3. Adding a meal plan day to the shopping cart imports ingredients but loses all quantities.

---

## Agent files to read — ALL of these, in order, before writing a single line of code

- `.claude/agents/wrapup.md`
- `.claude/agents/testing.md`
- `.claude/agents/feature-registry.md`
- `.claude/agents/ui-guardian.md`
- `.claude/agents/deployment.md`

Run ALL pre-flight checklists before writing any code.

---

## Pre-flight: before writing any code

1. Read CLAUDE.md fully
2. Read DONE.md from the repo — current file, not cached. Understand current state of Got an Idea modal, User Feedback, User Ideas, and meal plan shopping cart.
3. Find the Got an Idea modal component in the mobile app — understand how it renders and handles keyboard/scroll on iOS
4. Find where Got an Idea messages are saved — what table, what fields
5. Find the User Feedback and User Ideas admin sections — understand the difference in schema/routing
6. Find the meal plan → shopping cart import function — trace how ingredients and quantities are read
7. Only then write any code

---

## TASK 1 — CRITICAL: Fix Got an Idea modal on iOS (HIGHEST PRIORITY)

**Symptom:** On iOS, after a user types in the Got an Idea message field, the keyboard pushes the modal up and the Send Feedback and close (X) buttons become unreachable above or below the viewport. The modal cannot be dismissed. The entire app is blocked and requires a full device restart.

**Root cause to investigate:**
- iOS virtual keyboard resizes the viewport, pushing fixed/absolute positioned elements out of view
- The modal is likely using `position: fixed` or `height: 100vh` which breaks on iOS when the keyboard appears
- The scroll context may be locked (body scroll lock) preventing the user from scrolling to reach the buttons

**Fix requirements:**
- The Send Feedback button must always be visible and tappable on iOS when the keyboard is open
- The close (X) button must always be reachable
- The modal must not block the app — if all else fails, tapping outside the modal must close it
- Test approach: use the iOS simulator or an iPhone to verify keyboard behaviour

**Specific fixes to try in order:**
1. Replace `height: 100vh` with `height: 100dvh` (dynamic viewport height — handles iOS keyboard correctly)
2. Ensure the modal uses `-webkit-overflow-scrolling: touch` and `overflow-y: auto` so content scrolls inside it
3. Move the Send Feedback button to the TOP of the modal form (above the text input) so it is never pushed off screen by the keyboard — this is the safest fix
4. Ensure tapping the backdrop/overlay closes the modal as a fallback escape
5. If body scroll is being locked when the modal opens, unlock it — or use a scroll lock library that handles iOS correctly

Do not ship until this is confirmed working on iOS. This is a CRITICAL bug.

---

## TASK 2 — Add pill tags to Got an Idea + route to User Feedback + remove User Ideas section

### Part A — Add tags to the Got an Idea modal

The mobile app already has pill tag selection (e.g. "Bug"). The Got an Idea modal needs the same.

Add a row of selectable pill tags above the message text input:
- **Bug** 
- **Feature Request**
- **Question**
- **Other** (default if none selected)

Styling: same pill style used in the mobile app for these tags. Single select only. The selected pill is highlighted. One must always be selected — default to "Other".

Add a `tag` field to the feedback message when submitted. Check the current table schema for user feedback messages and add the `tag` column if it does not exist:

```sql
ALTER TABLE user_feedback ADD COLUMN IF NOT EXISTS tag TEXT NOT NULL DEFAULT 'Other';
```

### Part B — Route Got an Idea messages to User Feedback

Currently Got an Idea messages save to a separate destination (User Ideas). Change this:
- Got an Idea messages must now save to the same table/destination as User Feedback messages
- Include the selected tag when saving
- Add a source field to distinguish origin if one does not already exist:
  ```sql
  ALTER TABLE user_feedback ADD COLUMN IF NOT EXISTS source TEXT NOT NULL DEFAULT 'feedback';
  -- Got an Idea messages: source = 'got_an_idea'
  ```
- Do NOT migrate existing User Ideas messages — leave that data in place

### Part C — Remove User Ideas from admin menu

Find the User Ideas menu item in the admin sidebar nav. Remove it entirely.
Do not delete the underlying table or data — just remove the nav link and the admin page route.
From now on all Got an Idea submissions appear in the User Feedback section with their tag visible.

### Part D — Show tags in admin User Feedback view

In the admin User Feedback list/table, add:
- A tag column showing the pill tag for each message (Bug / Feature Request / Question / Other)
- A filter dropdown to filter by tag
- Messages from Got an Idea source should be visually distinguishable (e.g. small "Got an Idea" badge next to the tag)

---

## TASK 3 — Fix meal plan → shopping cart loses quantities

**Symptom:** When a user adds a meal plan day to the shopping cart, the ingredients are imported but all quantities are missing or blank.

**Root cause to investigate:**
- Find the function that reads meal plan day ingredients and adds them to the cart
- Trace where the quantity field is read — it is likely reading the ingredient name only and not the quantity/unit fields
- Check whether quantities are stored differently for meal plan recipes vs regular recipes (e.g. scaled quantities vs base quantities)

**Fix:**
- Each ingredient added to the shopping cart from a meal plan must include its quantity and unit
- If a recipe is in the meal plan with a serving size multiplier, apply that multiplier to the base quantity before adding to cart
- Format: `{quantity} {unit} {ingredient name}` — e.g. "2 cups flour", "1 tbsp olive oil"
- If quantity is missing from the source data, add as quantity-less item (same as current behaviour) rather than failing silently

---

## Testing

### Task 1 — iOS modal
1. Open Got an Idea on an iPhone or iOS simulator
2. Tap the message field — keyboard appears
3. Type a message
4. Confirm Send Feedback button is visible and tappable
5. Confirm X / close is reachable
6. Confirm tapping outside the modal closes it
7. Submit a message — confirm it saves successfully

### Task 2 — Tags and routing
1. Open Got an Idea — confirm pill tags appear (Bug, Feature Request, Question, Other)
2. Select "Bug" — submit a message
3. Check admin User Feedback — confirm the message appears with "Bug" tag and "Got an Idea" source badge
4. Confirm User Ideas is gone from admin nav
5. Filter by "Bug" tag in User Feedback — confirm it works

### Task 3 — Shopping cart quantities
1. Create a meal plan with a recipe that has quantities on all ingredients
2. Add that meal plan day to shopping cart
3. Confirm each ingredient shows its quantity and unit in the cart

### psql verification
```sql
-- Confirm tag column exists and is populated
SELECT id, tag, source, created_at FROM user_feedback ORDER BY created_at DESC LIMIT 10;
```

---

## Deploy

Follow `deployment.md`. Deploy mobile and web to RPi5.
Run regression smoke test from `testing.md` before wrapup.

---

## Wrapup

Follow `wrapup.md` fully.
Update `feature-registry.md`:
- Got an Idea iOS fix
- Feedback tag system
- User Ideas admin section removed
- Meal plan shopping cart quantities fix

Note in DONE.md:
- Got an Idea now routes to User Feedback with tag and source fields
- User Ideas admin nav removed (data preserved in table)
- Meal plan → cart now imports quantities correctly
