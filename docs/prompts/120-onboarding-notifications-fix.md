# ChefsBook — Session 120: Onboarding Bubbles Polish + Notification Fixes
# Source: Live review after session 119 login fix
# Target: apps/web

---

## CONTEXT

Read CLAUDE.md, DONE.md, feature-registry.md, ui-guardian.md, and ALL
mandatory agents per SESSION START sequence before touching anything.

Two areas to fix: onboarding bubble UX issues and broken notifications.

---

## FIX 1 — Onboarding bubbles: scroll to target when below fold

When a bubble targets an element below the visible viewport, the user
does not see the bubble unless they manually scroll. The page must
automatically scroll to bring the target element into view before
showing the bubble.

Fix in the OnboardingBubble component or useOnboarding hook:
- Before showing each bubble, call target.scrollIntoView({ behavior: 'smooth', block: 'center' })
- Wait for scroll to complete (small delay, ~300ms) before positioning
  the bubble with @floating-ui/react
- This ensures the bubble is always visible when it appears
- Apply to ALL bubbles, not just the settings toggle one

---

## FIX 2 — Onboarding bubbles: add missing pages

Bubbles currently exist for some pages but are missing on:
- Scan / Import page
- Meal Plan page
- My Cookbooks page
- My Techniques page

Add bubble content for each missing page. Follow the exact same
pattern as existing bubbles. Each bubble should:
- Explain what the page does in 1-2 friendly sentences
- Point to a relevant UI element on that page via data-onboard attribute
- Have a "Got it" dismiss button and "Turn off tips" option

### Scan page bubble
Target: data-onboard="scan-import" on the main import/scan area
Content: "Import recipes from any website, scan a photo, or speak a recipe
aloud. ChefsBook does the rest!"

### Meal Plan page bubble
Target: data-onboard="meal-plan-week" on the week calendar view
Content: "Plan your meals for the week. Add recipes to any day, then
send the whole week's ingredients straight to your shopping list."

### My Cookbooks page bubble
Target: data-onboard="cookbooks-list" on the cookbook grid/list
Content: "Save your favourite cookbooks here. ChefsBook can read the
table of contents and help you import recipes directly from your books."

### My Techniques page bubble
Target: data-onboard="techniques-list" on the techniques list
Content: "Techniques are tips, tricks and methods you've saved — separate
from recipes. Use them as a reference while you cook."

Add the data-onboard attributes to the relevant elements on each page.
Update the useOnboarding hook to include these new page entries.

---

## FIX 3 — Dismiss behaviour: per-page vs global

Clarify and implement the correct dismiss flow:

Each bubble must have TWO options:
- "Got it" — dismisses this bubble only, marks this page as seen,
  bubbles continue on other pages
- "Turn off tips" — dismisses all bubbles globally, same as toggling
  off in Settings

Currently it is unclear which button does which. Make the labels clear
and ensure the behaviour matches:
- "Got it" → mark current page as seen in onboarding_seen_pages,
  advance to next unseen page on next navigation
- "Turn off tips" → set onboarding_enabled = false in user_profiles,
  hide all bubbles everywhere immediately

---

## FIX 4 — Comment notifications not reaching recipe owner

When seblux posts a comment on a pilzner recipe, pilzner should get a
notification in the bell panel. This is not happening.

Diagnose:
```sql
-- Check if notifications exist
SELECT * FROM notifications
WHERE type = 'recipe_comment'
ORDER BY created_at DESC LIMIT 10;

-- Check the postComment function result
SELECT rc.id, rc.recipe_id, rc.user_id, rc.content, rc.created_at
FROM recipe_comments rc
ORDER BY rc.created_at DESC LIMIT 5;
```

Check postComment() in packages/db:
- Does it call createNotification() after inserting the comment?
- Is createNotification() passing the correct recipient (recipe owner)?
- Is there a try/catch swallowing the notification error silently?

Fix: after every comment insert, create a notification for the recipe
owner (unless the commenter IS the owner). Verify a notification row
appears in the DB after posting a test comment.

---

## FIX 5 — Messages not appearing after admin DM

Admin sends a DM to seblux via the Users page. The send returns
{"ok":true} but the message does not appear in seblux's
/dashboard/messages inbox.

Diagnose:
```sql
-- Check direct_messages for recent admin sends
SELECT id, sender_id, recipient_id, content, created_at
FROM direct_messages
ORDER BY created_at DESC LIMIT 5;

-- Check if seblux's user_id is correct
SELECT id, username FROM user_profiles WHERE username = 'seblux';
```

Check:
1. Is the recipient_id being set correctly in the admin send flow?
   The admin page looks up user by email from auth.users — does it
   correctly resolve to the user_profiles.id?
2. Does the messages page query use the correct user_id for filtering?
3. Is there an RLS policy on direct_messages that blocks seblux from
   reading messages where they are the recipient?

Fix the root cause. Verify the message appears in seblux's inbox after
an admin sends a test DM.

---

## DEPLOYMENT

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

- [ ] Bubbles scroll page to target before appearing (smooth scroll)
- [ ] Scan page bubble added with data-onboard attribute
- [ ] Meal Plan page bubble added with data-onboard attribute
- [ ] My Cookbooks page bubble added with data-onboard attribute
- [ ] My Techniques page bubble added with data-onboard attribute
- [ ] "Got it" dismisses current page bubble only
- [ ] "Turn off tips" disables all bubbles globally
- [ ] Button labels clearly communicate what each does
- [ ] comment notifications: notification row confirmed in DB after test comment
- [ ] Recipe owner receives bell notification on new comment
- [ ] Admin DM message confirmed in direct_messages table with correct recipient_id
- [ ] Message appears in recipient's /dashboard/messages inbox
- [ ] feature-registry.md updated
- [ ] tsc --noEmit passes
- [ ] Deployed to RPi5
- [ ] Run /wrapup
- [ ] At the end of the session, recap exactly what was completed from
      this prompt, what was left incomplete, and why.
