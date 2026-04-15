# ChefsBook — Session 100: Fix Dashboard Header + Messaging Polish
# Source: Live review — header layout broken, messaging gaps from session 97
# Target: apps/web + apps/mobile

---

## CONTEXT

Read CLAUDE.md, DONE.md, feature-registry.md, and ALL mandatory agents
per SESSION START sequence before touching anything.

Two problems to fix:
1. Dashboard header is visually broken — bell floating over buttons, duplicate Add Recipe
2. Two messaging gaps left over from session 97

---

## FIX 1 — Dashboard header layout

The correct header layout left to right is a single inline flex row:

| Messages 🔔 | Select | + Add Recipe |

### Rules — no exceptions:
- Single flex row, align-items: center, gap between all three elements
- NO absolute or relative positioning on any element in this row
- NO floating elements
- NO duplicate buttons — if Add Recipe appears twice, find and remove the duplicate

### Messages pill:
- Pill-shaped button
- Text "Messages" with bell icon on the RIGHT side of the text
- Style: pomodoro red border (#ce2b37), cream/white background (#faf7f0), red text
- Unread count badge on the top-right corner of the pill
- Clicking opens the notification/messages panel

### Select button:
- Standalone button, sits between Messages pill and Add Recipe button
- No changes to its existing functionality

### + Add Recipe button:
- Rightmost element
- No changes to its existing functionality

### How to fix:
1. Find the dashboard layout header component in apps/web
2. Read the exact JSX — identify what is causing the bell to float and the duplicate button
3. Rewrite the header row as a clean flex container with the three elements in order
4. Remove any legacy bell icon that exists outside the Messages pill
5. Verify no duplicate Add Recipe button remains anywhere in the layout

---

## FIX 2 — Mobile messaging compose: replace Alert.prompt with ChefsDialog

In apps/mobile, the Message button on chef profile uses Alert.prompt to
compose messages. Alert.prompt does not work on Android and fails in
landscape mode.

Replace with:
- A bottom sheet modal using the existing ChefsDialog component pattern
- Contains: recipient username (read-only header), text area (max 1000 chars
  with char counter), Send button, Cancel button
- On send: calls sendMessage(), shows success toast, closes sheet
- On error: shows error message inside the sheet — does not close
- Uses useTheme().colors — never hardcode hex

---

## FIX 3 — Sidebar Messages link: wire unread count badge

The Messages link in the web sidebar must show a live unread count badge.

- Read unread_messages_count from user_profiles for the current user
- Show as a red badge on the Messages nav item (same style as notification bell badge)
- Subscribe to changes via Supabase Realtime so it updates without page reload
- Badge disappears when count = 0
- Count resets to 0 when user opens /dashboard/messages (call markMessagesRead)

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

- [ ] Dashboard header is a single clean flex row: Messages pill | Select | + Add Recipe
- [ ] No floating bell icon outside the Messages pill
- [ ] No duplicate Add Recipe button
- [ ] Messages pill: bell icon on RIGHT of text, red border, cream bg, red text
- [ ] Unread badge on top-right corner of Messages pill
- [ ] Mobile compose uses ChefsDialog bottom sheet, not Alert.prompt
- [ ] Bottom sheet has char counter, send/cancel, success toast, error handling
- [ ] Sidebar Messages link shows live unread count badge
- [ ] Badge resets when user opens messages page
- [ ] feature-registry.md updated
- [ ] tsc --noEmit passes both apps
- [ ] Deployed to RPi5 — header verified visually correct
- [ ] Run /wrapup
- [ ] At the end of the session, recap exactly what was completed from this prompt,
      what was left incomplete, and why.
