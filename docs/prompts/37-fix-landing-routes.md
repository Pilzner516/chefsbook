# ChefsBook — Session 37: Fix Landing Page CTA Button Routes
# Source: QA review of chefsbk.app
# Target: apps/web (landing page only)

---

## CONTEXT

The "Start for free" and "Start free trial" buttons on the landing page are linking
to routes that return 404. The links need to point to the correct existing auth routes.

---

## FIX

1. Check what signup/auth routes actually exist in `apps/web/app/`:
   - Look for files like `signup/page.tsx`, `auth/signup/page.tsx`,
     `register/page.tsx`, or similar
   - Also check the sign-in route: `signin/page.tsx`, `auth/signin/page.tsx`,
     `login/page.tsx`

2. Update ALL CTA buttons on the landing page to use the correct existing routes:
   - "Start for free" → correct signup route
   - "Start free trial" (on pricing cards) → same signup route
   - "Sign in" link in footer/nav → correct signin route
   - "Get started" buttons → same signup route

3. For pricing card CTAs that should pre-select a plan, append the plan as a query
   param if the signup page supports it:
   `[signup-route]?plan=chef` etc.
   If the signup page does not yet read this param, just link to the signup route
   without it — do not build the param handling now.

4. Also check the "See how it works" button in the hero — confirm it scrolls to
   the "How it works" section (should be `href="#how-it-works"` with the section
   having that id).

---

## DEPLOYMENT

After fixing, deploy to RPi5:

```bash
ssh rasp@rpi5-eth
cd /mnt/chefsbook/repo
git pull
cd apps/web
npm run build 2>&1 | tail -20
pm2 restart chefsbook-web
```

Confirm build succeeds before restarting PM2.

---

## COMPLETION CHECKLIST

- [ ] Correct signup route identified from existing app structure
- [ ] All "Start for free" / "Start free trial" buttons link to correct route
- [ ] "Sign in" links in nav/footer link to correct signin route
- [ ] "See how it works" scrolls to the How it works section
- [ ] No 404s from any landing page button or link
- [ ] Deployed to RPi5 and verified live on chefsbk.app
- [ ] Run /wrapup to update DONE.md and CLAUDE.md
