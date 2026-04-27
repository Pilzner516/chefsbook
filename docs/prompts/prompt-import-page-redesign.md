# Prompt: Web Import Page Redesign — Match Mobile Card Layout
# Model: OPUS
# Launch: Read docs/prompts/prompt-import-page-redesign.md and execute fully.

---

## MANDATORY PRE-FLIGHT

Read ALL of these before writing a single line of code:
- CLAUDE.md
- docs/agents/testing.md
- docs/agents/deployment.md
- docs/agents/ui-guardian.md — Trattoria design system (CRITICAL for this session)
- docs/agents/feature-registry.md — understand every import method that exists

**Codebase audit:**
- apps/web/app/dashboard/import/ — the current import/scan page (read fully)
- apps/mobile/app/(tabs)/scan.tsx — the mobile reference (read and understand the layout)
- apps/web/components/ — find existing card, button, icon components to reuse
- Find every import route to ensure nothing is broken:
  - URL import
  - Scan (photo upload)
  - Extension import
  - Speak a Recipe
  - YouTube import
  - Manual entry
  - Paste text
  - Choose photo (gallery)

Do NOT remove or break any existing import functionality.
This is a visual redesign only — all routes and handlers stay identical.

---

## DESIGN REFERENCE — THE MOBILE LAYOUT

The mobile app (screenshot provided) has this structure:

1. **Hero button** — full-width, pomodoro red `#ce2b37`, "Speak a Recipe" with
   microphone icon, subtitle "Dictate and AI formats it instantly"

2. **3-column card grid** — import method cards:
   - Icon in a light red circular badge
   - Bold title
   - Short subtitle (one line)
   - Cards: Scan Photo, Choose Photo, Import URL (row 1)
   - Cards: Paste Text, Manual Entry (row 2, 2-column)

3. **Info banners** below cards:
   - "See a recipe on Instagram or TikTok?" tip (dismissible)
   - "Share recipes directly from Chrome" with numbered steps

The web page must follow this same hierarchy and feel.

---

## WEB REDESIGN SPECIFICATION

### Layout structure

```
┌─────────────────────────────────────────────┐
│  Add a Recipe                               │
│  Choose how to add your recipe              │
├─────────────────────────────────────────────┤
│  [🎙 Speak a Recipe — full width hero btn]  │
│   Dictate and AI formats it instantly       │
├─────────────────────────────────────────────┤
│  [📷 Scan]  [🖼 Choose]  [🔗 Import URL]   │
│  [📺 YouTube]  [📋 Paste]  [✏️ Manual]      │
├─────────────────────────────────────────────┤
│  📌 Tip: Chrome Extension available         │
│  Install it to import from any recipe site  │
└─────────────────────────────────────────────┘
```

### Hero button — Speak a Recipe
- Full width, rounded-xl
- Background: pomodoro red `#ce2b37`
- White text and icon
- Title: "Speak a Recipe" — large, bold
- Subtitle: "Dictate and AI formats it instantly" — smaller, white/80%
- Microphone icon (lucide: `Mic`) left of title
- PRO badge top-right corner if the feature is plan-gated

### Method cards — grid
Desktop: 3 columns. Tablet: 2 columns. Mobile web: 2 columns.

Each card:
- White/cream background (`#faf7f0`), border `border border-stone-200`
- Rounded-xl, subtle shadow on hover
- Icon: centered, 40px, in a light red circular badge
  (background: `#fef2f2`, icon color: `#ce2b37`)
- Title: bold, 15px, below icon
- Subtitle: muted, 13px, one line max

Import methods and their icons (lucide-react):
| Method | Icon | Title | Subtitle |
|--------|------|-------|---------|
| Scan Photo | `Camera` | Scan Photo | Cookbook or recipe card |
| Choose Photo | `ImagePlus` | Choose Photo | From your gallery |
| Import URL | `Link` | Import URL | Paste any recipe link |
| YouTube | `Youtube` | YouTube | Import from any video |
| Paste Text | `ClipboardPaste` | Paste Text | AI parses any format |
| Manual Entry | `PenLine` | Manual Entry | Type it yourself |

### Info banners (below grid)
Two subtle info cards, not dismissible on web (simpler than mobile):

**Banner 1 — Instagram/TikTok tip:**
- Icon: `Lightbulb` in amber
- "See a recipe on Instagram or TikTok? Screenshot it and use Scan Photo —
  we'll read the photo and the caption."

**Banner 2 — Chrome Extension:**
- Icon: `Globe` in basil green `#009246`
- "Import directly from Chrome — Install the ChefsBook extension to save
  any recipe in one click."
- Link to extension install if available

### Plan gating
If any import method is restricted by plan (e.g. Speak a Recipe is PRO),
show a small `PRO` badge on the card top-right. On click, show the upgrade
modal (existing pattern — find how other plan-gated features do this).

---

## WHAT STAYS THE SAME

- All import handlers, routes, API calls — unchanged
- Any modals or flows triggered by clicking a method — unchanged
- Only the entry point page layout changes
- The URL input field, file upload input, etc. can open as modals or inline
  panels triggered by clicking the card (check how they currently work and
  preserve that behaviour)

---

## GUARDRAILS

- Do not change any web API routes or import logic
- Do not change mobile files
- Trattoria colours only — no new colours introduced except those explicitly
  listed above
- All cards must be keyboard accessible (focusable, Enter to activate)
- Page must be responsive — desktop 3-col, tablet 2-col, mobile-web 2-col
- Use lucide-react icons only — already installed

---

## QUALITY BAR FOR OPUS

Before calling this done, ask:
- Does this look like a designed product page or a list of buttons?
- Would a new user immediately understand how to add their first recipe?
- Does the visual hierarchy (Speak → Cards → Tips) guide the eye naturally?
- Do the cards look consistent — same padding, same icon size, same font weight?
- Does it look native to the Trattoria design system or like a different app?

---

## VERIFICATION

```bash
cd apps/web && npx tsc --noEmit
```

Live checks at https://chefsbk.app/dashboard/import:
1. Hero Speak a Recipe button visible and functional ✓
2. All 6 import method cards visible in grid ✓
3. Clicking each card opens the correct import flow ✓
4. Grid is 3-col on desktop, 2-col on tablet/mobile ✓
5. Both info banners visible ✓
6. PRO badges shown on gated methods ✓
7. No existing import functionality broken ✓

---

## DEPLOYMENT
Follow deployment.md. Build on RPi5, PM2 restart, smoke test.

---

## WRAPUP REQUIREMENT

DONE.md entry (prefix `[SESSION IMPORT-PAGE-REDESIGN]`) must include:
- Description of final layout (what it looks like)
- All 6 import methods confirmed working after redesign
- Responsive layout confirmed (desktop + mobile viewport)
- tsc clean confirmed
- Deploy confirmed: HTTP 200
