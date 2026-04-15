# ChefsBook — Session 121: Fix Messages Page Chat UI
# Source: Live review — message thread broken, no reply input, missing messages
# Target: apps/web /dashboard/messages

---

## CONTEXT

Read CLAUDE.md, DONE.md, feature-registry.md, ui-guardian.md, and ALL
mandatory agents per SESSION START sequence before touching anything.

The messages page has structural issues. Fix the full chat UI to work
like a proper messaging interface.

---

## CURRENT PROBLEMS

1. Only one message shows in the thread despite multiple being sent
2. No reply/compose input at the bottom of the thread
3. Message bubble floats on right with no visual context
4. No clear sent vs received visual distinction
5. No sender label or readable timestamps on bubbles

---

## THE CORRECT CHAT UI LAYOUT

### Left panel — Conversation list
- List of conversations (one per unique contact)
- Each row: avatar + @username + last message preview + relative time
- Selected conversation highlighted in cream/light background
- Unread conversations bold
- No changes needed here — this part works

### Right panel — Thread view

```
┌─────────────────────────────────────────────────┐
│  @seblux                              [⚑ Flag]  │  ← thread header
├─────────────────────────────────────────────────┤
│                                                 │
│  [B] inbox test from admin          44m ago     │  ← RECEIVED (left)
│                                                 │
│  [B] second message from admin      43m ago     │  ← RECEIVED (left)
│                                                 │
│                    your reply here   42m ago [P]│  ← SENT (right)
│                                                 │
├─────────────────────────────────────────────────┤
│  [Type a message...          ] [Send]           │  ← compose area
└─────────────────────────────────────────────────┘
```

### Message bubble rules
- RECEIVED messages (from the other person): left-aligned, white/cream
  background, grey text, sender avatar on far left
- SENT messages (from current user): right-aligned, pomodoro red
  background, white text, no avatar needed
- Timestamp below each bubble in muted small text
- Messages in chronological order (oldest at top, newest at bottom)
- Thread auto-scrolls to bottom on load and on new message

### Compose area
- Fixed at the bottom of the thread panel
- Multiline textarea (max 1000 chars, char counter)
- Send button (red, right-aligned)
- Pressing Enter sends (Shift+Enter for new line)
- Textarea clears after send
- New message appears immediately in thread (optimistic update)

---

## STEP 1 — Fix the message fetch query

The thread only shows one message. Check getConversation() in
packages/db:

```sql
-- Check all messages between pilzner and seblux
SELECT id, sender_id, recipient_id, content, created_at
FROM direct_messages
WHERE (sender_id = '<pilzner_id>' AND recipient_id = '<seblux_id>')
   OR (sender_id = '<seblux_id>' AND recipient_id = '<pilzner_id>')
ORDER BY created_at ASC;
```

If multiple rows exist in the DB but only one shows, the query has
a LIMIT or incorrect filter. Fix getConversation() to return ALL
messages between two users ordered by created_at ASC.

---

## STEP 2 — Rebuild the thread view component

Find the right panel component in apps/web/app/dashboard/messages/.
Rewrite it to implement the layout described above:

1. Message list area (scrollable, flex-col, overflow-y-auto)
   - Map over messages array
   - For each: determine if sent (sender_id = currentUser.id) or received
   - Render with correct alignment and color
   - Show avatar for received messages (initials fallback)
   - Show timestamp below bubble

2. Auto-scroll to bottom:
   ```typescript
   const bottomRef = useRef<HTMLDivElement>(null)
   useEffect(() => {
     bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
   }, [messages])
   ```

3. Compose area (fixed at bottom):
   - Textarea with onKeyDown handler (Enter to send, Shift+Enter newline)
   - Send button calls sendMessage() via /api/admin or direct packages/db
   - On success: append new message to local state + clear textarea
   - On error: show inline error, do not clear textarea

4. Thread header: show recipient @username + Flag button

---

## STEP 3 — Real-time updates (Supabase Realtime)

When a new message arrives, the thread should update without refresh.

Add a Supabase Realtime subscription on the messages page:
```typescript
supabase
  .channel('messages')
  .on('postgres_changes', {
    event: 'INSERT',
    schema: 'public',
    table: 'direct_messages',
    filter: `recipient_id=eq.${currentUser.id}`
  }, (payload) => {
    // append new message to state if it belongs to open conversation
    setMessages(prev => [...prev, payload.new])
  })
  .subscribe()
```

---

## STEP 4 — Mark messages as read

When a conversation is opened, mark all messages in that conversation
as read and reset the unread count:
- Call markMessagesRead(senderId, currentUserId)
- Update unread_messages_count on user_profiles to 0
- Update sidebar badge

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

- [ ] All messages between two users show in thread (not just one)
- [ ] Messages in chronological order (oldest top, newest bottom)
- [ ] Received messages: left-aligned, cream/white background
- [ ] Sent messages: right-aligned, pomodoro red background, white text
- [ ] Avatar shown on received messages
- [ ] Timestamp shown below each bubble
- [ ] Thread auto-scrolls to bottom on load and new message
- [ ] Compose area fixed at bottom with textarea + Send button
- [ ] Enter key sends message
- [ ] New message appears immediately after send (optimistic)
- [ ] Textarea clears after send
- [ ] Thread header shows recipient @username
- [ ] Supabase Realtime subscription updates thread on new incoming message
- [ ] Opening conversation marks messages as read
- [ ] Unread badge resets on open
- [ ] feature-registry.md updated
- [ ] tsc --noEmit passes
- [ ] Deployed to RPi5
- [ ] Run /wrapup
- [ ] At the end of the session, recap exactly what was completed from
      this prompt, what was left incomplete, and why.
