# ChefsBook — Session 148: Fix Flagging System + AI Moderation Toggle
# Source: Flagging should be report-only for users — only proctor/admin/AI can act
# Target: apps/web + apps/mobile + packages/ai + database

---

## CONTEXT

Read CLAUDE.md, DONE.md, feature-registry.md, and ALL mandatory agents
per SESSION START sequence before touching anything.

The current flagging system incorrectly auto-hides content when users
flag it. This session fixes that and establishes the correct permission
model throughout the entire app.

---

## THE CORRECT PERMISSION MODEL

### Users (regular members):
- CAN: report/flag any recipe, comment, or user
- CAN: choose a reason + add optional comment
- CAN: receive a thank-you confirmation
- CANNOT: hide, remove, or change visibility of any content
- CANNOT: suspend any user
- CANNOT: take any moderation action

### AI Proctor:
- CAN: flag content for human review (same as users)
- CAN (when AI Auto-Moderation is ON): auto-hide/suspend on SERIOUS
  violations only (not mild)
- CANNOT: permanently remove content (human review required)

### Proctors:
- CAN: hide content, warn users, resolve flags
- CAN: escalate to admin for permanent removal

### Admins / Super Admins:
- CAN: all moderation actions (hide, remove, suspend, restore, delete)
- CAN: toggle AI Auto-Moderation setting

---

## PART 1 — Fix: remove all auto-hide on user flag

### 1a — Find and fix every place user flagging triggers content changes

Search the codebase for every handler that processes user flags:
```bash
grep -r "flag\|Flag\|copyright_review_pending\|visibility.*private" \
  apps/web/app/api apps/web/app/dashboard packages/db/src \
  --include="*.ts" --include="*.tsx" -l
```

For each file found, check if it changes content visibility or status
when a USER (not AI, not admin) submits a flag.

Remove ALL automatic visibility changes triggered by user flags:
- Do NOT set visibility = 'private' when user flags
- Do NOT set copyright_review_pending = true automatically
- Do NOT hide comments when user flags them
- Do NOT suspend users when flagged

The ONLY thing that happens on user flag:
1. Insert row into recipe_flags, comment_flags, or user_flags table
2. Create a notification for admins/proctors
3. Return thank-you to the user

### 1b — Fix the copyright flag specifically

In session 147, the copyright flag was spec'd to auto-privatise the
recipe. Remove that behaviour:

```typescript
// WRONG (remove this):
await supabaseAdmin.from('recipes').update({
  visibility: 'private',
  copyright_review_pending: true
}).eq('id', recipeId)

// CORRECT (keep only this):
await supabaseAdmin.from('recipe_flags').insert({
  recipe_id: recipeId,
  flagged_by: userId,
  flag_type: 'copyright',
  reason: userComment
})
// Notify admins — no content change
await createNotification(supabaseAdmin, {
  type: 'admin_flag',
  message: `Recipe flagged for copyright by @${username}`
})
```

### 1c — Remove copyright_review_pending logic from visibility lock

The visibility toggle was being locked when copyright_review_pending = true.
Remove this lock — users should always be able to change their own
recipe visibility unless an ADMIN has explicitly locked it.

The lock should only be set by admin action, not automatically by
a user flag.

---

## PART 2 — Fix the flagging UI

### 2a — Flag/report modal (web + mobile)

Replace any existing flag UI with a clean report modal using pill
buttons + optional comment.

Web and mobile should show the same flow:

```
Report this [recipe / comment / user]

Why are you reporting this?

[© Potentially copyrighted]  [⚠️ Inappropriate]
[🚫 Spam or misleading]      [👤 Impersonation]
[🔞 Adult content]           [📋 Other]

Add more details (optional):
┌─────────────────────────────────┐
│                                 │
└─────────────────────────────────┘

[Cancel]  [Submit Report]
```

- User must select at least one pill before Submit is enabled
- Comment is optional (max 500 chars)
- Submit sends the flag with NO content changes
- After submit: brief thank-you toast:
  "Thanks for your report. We'll review it shortly. ✓"
- The flagged content remains completely unchanged and visible

### 2b — Apply to all three content types

The same flag modal is used for:
- Recipes (flag button in recipe detail → share/options menu)
- Comments (flag button on each comment)
- Users (flag button on user profile page)

Each creates a row in the appropriate flags table:
- recipe_flags
- comment_flags
- user_flags (existing)

### 2c — No visual indicator to content owner

When content is user-flagged:
- The owner sees NOTHING different
- No banners, no notices, no lock icons
- Completely invisible until admin/proctor acts

---

## PART 3 — AI moderation toggle

### 3a — Database

```sql
-- Add AI moderation settings to a system settings table
CREATE TABLE IF NOT EXISTS system_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_by UUID REFERENCES user_profiles(id),
  updated_at TIMESTAMPTZ DEFAULT now()
);

INSERT INTO system_settings (key, value) VALUES
  ('ai_auto_moderation_enabled', 'true'),
  ('ai_auto_moderation_threshold', 'serious')
  ON CONFLICT (key) DO NOTHING;
```

### 3b — Check setting in AI moderation functions

