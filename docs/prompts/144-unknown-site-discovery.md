# ChefsBook — Session 144: Unknown Site Discovery Flow
# Source: Feature request — when users import from unknown sites, thank them
#         and add the site to the review queue
# Target: apps/web + apps/mobile + packages/db + admin

---

## CONTEXT

Read CLAUDE.md, DONE.md, feature-registry.md, import-pipeline.md,
and import-quality.md before touching anything.

When a user imports from a site NOT in the import_site_tracker,
ChefsBook should:
1. Attempt the import as normal
2. Log the new domain as a discovery
3. Show the user a warm, grateful message
4. Queue the site for admin review and future testing

---

## STEP 1 — Detect unknown sites in the import flow

In the URL import handler (apps/web/app/api/import/url/route.ts),
after extracting the domain:

```typescript
// Check if site is known
const { data: siteData } = await supabaseAdmin
  .from('import_site_tracker')
  .select('domain, rating, is_blocked')
  .eq('domain', domain)
  .single()

const isKnownSite = !!siteData
const isBlocked = siteData?.is_blocked ?? false
const hasIssues = siteData?.rating <= 2

// If unknown: add to discovery queue
if (!isKnownSite) {
  await supabaseAdmin.from('import_site_tracker').insert({
    domain,
    status: 'unknown',
    total_attempts: 1,
    successful_attempts: 0, // updated after import completes
    notes: 'Discovered via user import',
    auto_test_enabled: true,
  }).onConflict('domain').merge({ total_attempts: 1 })

  // Flag as newly discovered for the response
  isNewDiscovery = true
}
```

---

## STEP 2 — Add discovery_queue table

Add to migration 037:

```sql
ALTER TABLE import_site_tracker
  ADD COLUMN IF NOT EXISTS is_user_discovered BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS discovery_count INT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS first_discovered_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS review_status TEXT DEFAULT 'pending'
    CHECK (review_status IN ('pending', 'reviewed', 'added_to_list', 'ignored'));

-- Mark existing sites as known (not user-discovered)
UPDATE import_site_tracker
SET is_user_discovered = false
WHERE is_user_discovered IS NULL;
```

When a new domain is discovered:
```sql
INSERT INTO import_site_tracker
  (domain, status, is_user_discovered, discovery_count,
   first_discovered_at, review_status, auto_test_enabled)
VALUES
  ($domain, 'unknown', true, 1, now(), 'pending', true)
ON CONFLICT (domain) DO UPDATE SET
  discovery_count = import_site_tracker.discovery_count + 1,
  total_attempts = import_site_tracker.total_attempts + 1;
```

---

## STEP 3 — User-facing discovery message

### Web — after import completes or partially completes

If `isNewDiscovery = true`, append to the import result response:

```typescript
discoveryMessage: isNewDiscovery ? {
  isNew: true,
  message: "You've helped ChefsBook discover something new!",
  subMessage: "We hadn't seen this site before. We've added it to our list and will test it soon to make sure future imports work perfectly."
} : null
```

Show in the web import UI as a warm toast or inline card:

```
🎉 New discovery!
You've helped ChefsBook discover something new!
We hadn't seen [domain] before. We'll test it soon
and make sure future imports work even better.
Thank you for expanding our recipe world! 🌍
```

Style: cream background, basil green left border, warm tone.
Appears AFTER the main import result (recipe saved or error shown).
Auto-dismisses after 6 seconds or user taps X.

### Mobile — same message as a ChefsDialog or toast

On mobile, show as a brief bottom toast (not a blocking dialog):
- Green checkmark icon
- "New discovery! We've added [domain] to our list 🌍"
- Auto-dismisses after 4 seconds

---

## STEP 4 — Track discovery in import_attempts

In logImportAttempt(), add:
```typescript
is_new_discovery: !isKnownSite
```

Add column to import_attempts:
```sql
ALTER TABLE import_attempts
  ADD COLUMN IF NOT EXISTS is_new_discovery BOOLEAN DEFAULT false;
```

---

## STEP 5 — Admin: User Discoveries section

On /admin/import-sites, add a new tab or section:
**"New Discoveries"** — sites found by users that haven't been
reviewed yet (is_user_discovered = true AND review_status = 'pending').

Table columns:
- Domain
- Discovery count (how many users have tried this site)
- First discovered (date)
- Last import success/fail
- Actions:
  - "Add to test list" → sets review_status = 'added_to_list',
    queues for next compatibility test run
  - "Ignore" → sets review_status = 'ignored'
  - "Block" → sets is_blocked = true

Sort by discovery_count DESC — most-tried unknown sites first.
These are your highest-priority sites to test and add officially.

Show a badge on the admin sidebar "Import Sites" link with the
count of pending discoveries.

---

## STEP 6 — Auto-test newly discovered sites

When a site is first discovered by a user AND the import succeeds
(rating ≥ 3 based on completeness), automatically:
1. Set its rating based on the completeness check
2. Set review_status = 'added_to_list'
3. No manual admin review needed for successful imports

When import fails or is incomplete:
1. Keep review_status = 'pending'
2. Admin sees it in the New Discoveries queue
3. Admin decides whether to add to official list or ignore

---

## STEP 7 — Weekly test includes new discoveries

In the weekly site compatibility test script, after testing
KNOWN_RECIPE_SITES, also test any sites where:
- is_user_discovered = true
- review_status = 'added_to_list'
- auto_test_enabled = true

This ensures user-discovered sites get the same ongoing monitoring
as officially listed sites.

---

## STEP 8 — Personalised thank you tracking

Add a small gamification element — track how many new sites
each user has discovered:

```sql
ALTER TABLE user_profiles
  ADD COLUMN IF NOT EXISTS sites_discovered_count INT DEFAULT 0;

-- Trigger: increment when a new discovery is attributed to a user
```

Show on the user's settings/stats page (alongside import activity
from session 141):
```
🌍 Sites you've helped discover: 3
```

Clicking shows which sites they discovered and their current status
("Testing in progress", "Now fully supported", "Under review").

---

## DEPLOYMENT

```bash
ssh rasp@rpi5-eth

# Apply migration 037
psql -U postgres -d postgres \
  -f /mnt/chefsbook/repo/supabase/migrations/037_site_discovery.sql
docker restart supabase-rest

cd /mnt/chefsbook/repo
git pull
cd apps/web
rm -rf node_modules/react node_modules/react-dom .next
NODE_OPTIONS=--max-old-space-size=1536 npm run build 2>&1 | tail -20
pm2 restart chefsbook-web
```

---

## COMPLETION CHECKLIST

- [ ] Migration 037 applied (discovery columns on import_site_tracker
      and import_attempts, sites_discovered_count on user_profiles)
- [ ] Unknown site detection in URL import handler
- [ ] New domain auto-inserted to import_site_tracker on first discovery
- [ ] Web: discovery toast/card shown after import from unknown site
- [ ] Mobile: discovery toast shown (auto-dismiss 4 seconds)
- [ ] logImportAttempt includes is_new_discovery flag
- [ ] Admin /admin/import-sites: "New Discoveries" tab/section
- [ ] Admin: discovery count, first seen date, add/ignore/block actions
- [ ] Admin sidebar badge showing pending discovery count
- [ ] Auto-test of user-discovered sites in weekly run
- [ ] Successful unknown imports auto-rated and added to list
- [ ] User settings: "Sites you've helped discover: N" stat
- [ ] feature-registry.md updated
- [ ] tsc --noEmit passes both apps
- [ ] Deployed to RPi5
- [ ] Run /wrapup
- [ ] At the end, recap what was completed, what was left incomplete,
      and why.
