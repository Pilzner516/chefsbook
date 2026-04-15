# ChefsBook — Complete Prompt File List
# Updated: 2026-04-12
# Location: docs/prompts/ in the monorepo

---

## EARLY BUILD (sessions 01–26)
These were written before the current chat session.

| # | File | What it does |
|---|------|-------------|
| 01 | 01-initial-scaffold.md | Turborepo monorepo setup, Supabase schema, initial Next.js + Expo scaffold |
| 02 | 02-recipe-import.md | URL import pipeline (JSON-LD first, Claude fallback) |
| 03 | 03-shopping-list.md | Shopping list with store-first creation, department grouping |
| 04 | 04-meal-plan.md | Meal plan calendar, drag-to-day, shopping cart generation |
| 05 | 05-recipe-versioning.md | Recipe versioning + Save a Copy + auto-tag multi-select |
| 06 | 06-scan-pipeline.md | Multi-page photo scan, speak a recipe, file import |
| 07 | 07-instagram-import.md | Instagram share + manual URL paste import |
| 08 | 08-mobile-i18n.md | react-i18next, 5 locale files (en/fr/es/it/de), language selector |
| 09 | 09-mobile-cleanup.md | Staging pill removal, safe area, Pexels picker, language fix |
| 10 | 10-build-apk.md | Release APK build via gradlew assembleRelease |
| 11 | 11-pexels-chef-hat.md | Pexels photo picker (3 images) + chef's hat fallback |
| 12 | 12-recipe-translation.md | Claude-powered recipe translation, cached in recipe_translations |
| 13 | 13-duplicate-button-fix.md | Fix duplicate Save button + Save a Copy flow |
| 14 | 14-qr-fixes.md | QA round 2: staging pill, safe area, language, Pexels |
| 15 | 15-storage-uploads.md | Fix Supabase storage uploads + auth headers |
| 16 | 16-upload-indicator.md | Fix hanging upload + upload progress indicator |
| 17 | 17-image-display.md | Fix image not displaying after upload |
| 18 | 18-hero-gallery.md | HeroGallery swipeable pager + primary image selection |
| 19 | 19-post-import-image.md | PostImportImageSheet shown after all imports |
| 20 | 20-recipe-card-stale.md | Recipe card stale state fix + scan description |
| 21 | 21-dish-identification.md | Dish ID from photo → clarifying questions → action sheet |
| 22 | 22-instagram-routing.md | Instagram routing + scan layout + dish context pills |
| 23 | 23-specialist-agents.md | Install 9 specialist agents in .claude/agents/ |
| 24 | 24-web-image-proxy.md | Web image proxy (/api/image) + chef's hat fallback across 12 files |
| 25 | 25-web-cleanup.md | Web cleanup: i18n stubs, safe area, logo.dev |
| 26 | 26-usernames-profiles.md | Usernames (permanent), profiles, searchability, attribution columns |

---

## MAIN BUILD (sessions 27–78)
Written in current chat session.

