# ChefsBook — Session 69: "Got an Idea?" Feedback Card
# Source: Feature request 2026-04-11
# Target: apps/mobile + apps/web + packages/db

---

## CROSS-PLATFORM REQUIREMENT
Build on BOTH platforms. Read .claude/agents/ui-guardian.md,
.claude/agents/data-flow.md, and .claude/agents/deployment.md before starting.

---

## CONTEXT

A pinned feedback card always appears in position 1 of the recipe list.
Opening it shows a feedback form. Submissions go to Supabase and appear
in the admin dashboard Help Requests section.

Available to all logged-in users (Free and above).

---

## DB CHANGES

The `help_requests` table was created in session 28 (migration 019).
Verify it exists:
```bash
ssh rasp@rpi5-eth
cd /mnt/chefsbook/supabase
docker compose exec db psql -U postgres -d postgres -c "\d help_requests"
```

If it exists, add any missing columns:
```sql
ALTER TABLE help_requests
  ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES user_profiles(id),
  ADD COLUMN IF NOT EXISTS user_email TEXT,
  ADD COLUMN IF NOT EXISTS username TEXT,
  ADD COLUMN IF NOT EXISTS message TEXT NOT NULL,
  ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT now();
```

If the table doesn't exist, create it:
```sql
CREATE TABLE IF NOT EXISTS help_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES user_profiles(id),
  user_email TEXT,
  username TEXT,
  message TEXT NOT NULL,
  status TEXT DEFAULT 'pending',
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE help_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can insert own requests"
  ON help_requests FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Admins can read all requests"
  ON help_requests FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM admin_users WHERE user_id = auth.uid())
    OR user_id = auth.uid()
  );
```

Apply to RPi5.

---

## THE FEEDBACK CARD

### Mobile — recipe list (position 1, always pinned)

The recipe list component fetches recipes from the store. Before rendering
the list, prepend a special feedback card as the first item:

```tsx
const FEEDBACK_CARD = {
  id: 'feedback-card',
  type: 'feedback',  // special type, not a real recipe
};

// In the recipe list:
const items = [FEEDBACK_CARD, ...recipes];
```

Feedback card appearance in the recipe grid/list:
```
┌─────────────────────────────┐
│                             │
│  [ChefsBook chef's hat img] │
│                             │
│  Got an Idea for Us?        │  ← title, bold
│  We'd love to hear from you │  ← subtitle, grey
│                             │
└─────────────────────────────┘
```

- Same card dimensions as recipe cards
- Chef's hat image: use the existing asset at `assets/chefs-hat.png`
- Background: cream `#faf7f0` with a subtle red border `1px solid #ce2b37`
- Title: "Got an Idea for Us?" — 16px bold, dark
- Subtitle: "We'd love to hear from you" — 13px, grey
- Always position 1, cannot be removed or reordered

### Web — recipe dashboard grid (position 1)

Same approach — prepend the feedback card to the recipe grid.
Same visual style adapted for web (Next.js component).

---

## THE FEEDBACK FORM

When user taps/clicks the feedback card, open a bottom sheet (mobile) or
modal (web):

```
┌─────────────────────────────────────────┐
│  Got an Idea for Us?            [✕]    │
│─────────────────────────────────────────│
│                                         │
│  [Chef's hat image — centered, 64px]   │
│                                         │
│  We'd love to hear your thoughts,       │
│  ideas, or suggestions for ChefsBook.   │
│                                         │
│  From: @pilzner (pilzner@email.com)     │  ← pre-filled, read-only
│                                         │
│  ┌─────────────────────────────────┐   │
│  │ Your message                    │   │
│  │                                 │   │
│  │ [textarea — min 4 rows]         │   │
│  │                                 │   │
│  └─────────────────────────────────┘   │
│  0/500 characters                       │
│                                         │
│  ┌─────────────────────────────────┐   │
│  │         Send Feedback           │   │  ← pomodoro red
│  └─────────────────────────────────┘   │
└─────────────────────────────────────────┘
```

### Form fields
- **From:** pre-filled with `@username (email)` — read-only, cannot be edited
- **Message:** textarea, required, max 500 chars, character counter bottom-right
- **Send Feedback:** pomodoro red button, disabled until message > 10 chars

### On submit
1. Disable the Send button, show loading spinner
2. Insert to `help_requests` table:
   ```ts
   await supabase.from('help_requests').insert({
     user_id: currentUser.id,
     user_email: currentUser.email,
     username: currentUser.username,
     message: messageText,
     status: 'pending'
   });
   ```
3. Close the form
4. Show thank-you dialog using `ChefsDialog`:
   ```
   ┌─────────────────────────────────────────┐
   │              🙏                         │
   │  Thanks for your feedback!              │
   │                                         │
   │  We hope you are enjoying ChefsBook.   │
   │  Your ideas help us make it better      │
   │  for everyone.                          │
   │                                         │
   │  [              OK              ]       │
   └─────────────────────────────────────────┘
   ```

### Error handling
If submit fails, show error using `ChefsDialog`:
- "Something went wrong. Please try again."
- Re-enable the Send button

---

## ADMIN DASHBOARD

The help_requests table already connects to the Help Requests section in
the admin dashboard (session 28). Verify submissions appear there after
a test submission. If the admin Help Requests section is not displaying
`help_requests` rows, wire it up now.

---

## APPLY SAFE AREA
Mobile bottom sheet footer (Send button) must use `useSafeAreaInsets().bottom`.

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

Test: submit a feedback message → confirm row in help_requests table:
```bash
docker compose exec db psql -U postgres -d postgres -c \
  "SELECT username, message, status, created_at FROM help_requests ORDER BY created_at DESC LIMIT 3;"
```

---

## COMPLETION CHECKLIST

- [ ] `help_requests` table exists on RPi5 with correct columns
- [ ] Feedback card pinned at position 1 in mobile recipe list
- [ ] Feedback card pinned at position 1 in web recipe grid
- [ ] Card shows chef's hat image, correct title and subtitle
- [ ] Tapping card opens feedback form (bottom sheet mobile, modal web)
- [ ] From field pre-filled with username + email, read-only
- [ ] Textarea with 500 char limit and character counter
- [ ] Send button disabled until message > 10 chars
- [ ] Submission inserts to help_requests table
- [ ] Row confirmed in DB via psql after test submission
- [ ] Thank-you ChefsDialog shown after successful submit
- [ ] Error ChefsDialog shown if submit fails
- [ ] Admin Help Requests section shows the submission
- [ ] Safe area insets on mobile bottom sheet
- [ ] Deployed to RPi5 and verified live on both platforms
- [ ] Run /wrapup to update DONE.md and CLAUDE.md
