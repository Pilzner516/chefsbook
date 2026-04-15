# ChefsBook — Session 78: Fix "Database error querying schema" on Sign-in
# Source: QA screenshot 2026-04-11
# Target: RPi5 Supabase

---

## CONTEXT

Signing in to chefsbk.app shows "Database error querying schema". This is
a PostgREST schema cache issue — recent migrations added tables/columns
that PostgREST hasn't picked up yet.

Read .claude/agents/deployment.md before starting.

---

## STEP 1 — Restart PostgREST to refresh schema cache

```bash
ssh rasp@rpi5-eth
cd /mnt/chefsbook/supabase
docker compose restart supabase-rest
```

Wait 15 seconds, then test sign-in at chefsbk.app/auth.

If sign-in works after this — done. Deploy note and /wrapup.

---

## STEP 2 — If still failing, check for schema errors

```bash
docker compose logs supabase-rest --tail=50 2>&1 | grep -i "error\|schema\|relation"
```

Also check if all recently added tables exist:
```bash
docker compose exec db psql -U postgres -d postgres -c "
SELECT tablename FROM pg_tables
WHERE schemaname = 'public'
ORDER BY tablename;
"
```

Verify these tables exist: user_profiles, admin_users, stores, notifications,
recipe_comments, recipe_translations, help_requests, shopping_lists,
shopping_list_items, stores, user_follows, recipe_likes, recipe_user_photos,
promo_codes, plan_limits, family_members, guest_sessions, comment_flags.

If any are missing, identify which migration failed and re-apply it.

---

## STEP 3 — Check RLS policies for conflicts

```bash
docker compose exec db psql -U postgres -d postgres -c "
SELECT tablename, policyname FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, policyname;
" 2>&1 | grep -i "error"
```

---

## STEP 4 — Test sign-in after fix

```bash
# Test via API:
curl -X POST https://api.chefsbk.app/auth/v1/token?grant_type=password \
  -H "apikey: [anon_key]" \
  -H "Content-Type: application/json" \
  -d '{"email":"seblux100@gmail.com","password":"11223344"}'
```

Should return a JWT token. If it returns an error, read it carefully.

After successful API test, verify sign-in works on chefsbk.app/auth.

Then verify /admin loads for seblux100@gmail.com.

---

## COMPLETION CHECKLIST

- [ ] PostgREST restarted
- [ ] Sign-in works at chefsbk.app/auth with seblux100@gmail.com
- [ ] Sign-in works with pilzner account
- [ ] chefsbk.app/admin loads for both accounts
- [ ] No "database error querying schema" message
- [ ] Run /wrapup to update DONE.md and CLAUDE.md
