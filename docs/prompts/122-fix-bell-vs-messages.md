# ChefsBook — Session 122: Fix Bell/Notifications vs Direct Messages Separation
# Source: Bell pill navigates to /messages instead of opening notification panel
# Target: apps/web dashboard header + sidebar

---

## CONTEXT

Read CLAUDE.md, DONE.md, feature-registry.md, ui-guardian.md, and ALL
mandatory agents per SESSION START sequence before touching anything.

The bell/Messages pill in the dashboard header was added in session 100
but was incorrectly wired to navigate to /dashboard/messages. It must
open the notification slide-in panel instead.

Direct messages and notifications are TWO SEPARATE SYSTEMS:
- Notifications (bell panel): comment alerts, recipe likes, new followers,
  moderation alerts — shown in a slide-in panel
- Direct messages: private user-to-user chat — at /dashboard/messages

---

## FIX 1 — Bell pill opens notification panel, not messages page

In the dashboard header, the Messages pill (bell icon + "Messages" text)
must:
- On click: open the existing NotificationBell slide-in panel
- NOT navigate to /dashboard/messages
- The NotificationBell panel already exists from session 77 — wire the
  pill to toggle it open

The pill label should also be changed:
- Current: "Messages" (confusing — implies DMs)
- New: "Notifications" with a bell icon

OR keep it as a bell icon only with the unread count badge — no text
label needed if it causes confusion.

Check what the NotificationBell component currently does and how it
is triggered. The pill must use the same trigger mechanism.

---

## FIX 2 — Sidebar has TWO separate items

The sidebar must clearly separate the two systems:

1. **Bell icon or "Notifications"** — in the header (top right area),
   opens the slide-in notification panel on click
   - Shows unread notification count badge

2. **"Messages"** — in the sidebar nav list (already exists from session 97)
   - Navigates to /dashboard/messages
   - Shows unread DM count badge

These must be visually and functionally distinct. Users must understand
that one is for activity/alerts and one is for private conversations.

---

## FIX 3 — Notification panel tabs

Confirm the notification panel (from session 77) has these 5 tabs:
- All
- Comments
- Likes  
- Follows
- Moderation

Each tab filters the notifications list. Clicking a notification:
- Comment notification → navigates to the recipe page
- Like notification → navigates to the recipe page
- Follow notification → navigates to the follower's profile
- Moderation notification → navigates to the relevant content

If any of these navigation links are broken, fix them.

---

## FIX 4 — Unread counts on correct elements

- Bell/Notifications badge: count of unread NOTIFICATIONS
  (from notifications table, is_read = false)
- Messages sidebar badge: count of unread DIRECT MESSAGES
  (from unread_messages_count on user_profiles)

These are separate counts from separate tables. Ensure each badge
reads from the correct source.

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

- [ ] Bell pill/button in header opens notification slide-in panel (not navigate to /messages)
- [ ] Bell badge shows unread notification count (from notifications table)
- [ ] Sidebar "Messages" link navigates to /dashboard/messages
- [ ] Sidebar Messages badge shows unread DM count (from unread_messages_count)
- [ ] Notification panel has 5 tabs (All/Comments/Likes/Follows/Moderation)
- [ ] Comment notification click → navigates to recipe page
- [ ] Like notification click → navigates to recipe page
- [ ] Follow notification click → navigates to follower profile
- [ ] Two systems are visually distinct and clearly labelled
- [ ] feature-registry.md updated
- [ ] tsc --noEmit passes
- [ ] Deployed to RPi5
- [ ] Run /wrapup
- [ ] At the end of the session, recap exactly what was completed from
      this prompt, what was left incomplete, and why.
