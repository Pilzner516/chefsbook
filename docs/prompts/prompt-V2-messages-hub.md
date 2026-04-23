# Prompt V2 — Merged Admin Messages Hub + Expelled Content Feed Filtering
## Scope: apps/web (admin messages, search, What's New, Following feeds)

---

## AGENTS TO READ FIRST (in order)
1. `.claude/agents/wrapup.md`
2. `CLAUDE.md`
3. `DONE.md`
4. `.claude/agents/testing.md`
5. `.claude/agents/feature-registry.md`
6. `.claude/agents/deployment.md`
7. `.claude/agents/ui-guardian.md`
8. `.claude/agents/data-flow.md`

Run ALL pre-flight checklists before writing a single line of code.

Read Prompt V in DONE.md — this session completes what V deferred.

Find these existing admin pages and read them fully:
- Admin Flagged Recipes page
- Admin Flagged Comments page  
- Admin Messages page (flagged messages)
- Admin sidebar layout

Inspect:
```sql
SELECT table_name FROM information_schema.tables 
WHERE table_name LIKE '%message%';
\d user_profiles  -- verify account_status column exists from V
```

---

## FIX 1 — Expelled users' content hidden from public feeds

### Problem
Prompt V filters expelled users on detail pages only. Their recipes
still appear in:
- Search results
- What's New tab
- Following tab
- My Recipes (saved recipes from expelled users)
- Recipe cards on any public page

### Fix
In every query that returns recipes/techniques to non-admin users,
add a JOIN to exclude expelled owners:

**Search query** (`apps/web/app/dashboard/search/page.tsx` or API):
```sql
JOIN user_profiles up ON up.id = r.user_id
WHERE up.account_status != 'expelled'
```

**listRecipes() for dashboard** — same filter

**What's New hot score query** — same filter

**Following tab query** — same filter

**My Recipes (saved recipes)** — if the owner is expelled, hide
the recipe even from users who saved it. Add expelled filter to
the saved recipes query.

**Techniques** — same filters on any technique list/search query.

**Admin bypass** — admins see all content regardless of account_status.
Add `OR current_user_is_admin` condition to all filters.

---

## FEATURE 2 — Merged Admin Messages & Flags Hub

### Replace three separate admin pages with one unified page

Current separate pages:
- `/admin/flagged-recipes` — Flagged Recipes
- `/admin/flagged-comments` — Flagged Comments  
- `/admin/messages` — Flagged Messages

**New unified page:** `/admin/messages` (reuse the URL)

Four tabs:

### Tab 1: Flagged Recipes
Move ALL content from existing `/admin/flagged-recipes` page here.
Identical functionality — no changes to the UI or logic.
Just embedded as a tab component.

### Tab 2: Flagged Comments
Move ALL content from existing `/admin/flagged-comments` page here.
Identical functionality.

### Tab 3: Flagged Messages
Move ALL content from existing flagged messages view here.
Identical functionality.

### Tab 4: Admin Inbox (new)
A unified inbox for direct admin communications.

**What appears here:**
- Messages tagged `account_restriction_inquiry` (from suspended/expelled users via "Message Support")
- Messages sent directly from admin to users (from Users page)
- Replies to any admin-initiated message
- Any message where sender or recipient is an admin user

**Layout:**
- Left panel: conversation list
  - Sender username + avatar initial
  - Subject/tag label
  - Date
  - Unread badge (bold if unread)
- Right panel: full conversation thread when selected
  - Message bubbles (sent/received style)
  - Admin reply input at bottom
  - Send button

**Filter bar above conversation list:**
- All | account_restriction_inquiry | Direct messages

**Unread count:**
Show badge on "Admin Inbox" tab when there are unread messages.
A message is "read" when the admin opens the conversation.

**Mark as read:**
When admin opens a conversation, mark all messages in it as read.
Add `read_by_admin BOOLEAN DEFAULT FALSE` to messages table if
not already present.

### Tab badge counts
Each tab shows a count badge:
- Flagged Recipes: count of pending flags
- Flagged Comments: count of pending flagged comments
- Flagged Messages: count of pending flagged messages
- Admin Inbox: count of unread conversations

### Admin sidebar navigation
Find the current admin sidebar. It has separate nav items for:
- Flagged Comments
- Flagged Recipes
- Messages

Replace all three with a single **"Messages & Flags"** nav item
linking to `/admin/messages`.

The badge on this nav item shows the TOTAL count across all tabs
(pending flags + unread inbox messages).

Add redirects so old URLs go to the new page:
- `/admin/flagged-recipes` → `/admin/messages?tab=recipes`
- `/admin/flagged-comments` → `/admin/messages?tab=comments`

---

## IMPLEMENTATION ORDER
1. FIX 1 — Expelled content filter in search query
2. FIX 1 — Expelled content filter in What's New query
3. FIX 1 — Expelled content filter in Following query
4. FIX 1 — Expelled content filter in My Recipes saved recipes query
5. FIX 1 — Expelled content filter in techniques queries
6. FEATURE 2 — Build merged `/admin/messages` page with 4 tabs
7. FEATURE 2 — Migrate flagged recipes tab content
8. FEATURE 2 — Migrate flagged comments tab content
9. FEATURE 2 — Migrate flagged messages tab content
10. FEATURE 2 — Build Admin Inbox tab
11. FEATURE 2 — Update admin sidebar nav (3 items → 1)
12. FEATURE 2 — Add redirects for old URLs
13. TypeScript check: `cd apps/web && npx tsc --noEmit` — must be clean
14. Deploy per `deployment.md`

---

## GUARDRAILS
- Admin always sees expelled users' content — never filter for admins
- The merged page must preserve 100% of existing flagged content
  functionality — nothing removed, just reorganised
- Old admin URLs must redirect, not 404
- Do NOT delete old page files until redirects are verified working
- read_by_admin column: only add if messages table doesn't already
  have an equivalent column

---

## REGRESSION CHECKS — MANDATORY
1. Expelled user's recipes NOT visible in search results ✓
2. Expelled user's recipes NOT in What's New or Following ✓
3. Expelled user's saved recipes NOT in savers' My Recipes ✓
4. Admin CAN see expelled users' content ✓
5. Non-expelled users unaffected — recipes still show normally ✓
6. `/admin/messages` loads with all 4 tabs ✓
7. Flagged Recipes tab works identically to old page ✓
8. Flagged Comments tab works identically to old page ✓
9. Flagged Messages tab works identically to old page ✓
10. Admin Inbox shows account_restriction_inquiry messages ✓
11. Admin can reply from Inbox ✓
12. Old URLs redirect correctly (no 404) ✓
13. Admin sidebar shows single "Messages & Flags" item ✓
14. My Recipes images still show ✓
15. Search page still works ✓

---

## WRAPUP REQUIREMENT
DONE.md entry must include:
- List of all queries updated with expelled filter
- Confirmation admin bypass works
- New admin messages page route path
- Old URL redirects confirmed
- All 15 regression checks confirmed
- tsc clean + deploy confirmed
