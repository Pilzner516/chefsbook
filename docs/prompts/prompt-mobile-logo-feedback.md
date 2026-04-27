# Prompt: Mobile — Restore Feedback/Issue Logging on Logo Tap
# Model: OPUS
# Launch: Read docs/prompts/prompt-mobile-logo-feedback.md and execute fully.
# TYPE: CODE FIX

---

## CONTEXT

Tapping the ChefsBook logo in the mobile app header previously opened a
feedback/issue logging screen where the user could log comments and issues
about the app. A recent change replaced this with a direct link to Settings,
losing the feedback feature entirely.

The fix: tapping the logo opens a bottom sheet or action sheet with TWO options:
1. Go to Settings
2. Log Feedback / Report Issue

Both options must be accessible from the logo tap.

---

## MANDATORY PRE-FLIGHT

Read ALL of these:
- CLAUDE.md
- apps/mobile/CLAUDE.md
- docs/agents/testing.md — ADB screenshots mandatory
- docs/agents/ui-guardian.md

**Codebase audit — read before touching anything:**
- Find the header component where the ChefsBook logo is rendered
  (likely apps/mobile/components/Header.tsx or in the tab layout)
- Find the original feedback/issue logging screen or component
  (search for 'feedback', 'issue', 'report', 'comment' in apps/mobile/)
- Find where Settings navigation was added (recent change)
- Understand how the feedback was previously stored
  (local log? Supabase table? email? find it)

```bash
grep -rn "feedback\|issue\|report\|comment" apps/mobile/app --include="*.tsx" -l
grep -rn "logo\|Logo\|chefsbook\|ChefsBook" apps/mobile/components --include="*.tsx" -l
```

**Launch emulator:**
```bash
emulator -avd Medium_Phone_API_36.1 -no-snapshot -gpu host
```
ADB screenshot of current header state as baseline.

---

## WHAT TO BUILD

### Logo tap behaviour
Tapping the ChefsBook logo opens an **Action Sheet** (bottom sheet):

```
┌─────────────────────────────────┐
│  ⚙️  Settings                   │
│  💬  Log Feedback / Report Issue │
│  ✕   Cancel                     │
└─────────────────────────────────┘
```

Use the existing action sheet / bottom sheet pattern already in the app.
If none exists, use React Native's built-in `ActionSheetIOS` on iOS and
a simple Modal bottom sheet on Android.

### Settings option
- Navigates to the Settings screen exactly as the current logo tap does
- No change to Settings screen itself

### Feedback / Report Issue option
Restore the original feedback logging experience. Read the original
implementation carefully before rebuilding — match it exactly.

If the original feedback screen no longer exists, rebuild it as:

**Feedback Screen / Modal:**
- Title: "Log Feedback"
- Subtitle: "Help us improve ChefsBook"
- Screen/page field: auto-populated with current screen name if detectable,
  otherwise a text input: "Which screen or feature?"
- Type selector: Bug 🐛 | Suggestion 💡 | Praise 🎉
- Description: multiline text input, placeholder "Describe the issue or feedback..."
- Submit button (pomodoro red)
- Cancel button

**On submit:**
- Save to Supabase `user_feedback` table (check if it exists first)
- If table doesn't exist, create migration:
  ```sql
  CREATE TABLE user_feedback (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id),
    type TEXT CHECK (type IN ('bug', 'suggestion', 'praise')),
    screen TEXT,
    description TEXT NOT NULL,
    app_version TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
  );
  ALTER TABLE user_feedback ENABLE ROW LEVEL SECURITY;
  CREATE POLICY "Users can insert own feedback"
    ON user_feedback FOR INSERT
    WITH CHECK (auth.uid() = user_id);
  CREATE POLICY "Admins can read all feedback"
    ON user_feedback FOR SELECT
    USING (EXISTS (SELECT 1 FROM admin_users WHERE user_id = auth.uid()));
  ```
- Show success toast: "Feedback submitted — thank you!"
- Auto-close modal after submit

**Admin visibility:**
- Check if /admin/feedback page exists in apps/web
- If not, add "User Feedback" to the admin sidebar nav
  pointing to a simple list page showing all submitted feedback
  sorted by created_at DESC with: user, type badge, screen, description, date

---

## GUARDRAILS

- Do not change the Settings screen
- Do not change any other header behaviour
- The action sheet must feel native — not a custom popup that looks out of place
- Feedback submission must work offline-gracefully
  (if network fails, show error, keep form open so user doesn't lose text)
- Do not touch web files except for the admin feedback page (if needed)

---

## VERIFICATION

TypeScript:
```bash
cd apps/mobile && npx tsc --noEmit
cd apps/web && npx tsc --noEmit   # only if admin page was added
```

ADB tests with screenshots:
1. Tap ChefsBook logo → action sheet appears with Settings + Feedback options
   → ADB screenshot
2. Tap Settings → navigates to Settings screen ✓ → ADB screenshot
3. Go back, tap logo again → tap Feedback → feedback modal opens ✓
   → ADB screenshot
4. Select "Bug", enter description, tap Submit → success toast → modal closes
   → ADB screenshot
5. psql verify feedback was saved:
   ```bash
   ssh rasp@rpi5-eth "sudo docker exec supabase-db psql -U postgres -d postgres \
     -c 'SELECT type, screen, description, created_at FROM user_feedback
         ORDER BY created_at DESC LIMIT 3;'"
   ```
6. If admin page built: navigate to chefsbk.app/admin/feedback → feedback visible

---

## DEPLOYMENT

Mobile: TypeScript clean + Expo build confirmed
Web (if admin page added): deploy per deployment.md

---

## WRAPUP REQUIREMENT

DONE.md entry (prefix `[SESSION MOBILE-LOGO-FEEDBACK]`) must include:
- ADB screenshot filenames: action sheet, feedback modal, success toast
- Whether user_feedback table already existed or was created (migration number)
- psql output showing submitted test feedback
- Whether admin feedback page was built or already existed
- tsc clean: apps/mobile (and apps/web if changed)
- Build confirmed