In moderateRecipe(), moderateComment(), and moderateMessage():

```typescript
async function shouldAutoAct(): Promise<boolean> {
  const { data } = await supabaseAdmin
    .from('system_settings')
    .select('value')
    .eq('key', 'ai_auto_moderation_enabled')
    .single()
  return data?.value === 'true'
}

// In moderation functions:
const autoActEnabled = await shouldAutoAct()

if (verdict === 'serious') {
  if (autoActEnabled) {
    // Auto-hide (existing behaviour)
    await hideContent(id)
  } else {
    // Flag only — no auto-hide
    await createAdminFlag(id, 'ai_flagged', 'AI detected serious violation')
  }
}

// Mild verdict: always flag only, never auto-act (regardless of toggle)
if (verdict === 'mild') {
  await createAdminFlag(id, 'ai_flagged_mild', reason)
}
```

### 3c — Admin settings page toggle

On /admin (settings section or dedicated /admin/settings page):

```
AI Auto-Moderation
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
When enabled, AI can automatically hide content and suspend
accounts when it detects serious violations (hate speech,
explicit content, etc.)

When disabled, AI flags content for human review only.
All moderation actions require proctor or admin approval.

[● ON / ○ OFF toggle]

Applies to: recipe imports, comments, direct messages
Threshold: Serious violations only (never mild)

Last changed: [date] by [admin username]
```

Changing the toggle:
- Calls PATCH /api/admin with action: 'update_setting'
- Updates system_settings table
- Logs the change with who toggled it and when

---

## PART 4 — Admin/proctor moderation workflow

### 4a — Flags queue shows ALL pending flags

/admin/flags page shows flags from:
- User reports (recipe_flags, comment_flags, user_flags)
- AI flags (from auto-moderation when serious, or all when toggle is OFF)

Columns:
- Content type (Recipe / Comment / User)
- Content preview (truncated)
- Flag reason
- Flagged by (@username for users, "AI" for AI flags)
- Date
- Status (Pending / Reviewed)
- Actions

### 4b — Admin/proctor actions on flagged content

For each flagged item, admins and proctors can:

**Recipes:**
- Hide (set visibility = 'private', owner notified)
- Remove (permanent — owner gets 30-day appeal window)
- Warn owner (send DM)
- Dismiss flag (no action, mark resolved)

**Comments:**
- Remove comment
- Warn commenter (DM)
- Dismiss flag

**Users:**
- Warn (send DM)
- Suspend (temporary)
- Ban (permanent)
- Dismiss flag

### 4c — Content owner notified only AFTER admin acts

The content owner receives a notification ONLY when an admin or
proctor takes action — not when a user flag is submitted.

Example: admin hides a recipe →
Owner gets DM: "Your recipe '[title]' has been hidden pending review.
You'll receive our decision shortly."

---

## PART 5 — Update CLAUDE.md permission model

Add a clear permission matrix to CLAUDE.md:

```
## Moderation Permission Model
- Users: report only (flag) — no content changes
- AI: flag + auto-act on serious (when AI toggle is ON)
- Proctors: hide, warn, resolve flags
- Admins: all actions including permanent removal
- Super Admins: all actions + system settings

NEVER auto-change content visibility on user flag.
ONLY admins/proctors/AI can change content state.
```

---

## DEPLOYMENT

```bash
ssh rasp@rpi5-eth
cd /mnt/chefsbook/repo
git pull
cd apps/web
rm -rf node_modules/react node_modules/react-dom .next
NODE_OPTIONS=--max-old-space-size=1536 npm run build 2>&1 | tail -20
pm2 restart chefsbook-web
```

---

## COMPLETION CHECKLIST

### Permission model fix
- [ ] All auto-visibility changes on user flag removed
- [ ] Copyright flag no longer auto-privatises recipes
- [ ] Visibility lock removed from user-flag trigger
- [ ] Only admin/proctor actions change content state

### Flagging UI
- [ ] Flag modal has pill buttons (6 reasons)
- [ ] Optional comment field (max 500 chars)
- [ ] Submit only enabled when pill selected
- [ ] Thank-you toast after submit (no content changes)
- [ ] Applied to recipes, comments, and user profiles
- [ ] No visual indicator to content owner after flag

### AI moderation toggle
- [ ] system_settings table created with ai_auto_moderation_enabled
- [ ] moderateRecipe/Comment/Message checks toggle before auto-acting
- [ ] Mild verdicts always flag-only (never auto-act regardless of toggle)
- [ ] Admin settings page shows toggle with clear description
- [ ] Toggle change logged with admin username + timestamp

### Admin workflow
- [ ] Flags queue shows user flags + AI flags unified
- [ ] Admin/proctor actions: hide, remove, warn, dismiss
- [ ] Content owner notified only AFTER admin acts (not on user flag)

### Documentation
- [ ] CLAUDE.md updated with permission matrix
- [ ] feature-registry.md updated
- [ ] tsc --noEmit passes both apps
- [ ] Deployed to RPi5
- [ ] Run /wrapup
- [ ] At the end recap: what was fixed, what auto-actions were removed,
      confirm permission model is correctly enforced.