| # | File | What it does |
|---|------|-------------|
| 27 | 27-plan-tiers.md | Plan tiers (free/chef/family/pro), promo codes, plan_limits table |
| 28 | 28-admin-dashboard.md | Admin dashboard at /admin, super_admins, moderation queue |
| 29 | 29-follow-system.md | Follow system, What's New feed, Chef+ plan gate |
| 30 | 30-likes-comments.md | Recipe likes + triggers, comments + AI moderation, comment flagging |
| 31 | 31-attribution-tags.md | Attribution tags (@original_submitter locked, @shared_by removable) |
| 32 | 32-share-links.md | Share links, guest access, 4-level visibility model |
| 33 | 33-pdf-export.md | PDF export (Pro plan), @react-pdf/renderer server-side |
| 34 | 34-web-recipe-images.md | Web recipe images + chef's hat fallback, HeroGallery on web |
| 35 | 35-landing-page.md | Landing page refresh, header unit toggle, pricing section |
| 36 | 36-landing-polish.md | Landing page visual polish: HD logo, feature cards, How it works cards, toggle alignment |
| 37 | 37-landing-cta-fix.md | Fix landing page CTA button routes |
| 38 | 38-web-recipe-detail.md | Web recipe detail fixes: comments, likes, PDF, Discover |
| 39 | 39-image-sweep.md | Web image rendering sweep — proxy applied to 12 files |
| 40 | 40-shopping-crash.md | Shopping list crash + username fixes |
| 41 | 41-recipe-moderation.md | Recipe AI content moderation on every import/edit |
| 42 | 42-photo-url-fix.md | Fix recipe_user_photos column name (photo_url → url) + DB backfill |
| 43 | 43-fix-photo-url-column.md | Fix recipe_user_photos `url` column mismatch across all files |
| 44 | 44-add-to-meal-plan.md | Add to meal plan from recipe detail + remove duplicate Share button |
| 45 | 45-comment-post-shopping-rls.md | Fix comment post + shopping list RLS error |
| 46 | 46-meal-plan-card-polish.md | Meal plan card pills (daypart + servings), portions mismatch warning |
| 47 | 47-unified-dialogs.md | Unified ChefsDialog component sweep — replaces all native alert/confirm |
| 48 | 48-stores-table.md | Stores table (migration 024), store picker dropdown for new lists |
| 49 | 49-pdf-redesign.md | PDF export redesign using raw recipe data, correct filename, attribution |
| 50 | 50-store-picker-gaps.md | Store picker: mobile + all 3 entry points + button colour fix |
| 51 | 51-pdf-auth-fix.md | PDF download auth — fetch with Authorization Bearer header |
| 52 | 52-install-updated-agents.md | Install updated agents + testing.md + deployment.md as mandatory |
| 53 | 53-web-i18n.md | Web full UI translation (react-i18next, 5 languages, instant switch) |
| 54 | 54-shopping-cart-crash.md | Shopping cart application error diagnosis |
| 55 | 55-shared-translations.md | Shared recipe translations — one per recipe per language, all users |
| 56 | 56-ai-cost-audit.md | Full AI cost audit: 12 functions → Haiku, max_tokens tightened |
| 57 | 57-install-ai-cost-agent.md | Install ai-cost.md agent in .claude/agents/ |
| 58 | 58-shopping-store-fix.md | Shopping list store_id backfill + LEFT JOIN fix |
| 59 | 59-three-live-fixes.md | Fix comments table, likes click, shopping RLS (3 live bugs) |
| 60 | 60-shopping-crash-diagnose.md | Shopping crash diagnosis with error boundary (superseded by 61) |
| 61 | 61-realtime-websocket-fix.md | Supabase Realtime WebSocket via Cloudflare Tunnel (wss://) |
| 62 | 62-parity-sweep-apk.md | Web parity sweep + APK build #3 (111MB) |
| 63 | 63-web-shopping-grouping.md | Web shopping list grouped by store with StoreAvatar logos |
| 64 | 64-meal-plan-pill-dialogs.md | Meal plan pill dialogs — replace native prompt() with ChefsDialog |
| 65 | 65-onboarding-bubbles.md | Onboarding help bubbles (6 pages, @floating-ui/react, settings toggle) |
| 66 | 66-attribution-pill.md | Recipe attribution pill (user/cookbook/URL) below recipe title |
| 67 | 67-meal-plan-dialog-width.md | Meal plan dialog width fix — 2×2 grid for 4 meal type buttons |
| 68 | 68-offline-shopping.md | Offline shopping list — AsyncStorage cache, airplane mode support |
| 69 | 69-feedback-card.md | "Got an Idea?" feedback card pinned position 1, both platforms |
| 70 | 70-attribution-row-fix.md | Attribution row: both pills side by side, Public badge removed |
| 71 | 71-extension-production.md | Browser extension production-ready + install page at /extension |
| 72 | 72-privacy-policy.md | Privacy policy at /privacy, footer links |
| 73 | 73-consolidated-store-list.md | Consolidated "All [Store]" combined view for multi-list stores |
| 74 | 74-restore-comments.md | Restore comments section (ambiguous FK recipe_comments_user_id_fkey) |
| 75 | 75-deduplicate-stores.md | Deduplicate stores + Title Case normalisation + case-insensitive index |
| 76 | 76-admin-account-fix.md | Admin account creation + GOTRUE_MAILER_AUTOCONFIRM + seblux super_admin |
| 77 | 77-threaded-comments-notifications.md | Threaded comments (1-level display, inline reply) + global notifications bell |
| 78 | 78-fix-schema-error.md | Fix "Database error querying schema" on sign-in (PostgREST restart) |

---

## STATUS SUMMARY

| Range | Status |
|-------|--------|
| 01–26 | ✅ All complete |
| 27–78 | ✅ All complete |
| APK rebuild | ⏳ Next up |


