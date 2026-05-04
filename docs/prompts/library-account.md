# Prompt: ChefsBook Library Account — @souschef Official Recipe Library

## LAUNCH PROMPT (paste this into Claude Code to start the session)

```
/autopilot "Read and execute docs/prompts/library-account.md fully and autonomously from pre-flight through deployment and wrapup. Do not stop for questions unless you hit a genuine blocker."
```

> **Before launching:** Run `/oh-my-claudecode:hud setup` for live observability.

---

## TYPE: FEATURE — WEB ONLY
## OMC MODE: autopilot (DB migration + admin UI + badge display)

## Overview

Create a special **ChefsBook Library** account with the username `@souschef`.
This account is the official home for curated recipe collections imported by the
ChefsBook team (e.g. The Food Lab, Charlie Trotter, etc.).

- Any user can view `@souschef`'s public profile and follow it
- Recipes imported under `@souschef` appear in public feeds, are saveable by
  all users, and show a verified library badge
- Only `super_admin` users can manage library accounts or generate import tokens
- The import token for `@souschef` replaces `CHEFSBOOK_IMPORT_TOKEN` in the
  Food Lab import script with `CHEFSBOOK_LIBRARY_TOKEN`

---

## Agent files to read — ALL of these, in order, before writing a single line of code

- `.claude/agents/wrapup.md`
- `.claude/agents/testing.md`
- `.claude/agents/feature-registry.md`
- `.claude/agents/ui-guardian.md`
- `.claude/agents/data-flow.md`
- `.claude/agents/deployment.md`
- `.claude/agents/ai-cost.md`

Run ALL pre-flight checklists before writing any code.

---

## OMC agent routing

| Task | Agent | Model |
|------|-------|-------|
| Pre-flight + agent reading | architect | opus |
| DB migration | coder | sonnet |
| Create @souschef account | coder | sonnet |
| Admin UI (library accounts page) | coder | sonnet |
| Badge component (web) | coder | sonnet |
| Food Lab prompt update | coder | haiku |
| TypeScript check + deployment | coder | sonnet |
| Verification queries | coder | haiku |
| Wrapup | architect | sonnet |

---

## Pre-flight: before writing any code

1. Confirm next migration number from DONE.md — expected **080**.
2. Read existing `user_profiles` schema:
   ```bash
   ssh pilzner@slux "docker exec supabase-db psql -U postgres -c '\d user_profiles'"
   ```
3. Read `admin_users` schema to confirm `role` column and `super_admin` value.
4. Check `reserved_usernames` table — confirm `souschef` is not already reserved
   or already taken as a username:
   ```bash
   ssh pilzner@slux "docker exec supabase-db psql -U postgres -c \
     \"SELECT * FROM reserved_usernames WHERE username = 'souschef';\""
   ssh pilzner@slux "docker exec supabase-db psql -U postgres -c \
     \"SELECT id, username FROM user_profiles WHERE username = 'souschef';\""
   ```
5. Read existing admin panel patterns at `apps/web/app/admin/` — match the
   established layout, auth pattern, and nav structure exactly.
6. Read `apps/web/app/api/admin/users/[id]/` for the admin API route pattern.

---

## Part 1 — Database migration (Migration 080)

File: `supabase/migrations/20260504_080_library_accounts.sql`

```sql
-- Add account_type to user_profiles
ALTER TABLE user_profiles
  ADD COLUMN IF NOT EXISTS account_type TEXT NOT NULL DEFAULT 'user'
    CHECK (account_type IN ('user', 'library'));

-- Add verified flag (library accounts are always verified)
ALTER TABLE user_profiles
  ADD COLUMN IF NOT EXISTS is_verified BOOLEAN NOT NULL DEFAULT FALSE;

-- Library account import tokens
-- Allows super_admins to generate long-lived tokens for library accounts
-- without sharing the account password
CREATE TABLE IF NOT EXISTS library_account_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  -- SHA-256 hash of the actual token — token is shown once and never stored
  description TEXT NOT NULL DEFAULT 'Import token',
  created_by UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_used_at TIMESTAMPTZ,
  is_active BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE INDEX idx_library_tokens_user_id ON library_account_tokens(user_id);
CREATE INDEX idx_library_tokens_hash ON library_account_tokens(token_hash);

-- Super admin only — no public access
ALTER TABLE library_account_tokens ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Super admins only" ON library_account_tokens
  USING (
    EXISTS (
      SELECT 1 FROM admin_users
      WHERE admin_users.user_id = auth.uid()
      AND admin_users.role = 'super_admin'
    )
  );

-- Reserve the 'souschef' username
INSERT INTO reserved_usernames (username, approved_for_user_id)
VALUES ('souschef', NULL)
ON CONFLICT (username) DO NOTHING;
```

After applying: `docker restart supabase-rest`

---

## Part 2 — Create the @souschef account

Use the Supabase admin API (service role) to create the account programmatically.
Write a one-off script at `scripts/create-souschef-account.mjs`:

```
Email:        library@chefsbk.app  (internal, not publicly visible)
Password:     generate a strong random password, log it once to stdout,
              store it in .env.local as SOUSCHEF_ACCOUNT_PASSWORD
Username:     souschef
Display name: ChefsBook Library
Bio:          The official ChefsBook recipe library. Curated collections from
              the world's best cookbooks.
account_type: library
is_verified:  true
plan_tier:    pro  (library account needs full import capability)
```

The script should:
1. Call Supabase Admin Auth API to create the user
2. Insert/update `user_profiles` with the above fields
3. Remove `souschef` from `reserved_usernames` `approved_for_user_id = NULL`
   and set it to the new user's ID (so it's locked to this account)
