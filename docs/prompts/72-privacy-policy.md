# ChefsBook — Session 72: Privacy Policy Page
# Source: Chrome Web Store requirement + general best practice
# Target: apps/web

---

## CONTEXT

A privacy policy is required for Chrome Web Store submission and is good
practice for any app collecting user data. This session creates a clean,
readable privacy policy page at chefsbk.app/privacy.

Read .claude/agents/deployment.md before starting.

---

## ROUTE

Create `apps/web/app/privacy/page.tsx` — publicly accessible, no auth required.

---

## CONTENT

Write a clear, plain-language privacy policy covering:

### 1. What we collect
- Account information: email address, display name, username
- Recipe data: recipes you import, scan, speak, or create
- Usage data: which features you use (not sold to third parties)
- Photos: images you upload to recipes (stored in our Supabase instance)
- Shopping lists, meal plans, and preferences you create
- Feedback messages you submit through the app

### 2. What we do NOT collect
- We do not sell your data to anyone
- We do not show ads
- We do not share your data with third parties except as listed below
- We do not collect payment information (handled by Stripe if/when billing is active)

### 3. Third-party services we use
- **Supabase** — database and file storage (self-hosted on our own server)
- **Anthropic Claude API** — AI features (recipe extraction, translation, moderation).
  Recipe content is sent to Claude for processing but not stored by Anthropic beyond
  the API call.
- **Pexels API** — recipe photo suggestions (search queries sent, no personal data)
- **Logo.dev** — store logo lookup (store name sent, no personal data)
- **Cloudflare** — CDN and tunnel (handles web traffic, standard CDN privacy applies)

### 4. Browser Extension
- The ChefsBook browser extension captures the HTML of pages you choose to import
- This HTML is sent to our servers for recipe extraction only
- We do not capture browsing history or pages you did not explicitly choose to import
- The extension stores your ChefsBook login token locally in Chrome storage

### 5. Data storage
- All user data is stored on our self-hosted server (Raspberry Pi 5, located in the US)
- Data is not stored in third-party cloud services (we self-host Supabase)
- Backups are stored locally on the same server

### 6. Your rights
- You can delete your account and all associated data at any time from Settings
- You can export your recipes (CSV/JSON export available in Settings)
- You can contact us at support@chefsbk.app with any data questions

### 7. Cookies
- We use session cookies for authentication only
- We do not use tracking or advertising cookies

### 8. Children
- ChefsBook is not directed at children under 13
- We do not knowingly collect data from children under 13

### 9. Changes
- We will notify users of significant changes to this policy via email

### 10. Contact
- Email: support@chefsbk.app
- Website: chefsbk.app

---

## PAGE DESIGN

Clean, readable, legal-but-friendly tone. Match the Trattoria aesthetic:

```
┌─────────────────────────────────────────┐
│  [ChefsBook logo]                       │
│─────────────────────────────────────────│
│                                         │
│  Privacy Policy                         │  ← 32px bold
│  Last updated: April 2026               │  ← 14px grey
│                                         │
│  At ChefsBook, we believe your recipes  │  ← intro paragraph
│  and your data are yours. Here's        │
│  exactly what we collect and why.       │
│                                         │
│  1. What we collect                     │  ← section headers, red
│  [content...]                           │
│                                         │
│  2. What we do NOT collect              │
│  [content...]                           │
│  ...                                    │
│                                         │
│  Questions? Email us at                 │
│  support@chefsbk.app                   │
└─────────────────────────────────────────┘
```

- Section headers: `#ce2b37` pomodoro red, 18px, font-weight 600
- Body: `#374151`, 15px, line-height 1.8
- Max-width: 720px, centered
- Adequate padding top/bottom (80px)
- No sidebar — full-width clean layout like a legal document

---

## ALSO ADD

### Footer link
Add "Privacy Policy" to the web app footer linking to `/privacy`.

### Landing page footer
Add "Privacy Policy" link to the landing page footer alongside the existing
Features, Pricing, Sign In links.

---

## DEPLOYMENT

```bash
ssh rasp@rpi5-eth
cd /mnt/chefsbook/repo
git pull
cd apps/web
NODE_OPTIONS=--max-old-space-size=1024 npm run build 2>&1 | tail -20
pm2 restart chefsbook-web
```

Verify: `curl -I https://chefsbk.app/privacy` returns HTTP 200.

---

## COMPLETION CHECKLIST

- [ ] /privacy page created and accessible (HTTP 200)
- [ ] All 10 sections present with accurate content
- [ ] Trattoria styling applied (red headers, readable body text)
- [ ] "Last updated: April 2026" shown
- [ ] Privacy Policy link in dashboard footer
- [ ] Privacy Policy link in landing page footer
- [ ] Deployed to RPi5 and verified live
- [ ] Run /wrapup to update DONE.md and CLAUDE.md
