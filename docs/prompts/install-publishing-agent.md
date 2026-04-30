# Prompt: Install Publishing Agent + Update CLAUDE.md

## LAUNCH PROMPT (paste this into Claude Code to start the session)

```
Read and execute docs/prompts/install-publishing-agent.md fully and autonomously, from pre-flight through deployment and /wrapup. Do not stop for questions unless you hit a genuine blocker.
```

---

## TYPE: HOUSEKEEPING — WEB ONLY

## Overview

Install a new specialist agent file (`publishing.md`) into the project's agent system
and update `CLAUDE.md` to register it in the lookup table and session start instructions.
No application code changes. No database changes. No deployment required.

This session has two deliverables:
1. `.claude/agents/publishing.md` — created from the content in `docs/prompts/publishing.md`
2. `CLAUDE.md` — updated with the new agent entry in two places

---

## Agent files to read — ALL of these, in order, before writing a single line

- `.claude/agents/wrapup.md`
- `.claude/agents/testing.md`
- `.claude/agents/feature-registry.md`

No other agents are required. This session does not touch application code,
templates, routes, UI, or the database.

Run ALL pre-flight checklists before making any file changes.

---

## Pre-flight: before making any changes

1. Read `docs/prompts/publishing.md` in full — this is the source content for the
   new agent file. Understand every section before writing anything.
2. Read `.claude/agents/pdf-design.md` — confirm the new publishing.md does not
   duplicate rules that already live there. The two agents are complementary:
   pdf-design.md owns rendering; publishing.md owns the production pipeline.
3. Confirm `.claude/agents/publishing.md` does not already exist.
   If it does, stop and report to the user before proceeding.
4. Read `CLAUDE.md` fully — specifically the agent lookup table and the
   SESSION START INSTRUCTIONS block. You need to know the exact format of both
   before editing.

---

## Task 1 — Create the agent file

Copy the content of `docs/prompts/publishing.md` verbatim into a new file at:

```
.claude/agents/publishing.md
```

Do not paraphrase, summarise, reformat, or alter the content in any way.
The file must be an exact copy. Verify the copy is complete by checking
line count matches the source.

---

## Task 2 — Update CLAUDE.md in two places

### Change 1 — Agent lookup table

Locate this block in CLAUDE.md:

```
| Any PDF generation or print template | pdf-design.md (MANDATORY) |
```

Add the new row directly below it:

```
| Any Lulu order, cookbook PDF generation, cover build, canvas editor, or image upscaling for print | publishing.md (MANDATORY) |
```

The new row must sit immediately below `pdf-design.md` in the table.
Do not alter any other rows.

### Change 2 — SESSION START INSTRUCTIONS

Locate this line in the SESSION START INSTRUCTIONS block:

```
7. If session touches any AI feature or @chefsbook/ai: read .claude/agents/ai-cost.md
```

Add the new line directly below it:

```
8. If session touches Lulu orders, cookbook PDF generation, cover builds, canvas editor, or image upscaling: read .claude/agents/publishing.md (MANDATORY)
```

The existing step 8 (`Read all other applicable agents...`) and all steps after it
must be renumbered by 1 (8 → 9, 9 → 10, 10 → 11, 11 → 12).

---

## Verification

- [ ] `.claude/agents/publishing.md` exists and matches `docs/prompts/publishing.md` exactly
- [ ] CLAUDE.md agent lookup table contains the new `publishing.md` row
- [ ] The new row sits immediately below the `pdf-design.md` row
- [ ] CLAUDE.md SESSION START INSTRUCTIONS contains the new step 8 for publishing.md
- [ ] All subsequent step numbers in SESSION START INSTRUCTIONS are incremented correctly
- [ ] No other content in CLAUDE.md was altered
- [ ] `docs/prompts/publishing.md` still exists and is unchanged (it is the source of truth)

---

## No deployment required

This session makes no changes to application code, routes, UI, templates,
or the database. There is nothing to build or deploy.

Do not run `deploy-staging.sh`. Do not restart PM2.

---

## Wrapup

Follow `wrapup.md` fully.

In DONE.md, record:
- That `.claude/agents/publishing.md` was created
- That `CLAUDE.md` was updated (lookup table row + session start step)
- The source file used: `docs/prompts/publishing.md`
- That no application code, database, or deployment was changed