4. Print the generated password once — the operator saves it to `.env.local`

Run: `node scripts/create-souschef-account.mjs`

Do NOT commit passwords. Add `SOUSCHEF_ACCOUNT_PASSWORD` to `.env.example`
with a placeholder comment.

---

## Part 3 — Admin UI: Library Accounts page

### Route: `/admin/library-accounts`

Super admin only — gate with the existing admin auth pattern.
Add to the admin sidebar nav under a "Accounts" section.

**Page layout:**

Show one card per library account (initially just `@souschef`):
- Avatar, display name, `@username`, bio
- Stats: recipe count, follower count, created date
- "View Profile →" link to public profile

**Import Tokens section** (per account):

Table columns: Description · Created · Last Used · Status (Active/Revoked) · Actions

Actions:
- **Generate Token** — modal with:
  - Description input (e.g. "Food Lab import — May 2026")
  - On confirm: generate a cryptographically random 64-char token, show it
    **once** in a copy-to-clipboard modal with a warning:
    "Save this token now — it cannot be shown again."
    Store only the SHA-256 hash in `library_account_tokens`.
- **Revoke** — sets `is_active = false`, confirms with "Revoke token?" dialog

**Token generation API:**

```
POST /api/admin/library-accounts/[userId]/tokens
→ { token }   (plain token, returned once — caller must save it)

DELETE /api/admin/library-accounts/[userId]/tokens/[tokenId]
→ { ok: true }
```

Both routes: super_admin only, use `supabaseAdmin`.

**Token authentication:**

The import script sends `Authorization: Bearer <token>`. The import route
(`/api/import/url`) must be updated to also accept library account tokens:

1. Try standard Supabase JWT auth first (existing behaviour — unchanged)
2. If JWT auth fails, check `library_account_tokens` where
   `token_hash = SHA256(bearer_token)` AND `is_active = true`
3. If found: update `last_used_at`, set `userId` to the token's `user_id`,
   proceed as that user
4. If neither: return 401

This means the import script can use a library token without needing a full
Supabase JWT session.

---

## Part 4 — Library badge component

Create `components/LibraryBadge.tsx` (web):

```tsx
// Small pill badge shown next to @souschef username everywhere
// Shows: 📚 Library  (or use a book SVG icon to avoid emoji)
// Style: matches the existing plan badge style, amber/gold accent
```

Apply the badge wherever usernames are displayed:
- Recipe card attribution
- Recipe detail page attribution row
- User profile header
- Search results (user results)
- Follower/following lists

Gate the badge on `user_profiles.account_type === 'library'` — do not hardcode
the username. Any future library account gets the badge automatically.

---

## Part 5 — Update food-lab-import.md prompt

In `docs/prompts/food-lab-import.md`, make these changes:

1. Replace all references to `CHEFSBOOK_IMPORT_TOKEN` with `CHEFSBOOK_LIBRARY_TOKEN`

2. Update the BLOCKER CHECK in Pre-flight to read:
   ```
   BLOCKER — Library token: Check .env.local for CHEFSBOOK_LIBRARY_TOKEN.
   Get this from /admin/library-accounts → @souschef → Generate Token.
   Add description "Food Lab import — [month year]" when generating.
   ```

3. Add a note at the top of Phase 2:
   ```
   All recipes imported in this session will be attributed to @souschef
   (ChefsBook Library). Recipes are created as public visibility so all
   ChefsBook users can discover and save them.
   ```

4. Add `"visibility": "public"` to the Phase 2 import request body.

---

## Testing

```bash
# Confirm migration applied
ssh pilzner@slux "docker exec supabase-db psql -U postgres -c \
  \"SELECT account_type, is_verified, username, display_name \
    FROM user_profiles WHERE username = 'souschef';\""

# Confirm library_account_tokens table exists
ssh pilzner@slux "docker exec supabase-db psql -U postgres -c \
  \"SELECT COUNT(*) FROM library_account_tokens;\""

# Confirm souschef reserved
ssh pilzner@slux "docker exec supabase-db psql -U postgres -c \
  \"SELECT username, approved_for_user_id FROM reserved_usernames \
    WHERE username = 'souschef';\""
```

**Web UI verification:**
- `/admin/library-accounts` loads for super_admin, redirects for non-admin
- Generate Token flow: token shown once, hash stored in DB, description saved
- Revoke: sets `is_active = false`, token no longer authenticates
- Library badge visible on `@souschef` profile page and recipe attributions
- Non-admin cannot access `/admin/library-accounts` (401/redirect)
- No console errors throughout

**Token auth verification:**
- Generate a library token from admin UI
- `curl -X POST http://localhost:3000/api/import/url \`
  `-H "Authorization: Bearer <library_token>" \`
  `-d '{"url":"https://www.seriouseats.com/..."}'`
- Confirm recipe created under `@souschef` account

---

## Deploy

Follow `deployment.md`. Deploy web to slux.
Apply migration 080 to slux DB before deploying.
Run regression smoke test from `testing.md` before wrapup.

---

## Wrapup

Follow `wrapup.md` fully. Log in DONE.md:

- Migration 080 applied
- @souschef account created (email: library@chefsbk.app)
- `SOUSCHEF_ACCOUNT_PASSWORD` added to .env.local on slux
- Library badge component created and applied
- `/admin/library-accounts` page live
- `food-lab-import.md` updated to use `CHEFSBOOK_LIBRARY_TOKEN`

Add to AGENDA.md:
- [ ] Upload avatar for @souschef (book/chef icon)
- [ ] Write public bio for @souschef profile
- [ ] Pin @souschef profile to discovery/explore page
