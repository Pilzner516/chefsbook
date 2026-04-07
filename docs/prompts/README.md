# ChefsBook — docs/prompts/
# QA Session Prompts — Generated from QA Report 2026-04-07

Paste any of these files into Claude Code to start the corresponding session.
Use the numbered order — later sessions may depend on migrations from earlier ones.

| File | Session | QA Items | Est. Complexity |
|------|---------|----------|-----------------|
| `01-critical-bugs.md` | Critical Bug Fixes | 6, 11, 12, 14, 15, 16, 21, 22 | Medium — 8 independent fixes |
| `02-android-safearea-notepad.md` | Android Safe Area + Notepad | 1, 19, 20 | Low — UI placement fixes |
| `03-shopping-store-logos.md` | Shopping List Store & Logos | 3, 4 | Medium-High — schema + new UI |
| `04-recipe-images-scanning.md` | Recipe Images & Multi-page Scan | 5, 9, 10 (scan) | High — touches import pipeline |
| `05-recipe-versions-autotag.md` | Recipe Versioning + Auto-tag | 7, 8, 10 (versions) | High — new DB schema + UI |
| `06-ux-search-mealplan-portions.md` | Search Popup + Meal Plan UX | 13, 17, 18 | Medium — UI + AI wizard |
| `07-web-parity-tracking.md` | Web Parity Tracker | 2 | Reference doc — not a session |

## Recommended order
1. Start with `01` (bug fixes) — unblocks usability for further testing.
2. `02` (safe area) — quick wins, unblocks Android testing.
3. `03`, `04`, `05`, `06` can be run in parallel across multiple Claude Code sessions.
4. After all mobile sessions: use `07` to schedule the web parity session.

## Migration sequence (cumulative)
- 012 — Shopping store system (`03`)
- 013 — Recipe photo source field (`04`)
- 014 — Recipe versions (`05`)
- 015 — Meal plan servings (`06`)

All migrations applied to: `ssh rasp@rpi5-eth` → `/mnt/chefsbook/supabase`
