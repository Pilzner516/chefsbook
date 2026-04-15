# ChefsBook — Session 126: Full Project Audit Report
# Source: Post-sprint quality review (sessions 87-125)
# Target: apps/web + apps/mobile + database + feature-registry.md
# Output: docs/AUDIT-REPORT-2026-04-14.md

---

## CONTEXT

Read CLAUDE.md, DONE.md, feature-registry.md, and ALL mandatory agents
per SESSION START sequence before starting.

This session produces a comprehensive audit report of the entire
ChefsBook project. Do NOT fix anything — document everything.
The report will be reviewed and prioritised before any fixes are actioned.

Output the full report to: docs/AUDIT-REPORT-2026-04-14.md

---

## SECTION 1 — Database Audit

SSH to RPi5 and run the following. Record all results.

```sql
-- 1a. All tables with row counts
SELECT tablename,
  (xpath('/row/cnt/text()',
    query_to_xml('SELECT COUNT(*) AS cnt FROM '||tablename, false, true, ''))
  )[1]::text::int AS row_count
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY tablename;

-- 1b. Recipe health check
SELECT
  COUNT(*) as total,
  COUNT(CASE WHEN description IS NULL OR description = '' THEN 1 END) as missing_description,
  COUNT(CASE WHEN original_submitter_id IS NULL THEN 1 END) as missing_submitter,
  COUNT(CASE WHEN visibility = 'public' THEN 1 END) as public_count,
  COUNT(CASE WHEN visibility = 'private' THEN 1 END) as private_count,
  COUNT(CASE WHEN visibility = 'shared_link' THEN 1 END) as shared_link_count
FROM recipes;

-- 1c. Translation coverage
SELECT language,
  COUNT(*) as total,
  COUNT(CASE WHEN is_title_only = true THEN 1 END) as title_only,
  COUNT(CASE WHEN is_title_only = false THEN 1 END) as full_translations
FROM recipe_translations
GROUP BY language ORDER BY language;

-- 1d. User summary
SELECT
  COUNT(*) as total_users,
  COUNT(CASE WHEN username IS NOT NULL THEN 1 END) as has_username,
  COUNT(CASE WHEN plan_tier = 'free' THEN 1 END) as free,
  COUNT(CASE WHEN plan_tier = 'chef' THEN 1 END) as chef,
  COUNT(CASE WHEN plan_tier = 'pro' THEN 1 END) as pro
FROM user_profiles;

-- 1e. Admin users
SELECT au.role, u.email, up.username
FROM admin_users au
JOIN auth.users u ON u.id = au.user_id
JOIN user_profiles up ON up.id = au.user_id;

-- 1f. Notifications health
SELECT type, COUNT(*) FROM notifications GROUP BY type ORDER BY type;

-- 1g. Direct messages
SELECT COUNT(*) as total_messages,
  COUNT(CASE WHEN is_hidden THEN 1 END) as hidden
FROM direct_messages;

-- 1h. Shopping lists
SELECT COUNT(*) as lists FROM shopping_lists;
SELECT COUNT(*) as items FROM shopping_list_items;

-- 1i. Migration count
SELECT COUNT(*) FROM supabase_migrations;

-- 1j. Reserved usernames
SELECT COUNT(*) as total,
  COUNT(CASE WHEN is_approved THEN 1 END) as approved
FROM reserved_usernames;

-- 1k. Import site tracker
SELECT domain, status, total_attempts, successful_attempts
FROM import_site_tracker ORDER BY total_attempts DESC LIMIT 10;

-- 1l. Comment likes
SELECT COUNT(*) FROM comment_likes;

-- 1m. User flags
SELECT flag_type, COUNT(*),
  COUNT(CASE WHEN is_resolved THEN 1 END) as resolved
FROM user_flags GROUP BY flag_type;
```

---

## SECTION 2 — Feature Registry Audit

Read .claude/agents/feature-registry.md fully.

Produce a status summary table:
| Status | Count |
|--------|-------|
| LIVE | X |
| PARTIAL | X |
| BROKEN | X |

List all PARTIAL and BROKEN features prominently.

For each LIVE feature, spot-check that owner files exist:
```bash
# Check key owner files exist
ls apps/web/app/dashboard/messages/page.tsx
ls apps/web/app/admin/reserved-usernames/page.tsx
ls apps/web/app/api/recipe/*/like/route.ts
ls apps/web/app/api/recipes/translate/route.ts
ls apps/web/app/api/recipes/translate-title/route.ts
ls apps/web/components/OnboardingBubble.tsx
ls apps/mobile/app/\(tabs\)/search.tsx
```

---

## SECTION 3 — Code Quality Audit

