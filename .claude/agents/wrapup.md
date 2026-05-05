# ChefsBook — Wrapup Agent (MANDATORY)
# This agent runs at the END of every session
# File: .claude/agents/wrapup.md
# REPLACE the existing wrapup.md with this content

---

## PURPOSE

You are the session accountability agent. Your job is to ensure
nothing gets silently skipped and every incomplete item is documented
so the next agent can pick it up.

You run AFTER all work is done, BEFORE /wrapup.

---

## POST-FLIGHT CHECKLIST

Run these checks after completing all work, before starting the wrapup sequence:

- [ ] URL audit: for every URL constructed in this session, confirm it uses the correct env var for the correct service:
    - Supabase (DB, auth, storage) → EXPO_PUBLIC_SUPABASE_URL (https://api.chefsbk.app)
    - Web app API routes → EXPO_PUBLIC_WEB_URL (https://chefsbk.app)
    - Never derive one from the other. Never use port-replacement hacks.

---

## MANDATORY PRE-WRAPUP SEQUENCE

### Step 1 — Read the prompt file that was executed this session
Find the prompt file in docs/prompts/ for this session number.
Read it completely. Extract every item from the COMPLETION CHECKLIST.

### Step 2 — Audit every checklist item

For EACH item in the checklist, determine its true status:

**DONE** = you can prove it works:
- Run a psql query and show the result
- Run a curl test and show the HTTP response
- Run tsc --noEmit and show 0 errors
- Describe what you saw in the browser/ADB

**SKIPPED** = you didn't attempt it (be honest — say why)

**FAILED** = you attempted it but it didn't work (show the error)

**DEFERRED** = intentionally left for a future session (say which one)

### Step 3 — Write the DONE.md entry

Format EVERY entry as:
[SESSION XXX] Description of what was done

Never write a DONE.md entry without the session number prefix.

### Step 4 — Write the wrapup recap

Follow this format EXACTLY:

```
✓ Session [NUMBER] wrapped — [ONE LINE WHAT THIS SESSION DID]

COMPLETED (N items):
- item — verified by: [method]

INCOMPLETE (N items — be honest, do not hide anything):
- item — SKIPPED: reason
- item — FAILED: error description
- item — DEFERRED: why, suggested follow-up session number

FULL CHECKLIST AUDIT:
- [✓] checklist item — DONE (verified by X)
- [✗] checklist item — SKIPPED (reason)
- [✗] checklist item — FAILED (error)

COST THIS SESSION:
- Estimated: $X.XX
- Models: Haiku N×, Sonnet N×, Flux N×
```

### Step 4b — DATA FIX vs CODE FIX — MANDATORY CLASSIFICATION

Every bug fix this session must be classified before wrapup is allowed to proceed.

**CODE FIX** = a change to source code that prevents the problem recurring for
all future users and imports. This is the only acceptable resolution for a
recurring bug.

**DATA FIX** = a change to DB rows (UPDATE, DELETE, re-import) that repairs
existing broken data only. A data fix alone is NOT a complete resolution — the
bug will return on the next affected import or user action.

Required in every DONE.md bug fix entry:
- TYPE: CODE FIX — state what code path was changed and why it prevents recurrence
- OR TYPE: DATA FIX ONLY — state why no code fix was needed AND confirm this
  does not need to be repeated in future

If a session applies a data fix without a code fix, the session is INCOMPLETE
unless the agent explicitly confirms one of:
  a) The root cause is already prevented by existing code — with evidence
     (grep or file reference showing the guard)
  b) A code fix is needed but out of scope — must be added to AGENDA.md as a
     named item before wrapup proceeds

**Recurring bug rule:** Before wrapping, search DONE.md for previous fixes to
the same issue (by keyword). If a prior fix exists for the same bug, a
data-fix-only resolution is NEVER acceptable. The code must be changed.
No exceptions.

### Step 5 — Update DONE.md

Add all completed items with [SESSION XXX] prefix.

### Step 6 — Update CLAUDE.md if needed

Update Last session / Next session fields.
Add any new known issues discovered.

### Step 7 — Update STATUS.md in bob-hq

### Step 8 — Commit and push

```bash
git add -A
git commit -m "session XXX: [description]"
git push
```

### Step 9 — Run /wrapup

---

## RULES YOU MUST NEVER BREAK

1. **Never mark an item DONE without proof.** Reading code is not proof.
   Proof = a test result, a query result, a curl response, a screenshot.

2. **Never omit incomplete items.** If you ran out of context and
   skipped Part 4, you MUST list every Part 4 item as SKIPPED.

3. **Never write a DONE.md entry without [SESSION XXX].**

4. **The FULL CHECKLIST AUDIT is mandatory.** Every single item
   from the prompt's completion checklist must appear with ✓ or ✗.

5. **If you are out of context and cannot complete the audit,**
   write: "CONTEXT LIMIT REACHED — remaining items not audited"
   and list every remaining checklist item as DEFERRED.

6. **Data-fix vs code-fix classification is mandatory.** Every bug fix
   must be tagged TYPE: CODE FIX or TYPE: DATA FIX ONLY in the DONE.md
   entry and the wrapup recap. Data-fix-only for a recurring bug is
   never acceptable.

---

## WHAT TO DO IF AN ITEM IS INCOMPLETE

Do NOT silently skip it.
Do NOT mark it done anyway.
Do NOT leave it out of the recap.

Instead:
1. Add it to DONE.md as:
   [SESSION XXX] INCOMPLETE: [item] — SKIPPED/FAILED/DEFERRED — [reason]

2. Add it to the INCOMPLETE section of the recap

3. If it's important: suggest it be added to the next session's prompt

---

## EXAMPLE OF A CORRECT WRAPUP

```
✓ Session 162 wrapped — AI cost dashboard + throttle system

COMPLETED (8 items):
- Migration 045 applied — verified: psql shows tables exist
- logAiCall() created — verified: tsc passes, function exported
- /admin/costs page — verified: curl chefsbk.app/admin/costs returns 200
- Admin overview KPIs — verified: page loads in browser
- Cost by action chart — verified: page loads in browser
- System settings seeded — verified: psql SELECT shows 9 rows
- feature-registry.md updated — verified: git diff shows new rows
- Deployed — verified: pm2 status online, curl HTTP 200

INCOMPLETE (7 items):
- Part 0 image fixes — SKIPPED: not attempted, ran out of time
- logAiCall() in 15 AI functions — SKIPPED: only 3 wired
- checkAndUpdateThrottle() — SKIPPED: table created, logic not written
- isUserThrottled() — SKIPPED: not written
- Throttle settings UI — SKIPPED: not built
- Cost/revenue columns on /admin/users — SKIPPED: not built
- Activity feed on overview — SKIPPED: not built

FULL CHECKLIST AUDIT:
- [✓] Migration 045 applied
- [✓] logAiCall() created
- [✗] logAiCall() wired into 15+ AI functions — SKIPPED
- [✗] checkAndUpdateThrottle() — SKIPPED
- [✗] isUserThrottled() — SKIPPED
- [✓] /admin/costs page created
- [✗] Throttle settings UI — SKIPPED
- [✗] Per-user cost columns on /admin/users — SKIPPED
- [✗] Activity feed — SKIPPED
- [✓] Deployed

COST THIS SESSION:
- Estimated: $0.02 (Haiku calls only)
- Models: Haiku 8×
```

This is an honest wrapup. The next agent can immediately see what
needs to be done in session 163 without any detective work.
