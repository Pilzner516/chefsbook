# ChefsBook — Web Parity Tracking
# Source: QA Report 2026-04-07 · Item 2
# This file is a TRACKING DOCUMENT, not an executable session prompt.
# Add this content to AGENDA.md under a new "Web Parity" tier.

---

## PRINCIPLE (Item 2)

Mobile QA findings should be evaluated for web applicability. Where a fix or feature makes sense on both platforms, the web version must receive the same treatment in a dedicated web-focused session.

---

## WEB PARITY BACKLOG

The following items from the 2026-04-07 mobile QA report need web review:

| # | Mobile Fix/Feature | Web Action Needed |
|---|---|---|
| 1 | QA Notepad "Clear All" confirmation | Web QA Notepad (if present) — same confirmation flow |
| 3 | Store-first shopping list creation | Web shopping list create modal — add store selector step |
| 4 | Store logos in shopping list | Web shopping list — `StoreAvatar` component (same initials fallback) |
| 5 | Image management in recipe edit | Web recipe edit — already partially implemented; verify gallery add/delete/set-primary works |
| 6 | Recipe save failing (dietary_restrictions) | Web recipe save — audit same payload construction for same bug |
| 7 | Recipe version pill on card | Web recipe card — add "N versions" pill |
| 8 | Auto-tag multi-select | Web tag manager — verify multi-select or add same toggle behaviour |
| 9 | Multiple images on scanned/spoken recipes | Web speak flow — already has Pexels picker; verify scan also adds image |
| 10 | Recipe versioning system | Web recipe list + detail — version picker, sub-cards, "Add version" button |
| 13 | Search cards open popup | Web search page already uses filter pills — evaluate if bottom sheet improves UX |
| 17 | AI Meal Plan Wizard | Web already has this — verify feature parity (confirm mobile matches web) |
| 18 | Portions when adding to meal plan | Web meal plan add flow — same servings stepper |
| 21 | Dry ingredients metric fix | Shared utility (`convertUnit`) — fix applies to both platforms automatically |
| 22 | Language not applying | Web sidebar language selector — audit same plumbing |

---

## HOW TO USE THIS FILE

When scheduling a **web-focused ChefsBook session**, paste this table into the session brief and have the agent:
1. Check each item against the current web implementation.
2. Mark items as: ✅ Already done | 🔧 Needs fix | ➕ Needs build | ⏭ Not applicable on web.
3. Implement any `🔧` and `➕` items within that session.

This file should be updated after each web session.

---

## ADD TO AGENDA.md

In `C:\Users\seblu\aiproj\chefsbook\AGENDA.md`, add a new tier (or append to Tier 5):

```
## WEB PARITY TIER
Review and implement all items from docs/prompts/07-web-parity-tracking.md
Prerequisite: complete mobile sessions 01–06 first
```
