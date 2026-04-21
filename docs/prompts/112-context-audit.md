# ChefsBook — Prompt 112: Context Audit & Token Efficiency Proposal
# Save to: docs/prompts/112-context-audit.md
# Run from: C:\Users\seblu\aiproj\chefsbook
# Purpose: Audit CLAUDE.md and DONE.md for token bloat, propose slim structure

---

## TASK

Read CLAUDE.md and DONE.md in full. Do NOT modify either file.
Produce a restructuring proposal and write it to docs/context-audit.md.

---

## STEP 1 — CLAUDE.md audit

For every section in CLAUDE.md, record:
- Section name and line count
- Is it needed at EVERY session start, or only for specific agent types?
- Is it outdated or duplicated anywhere in DONE.md?
- Which agent type needs it: mobile / web / infra / all?

Flag anything that is:
- Mobile-only (web agents should never read it)
- Web-only (mobile agents should never read it)
- Infra/deployment detail that only matters during deploy sessions
- Historical context that belongs in DONE.md instead
- Duplicated between CLAUDE.md and DONE.md

---

## STEP 2 — DONE.md audit

- Count total line count and total entries
- Identify entries older than 60 days — list them by section heading only
- Identify which entries are: mobile-only / web-only / infra-only / shared
- Identify any entries that directly contradict each other (later entry fixes
  earlier one — the earlier one is dead weight)

---

## STEP 3 — Write proposal to docs/context-audit.md

Create docs/context-audit.md with the following sections:

### Conservative CLAUDE.md proposal
- Default position: KEEP everything unless it meets ALL THREE criteria:
  1. Clearly outdated (superseded by a later DONE.md entry)
  2. Not a hidden dependency (no other agent behaviour depends on it)
  3. Safely recoverable if lost (not a one-line fix that took hours to find)
- List only the sections that pass all three criteria as candidates for removal
- List sections that could move to agent-specific files (web/mobile/infra)
  BUT only if the session-start agent prompt explicitly loads that file —
  never remove without a guaranteed load path
- Do NOT propose deleting anything that relates to:
  - Auth quirks (e.g. GOTRUE_MAILER_AUTOCONFIRM)
  - WebSocket / mixed content fixes
  - Android cleartext / network_security_config
  - Deployment sequences
  - Testing checklist requirements

### Conservative DONE.md rotation
- Only propose archiving entries older than 90 days (not 60)
- Never archive entries that document a bug fix to a recurring problem
- Never archive entries that explain WHY a decision was made
- Recommended cutoff date and estimated line count reduction

### Lazy-load pattern (only if safe)
- Only propose splitting if the load path is guaranteed and testable
- If there is any doubt an agent will miss the file, keep it in CLAUDE.md

### Risk assessment
- Be thorough and pessimistic here — list every risk you can find
- Explicitly flag any section that looks safe to cut but has a hidden
  dependency (e.g. one-line fixes that took sessions to discover)
- Conclude with a STOP/GO recommendation:
  STOP = risks outweigh savings, keep current structure
  GO = safe to proceed with the conservative cuts identified

### Summary
End with exactly these two lines:
"Estimated reduction: X lines → Y lines (Z%)"
"Recommendation: STOP / GO — [one sentence reason]"

---

## RULES

- Do NOT modify CLAUDE.md or DONE.md
- Do NOT create docs/agents/*.md files yet — proposal only
- Do NOT restructure anything — read and propose only
- Write output to docs/context-audit.md
- When done, print the full contents of docs/context-audit.md to the terminal
