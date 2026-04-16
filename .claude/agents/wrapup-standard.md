# ChefsBook — Wrapup Format Standard
# Include this in every prompt file's completion section
# Agents must follow this EXACTLY

---

## MANDATORY WRAPUP FORMAT

Every session must end with /wrapup and the following format.
Do NOT deviate from this structure.

---

### DONE.md entry format

Every DONE.md entry must start with:
[SESSION XXX] where XXX is the session number from this prompt file.

Example:
- [SESSION 156] Image themes: 10 themes defined in packages/ai/src/imageThemes.ts
- [SESSION 156] Admin image quality override: radio buttons on /admin/users/[id]

This allows instant identification of which session produced which work
without scrolling through context.

---

### Wrapup recap format

The recap at the end of /wrapup must follow this structure EXACTLY:

```
✓ Session [NUMBER] wrapped — [ONE LINE SUMMARY OF WHAT THIS SESSION DID]

COMPLETED (verified, not just coded):
- [ item 1 ] — [how verified: psql query / curl / ADB screenshot / browser check]
- [ item 2 ] — [how verified]
...

INCOMPLETE (honest list — do not omit anything from the checklist):
- [ item ] — SKIPPED: [reason]
- [ item ] — FAILED: [what went wrong]
- [ item ] — DEFERRED: [why, and what session should pick it up]

CHECKLIST AUDIT (paste every checklist item with status):
- [✓] Item from checklist — DONE
- [✗] Item from checklist — SKIPPED (reason)
- [✗] Item from checklist — FAILED (reason)

COST (if AI calls were made):
- Estimated AI cost this session: $X.XX
- Models used: Haiku N calls, Sonnet N calls, Flux N calls
```

---

### Rules for agents

1. NEVER mark a checklist item as done without verifying it works
2. NEVER omit incomplete items from the wrapup
3. ALWAYS include the session number in every DONE.md entry
4. ALWAYS run the verification method listed in the checklist
   (psql query, curl test, ADB screenshot, browser check)
5. If you run out of context before completing all items:
   - Stop immediately
   - Document exactly where you stopped
   - List every remaining item as DEFERRED
   - Run /wrapup with the incomplete list

---

### Example of a correct wrapup

```
✓ Session 156 wrapped — Image themes + regen pills + admin quality override

COMPLETED:
- 10 themes defined — verified: node -e "import themes..." returns 10 keys
- Theme picker modal — verified: opened in browser, all 10 themes show previews
- Regen pills in Change Image popup — verified: clicked pill, image regenerated
- PATCH /api/user/theme — verified: curl returns 200, DB updated

INCOMPLETE:
- Admin image quality radio buttons on /admin/users/[id] — SKIPPED: ran out
  of context. Needs follow-up session. Part 3b of prompt.
- Admin users table "🎨 Dev" badge — SKIPPED: same reason as above
- Pricing page "Premium AI food photography" — SKIPPED: same reason

CHECKLIST AUDIT:
- [✓] 10 themes defined in packages/ai
- [✓] image_theme column on user_profiles
- [✓] Theme picker modal (web)
- [✗] Theme picker modal (mobile) — DEFERRED: mobile session needed
- [✓] PATCH /api/user/theme endpoint
- [✗] Admin image quality radio buttons — SKIPPED
- [✗] Admin users table Dev badge — SKIPPED
- [✗] Pricing page updated — SKIPPED

COST:
- Estimated: $0.28 (10 theme images × $0.025 Flux Dev + $0.03 Haiku calls)
- Models: Haiku 12 calls, Flux Dev 10 calls
```
