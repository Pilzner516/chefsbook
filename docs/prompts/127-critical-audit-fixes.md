# ChefsBook — Session 127: Fix Critical Audit Findings
# Source: Audit report docs/AUDIT-REPORT-2026-04-14.md
# Target: apps/web + database
# Priority: CRITICAL — fix before any other work

---

## CONTEXT

Read CLAUDE.md, DONE.md, feature-registry.md, and ALL mandatory agents
per SESSION START sequence before touching anything.

The audit identified two critical security/data issues that must be
fixed immediately. Do not work on anything else until both are resolved.

---

## CRITICAL FIX 1 — plan_tier DB enum missing 'chef' value

The plan_tier column on user_profiles uses a DB enum (or check
constraint) that is missing the 'chef' value. This means:
- Users on the Chef plan may have invalid data
- Plan upgrades to Chef may silently fail or error

### Diagnose
```sql
-- Check the current constraint or enum
SELECT column_name, data_type, udt_name
FROM information_schema.columns
WHERE table_name = 'user_profiles'
AND column_name = 'plan_tier';

-- Check existing constraint
SELECT conname, consrc
FROM pg_constraint
WHERE conrelid = 'user_profiles'::regclass
AND conname LIKE '%plan%';

-- Check what values exist
SELECT plan_tier, COUNT(*) FROM user_profiles GROUP BY plan_tier;
```

### Fix
If it's a CHECK constraint missing 'chef':
```sql
-- Drop old constraint and add new one with 'chef'
ALTER TABLE user_profiles
  DROP CONSTRAINT IF EXISTS user_profiles_plan_tier_check;

ALTER TABLE user_profiles
  ADD CONSTRAINT user_profiles_plan_tier_check
  CHECK (plan_tier IN ('free', 'chef', 'family', 'pro'));
```

If it's a ENUM type:
```sql
ALTER TYPE plan_tier_enum ADD VALUE IF NOT EXISTS 'chef';
```

Verify after:
```sql
-- Should work without error
UPDATE user_profiles SET plan_tier = 'chef'
WHERE username = 'seblux';
-- Then restore
UPDATE user_profiles SET plan_tier = 'pro'
WHERE username = 'seblux';
```

---

## CRITICAL FIX 2 — Image proxy open redirect at /api/image

The image proxy at /api/image?url= must ONLY proxy Supabase storage
URLs and known safe domains. If it proxies any URL, an attacker can:
- Use your server as a proxy for malicious content
- Leak server IP/credentials
- Serve malicious images to your users

### Diagnose
Read apps/web/app/api/image/route.ts — check the current URL validation.

### Fix
The proxy must strictly validate the URL before fetching:

```typescript
const ALLOWED_HOSTS = [
  '100.110.47.62',          // RPi5 Supabase direct
  'api.chefsbk.app',        // Cloudflare tunnel
  'img.logo.dev',           // Store logos
  'images.pexels.com',      // Pexels photos
  'photos.pexels.com',      // Pexels photos alt domain
]

function isAllowedUrl(url: string): boolean {
  try {
    const parsed = new URL(url)
    return ALLOWED_HOSTS.some(host => parsed.hostname === host ||
      parsed.hostname.endsWith('.' + host))
  } catch {
    return false
  }
}

// In the route handler:
if (!isAllowedUrl(url)) {
  return new Response('Forbidden', { status: 403 })
}
```

Verify: attempt to proxy an external URL and confirm 403 is returned.
```bash
curl -I "https://chefsbk.app/api/image?url=https://google.com/image.jpg"
# Must return 403
```

---

## ADDITIONAL FIXES FROM AUDIT

### Fix 3 — 15 recipes missing description

```sql
-- Find recipes with missing description
SELECT id, title, source_url
FROM recipes
WHERE description IS NULL OR description = ''
ORDER BY created_at;
```

For each recipe with a source_url: call importFromUrl() to re-fetch
and extract description, or use Claude to generate one from the title
and ingredients.

For recipes without source_url: generate a brief 1-2 sentence
description using Claude Haiku from title + cuisine + ingredients.

Create a one-time script: scripts/backfill-descriptions.js

### Fix 4 — supabaseAdmin in 2 admin server components

Find the 2 admin server components that still import supabaseAdmin
directly (identified in audit). Move their queries to /api/admin
route following the session 109 pattern.

### Fix 5 — Web scan page missing isInstagramUrl check

The audit found the web scan page doesn't check isInstagramUrl()
before processing. Add the check:
```typescript
if (isInstagramUrl(url)) {
  // route to Instagram import handler
  return handleInstagramImport(url)
}
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

Note: build now requires 1536MB (updated from 1024MB per session 113).

---

## COMPLETION CHECKLIST

- [ ] plan_tier constraint confirmed and fixed to include 'chef'
- [ ] Chef plan upgrade works without DB error
- [ ] Image proxy returns 403 for non-allowlisted URLs
- [ ] curl test confirms 403 for external URL
- [ ] 15 missing descriptions backfilled
- [ ] supabaseAdmin removed from 2 admin server components
- [ ] Web scan page has isInstagramUrl check
- [ ] feature-registry.md updated
- [ ] tsc --noEmit passes
- [ ] Deployed to RPi5 with NODE_OPTIONS=--max-old-space-size=1536
- [ ] Run /wrapup
- [ ] At the end of the session, recap exactly what was completed from
      this prompt, what was left incomplete, and why.
