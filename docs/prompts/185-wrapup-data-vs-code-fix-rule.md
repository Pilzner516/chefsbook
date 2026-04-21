# ChefsBook — Session 185: Add Data Fix vs Code Fix Rule to Wrapup Agent
# Target: .claude/agents/wrapup.md

---

## CONTEXT

Read CLAUDE.md and .claude/agents/wrapup.md before starting.
No code changes. Agent file update only. No deploy needed.

---

## PROBLEM

Recurring bugs (zero ingredients, external image URLs, watermark issues) keep
being fixed with data patches but no code changes. The next import reproduces
the same problem. Agents are marking sessions complete after data-only fixes
without flagging that the root cause is still live in the code.

---

## FIX

Add the following mandatory section to .claude/agents/wrapup.md, inserted
BEFORE the final DONE.md update step so it cannot be skipped:

---

## DATA FIX vs CODE FIX — MANDATORY CLASSIFICATION

Every bug fix this session must be classified before wrapup is allowed to proceed.

### CODE FIX
A change to source code that prevents the problem recurring for all future
users and imports. This is the only acceptable resolution for a recurring bug.

### DATA FIX
A change to DB rows (UPDATE, DELETE, re-import) that repairs existing broken
data only. A data fix alone is NOT a complete resolution — the bug will return
on the next affected import or user action.

### Required in every DONE.md bug fix entry:
- TYPE: CODE FIX — state what code path was changed and why it prevents recurrence
- OR TYPE: DATA FIX ONLY — state why no code fix was needed AND confirm this
  does not need to be repeated in future

### If a session applies a data fix without a code fix:
The session is INCOMPLETE unless the agent explicitly confirms one of:
  a) The root cause is already prevented by existing code — with evidence (grep or file reference)
  b) A code fix is needed but out of scope — must be added to AGENDA.md as a
     named item before wrapup proceeds

### Recurring bug rule:
Before wrapping, search DONE.md for previous fixes to the same issue (by keyword).
If a prior fix exists for the same bug, a data-fix-only resolution is NEVER
acceptable. The code must be changed. No exceptions.

---

Also add "data-fix vs code-fix classification complete" as a checklist item
in the wrapup checklist so it appears every session.

---

## COMPLETION CHECKLIST

- [ ] Section added to wrapup.md before the DONE.md update step
- [ ] "data-fix vs code-fix classification complete" added to wrapup checklist
- [ ] Run /wrapup
