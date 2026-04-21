# P-206 — Mobile: QA Notepad Share-to-Admin Feature

## WAVE 2 — Starts only after P-205 /wrapup is complete
## git pull required at session start to pick up P-205's QA Notepad changes

---

## SESSION START

Wait for confirmation that P-205 has completed `/wrapup` and DONE.md has been updated before beginning.

```bash
git pull origin main
```

Read agents in this order:
1. `.claude/agents/wrapup.md`
2. `CLAUDE.md` (full)
3. `DONE.md` — confirm P-205 entries are present
4. `.claude/agents/testing.md` (MANDATORY)
5. `.claude/agents/feature-registry.md` (MANDATORY)
6. `.claude/agents/ui-guardian.md` (MANDATORY)
7. `.claude/agents/navigator.md` (MANDATORY)
8. `.claude/agents/data-flow.md`

Run ALL pre-flight checklists before proceeding.

---

## Context
QA report 4/20/2026 Item 3. The QA Notepad on mobile currently has no way to send its contents to admin. This session adds that share-to-admin capability. P-205 has already moved the Add Item button to a FAB — build on top of that, do not conflict with it.

---

## Pre-Flight Research (required before writing any code)

Locate and read:
- The QA Notepad screen (from `navigator.md` — P-205 updated this)
- The existing feedback/suggestion card flow that already sends messages to admin — this is the reference implementation to match exactly
- The admin page where feedback messages appear

Run on RPi5 to confirm table schema:
```bash
ssh rasp@rpi5-eth "psql postgresql://supabase_admin:<pw>@localhost:5432/postgres -c '\dt' | grep -E 'feedback|message|note'"
```
Then `\d` each relevant table. Understand every column before writing an insert.

---

## Feature: Send QA Notepad Logs to Admin

### Send Button Placement
Add a **Send to Admin** button. It must not conflict with P-205's Add Item FAB. Options in order of preference:
1. Header right button (share/send icon) — cleanest, no overlap risk
2. A second FAB with a distinct icon and position (e.g. top-right corner of screen)

Do not place it where it can be confused with the Add Item FAB.

### Send Flow
1. User taps Send to Admin.
2. `ChefsDialog` confirmation: "Send your QA notes to the ChefsBook team? They'll be able to see your name and follow up if needed." — Confirm / Cancel.
3. On Confirm: submit message to admin (see payload below).
4. Success: toast/popup — "Thanks for your feedback! We really appreciate it. 🙏" — auto-dismiss after 2.5 seconds.
5. Clear the QA Notepad (all entries, local state AND persistent storage) after successful send.
6. On failure: error toast, do NOT clear notepad.

### Message Payload
The admin message must include:
- Prefix: `[QA NOTEPAD]` — so admin can distinguish from regular feedback
- User display name (`user_profiles.full_name` or equivalent)
- Username (`user_profiles.username`)
- User ID
- Timestamp of submission
- Full notepad contents — all items concatenated, each on its own line with a bullet or number

### Admin Destination
Use the EXACT same DB table and insert pattern as the existing feedback card. No new tables. No new admin pages. The `[QA NOTEPAD]` prefix in the message body is the only differentiation.

If the existing feedback flow sends a notification to the user's messaging inbox, replicate that behaviour. If not, do not add it.

### Clear Logic
After successful send, clear:
- All QA notepad entries from local React state
- Any persistent storage (AsyncStorage, FileSystem, or DB — wherever notepad data currently lives)
- The screen should be empty and ready for new entries

---

## Testing Evidence Required

1. psql — confirm sent notes appear with `[QA NOTEPAD]` prefix and correct user info:
```sql
SELECT * FROM <feedback_table> ORDER BY created_at DESC LIMIT 3;
```

2. ADB screenshot — Send to Admin button clearly visible and distinct from Add Item FAB
3. ADB screenshot — ChefsDialog confirmation prompt
4. ADB screenshot — Success toast "Thanks for your feedback!"
5. ADB screenshot — Empty QA Notepad after successful send
6. ADB screenshot — Admin page showing the received QA notes entry

---

## Session Close
```
/wrapup
```
Do not run `/wrapup` until all 6 evidence items above are in hand.

---

## Guardrails
- git pull before starting — must have P-205 changes in tree
- Do NOT change notepad data structure or entry format
- Do NOT create a new admin table
- Do NOT touch web files
- Do NOT modify the existing feedback card flow
- Do NOT conflict with P-205's Add Item FAB placement
- No new Claude API calls