```bash
# TypeScript — web
cd apps/web && npx tsc --noEmit 2>&1 | head -30

# TypeScript — mobile
cd apps/mobile && npx tsc --noEmit 2>&1 | head -30

# Lint — web
cd apps/web && npm run lint 2>&1 | head -20

# Hardcoded hex colors (violates theme rules)
grep -r "#ce2b37\|#faf7f0\|#009246" \
  apps/web/app apps/mobile/app \
  --include="*.tsx" --include="*.ts" -l 2>&1 | head -10

# Native confirm/alert (should all be ChefsDialog)
grep -r "window\.confirm\|window\.alert\|Alert\.prompt" \
  apps/web/app apps/mobile/app \
  --include="*.tsx" -l 2>&1

# console.log artifacts
grep -r "console\.log" apps/web/app apps/mobile/app \
  --include="*.tsx" --include="*.ts" | wc -l

# Direct Claude API calls (violates @chefsbook/ai rule)
grep -r "anthropic\|claude-sonnet\|claude-haiku" \
  apps/web/app apps/mobile/app \
  --include="*.tsx" --include="*.ts" -l 2>&1

# supabaseAdmin in client components (security violation)
grep -r "supabaseAdmin" apps/web/app \
  --include="*.tsx" | grep -v "api/" | grep -v "route.ts" | head -10
```

---

## SECTION 4 — AI Cost Audit

Read packages/ai/src/ — list every function that calls Claude API.
Cross-reference with ai-cost.md reference table in CLAUDE.md.

Flag:
- Any function using Sonnet that should use Haiku
- Any function missing from the reference table
- Estimated monthly cost at 100 active users

---

## SECTION 5 — Import Pipeline Audit

Read .claude/agents/import-pipeline.md then verify:

For each import path, check:
1. Does it mandate a description? (PASS/FAIL)
2. Does it trigger title translation? (PASS/FAIL)
3. Does it call moderateRecipe()? (PASS/FAIL)

Import paths to check:
- URL import
- Photo scan
- Speak a recipe
- Instagram import
- File import (PDF/Word/CSV)
- Bookmark batch import
- YouTube import

---

## SECTION 6 — Security Audit

```bash
# Hardcoded secrets
grep -r "re_\|sk-ant\|eyJhbGc" apps/ packages/ \
  --include="*.ts" --include="*.tsx" --include="*.js" \
  --exclude-dir=node_modules -l 2>&1

# supabaseAdmin in client components (already checked above — repeat)
grep -r "supabaseAdmin" apps/web/app \
  --include="*.tsx" | grep -v "api/" | grep -v "route.ts"

# Admin routes protection
grep -r "admin_users\|isAdmin\|checkAdmin" \
  apps/web/app/api/admin/ --include="*.ts" | head -5
```

Check:
1. Is SUPABASE_SERVICE_ROLE_KEY ever in client-side code?
2. Are all /api/admin/* routes verifying admin JWT?
3. Is the image proxy correctly restricted to Supabase URLs only?
4. Is GOTRUE_MAILER_AUTOCONFIRM still true? (document as known risk)

---

## SECTION 7 — Known Gaps Summary

Read CLAUDE.md Known Issues section.
List all documented known gaps with their session origin.

Also identify gaps NOT yet in CLAUDE.md:
- Mobile recipe list translated titles (session 125 gap)
- Mobile recipe detail translation + "Hang tight" banner (session 125 gap)
- Mobile like notifications (session 124 gap)
- Bookmark batch import title translation (session 125 gap)
- AI impersonation check on signup (session 110 gap)
- data-onboard attributes on remaining pages (session 120 gap)

---

## SECTION 8 — Performance Snapshot

```bash
# Next.js build output sizes
ssh rasp@rpi5-eth
cd /mnt/chefsbook/repo/apps/web
NODE_OPTIONS=--max-old-space-size=1024 npm run build 2>&1 | \
  grep -E "Route|Size|First Load" | head -30

# PM2 memory usage
pm2 list
```

---

## REPORT FORMAT

Structure docs/AUDIT-REPORT-2026-04-14.md as:

```markdown
# ChefsBook Audit Report
# Date: 2026-04-14
# Sessions covered: 87–125

## Executive Summary
[5 bullet points of most critical findings]

## 🔴 Critical Issues (fix immediately)
## 🟡 Known Gaps (important, scheduled)
## 🟢 Passing Checks
## Section 1: Database Health
## Section 2: Feature Registry
## Section 3: Code Quality
## Section 4: AI Cost
## Section 5: Import Pipeline
## Section 6: Security
## Section 7: Known Gaps Consolidated
## Section 8: Performance
## Recommended Fix Priority (ordered list)
```

---

## COMPLETION CHECKLIST

- [ ] All 8 sections completed with real data from RPi5
- [ ] Report written to docs/AUDIT-REPORT-2026-04-14.md
- [ ] No fixes applied — audit only
- [ ] Committed: git add docs/AUDIT-REPORT-2026-04-14.md && git commit
- [ ] Run /wrapup
- [ ] At the end of the session, recap exactly what was completed from
      this prompt, what was left incomplete, and why.
