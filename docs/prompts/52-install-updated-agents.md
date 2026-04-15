# ChefsBook — Session 52: Install Updated Agent System
# Purpose: Install 2 new agents + update existing 4 + update CLAUDE.md + update wrapup.md
# Target: .claude/agents/ + CLAUDE.md

---

## CONTEXT

After 50+ sessions, recurring failures have been documented. This session installs
updated agents that prevent these patterns from repeating.

---

## STEP 1 — Copy new agent files

```powershell
copy docs\prompts\agents\testing.md .claude\agents\testing.md
copy docs\prompts\agents\deployment.md .claude\agents\deployment.md
```

Overwrite existing agent files with updated versions:
```powershell
copy docs\prompts\agents\ui-guardian.md .claude\agents\ui-guardian.md
copy docs\prompts\agents\import-pipeline.md .claude\agents\import-pipeline.md
copy docs\prompts\agents\image-system.md .claude\agents\image-system.md
copy docs\prompts\agents\data-flow.md .claude\agents\data-flow.md
```

Verify `.claude/agents/` now contains:
- wrapup.md (existing, unchanged)
- navigator.md (existing, unchanged)
- ui-guardian.md (updated)
- import-pipeline.md (updated)
- image-system.md (updated)
- data-flow.md (updated)
- testing.md (NEW)
- deployment.md (NEW)

---

## STEP 2 — Update CLAUDE.md agent lookup table

Find the AGENT SYSTEM section in CLAUDE.md and update the lookup table:

```markdown
## AGENT SYSTEM — READ BEFORE EVERY SESSION

| If your session touches... | Read this agent |
|---------------------------|----------------|
| Any screen, modal, or component | ui-guardian.md (ALWAYS) |
| Any import path (URL, scan, Instagram, speak, file) | import-pipeline.md |
| Any image upload, display, or storage | image-system.md |
| Any Zustand store, data fetch, or cache | data-flow.md |
| ANY feature on ANY session | testing.md (ALWAYS) |
| Any change to apps/web | deployment.md (ALWAYS for web sessions) |
```

`testing.md` and `deployment.md` are now MANDATORY on every session — not optional.

---

## STEP 3 — Update SESSION START in CLAUDE.md

Replace the existing SESSION START INSTRUCTIONS with:

```markdown
## SESSION START INSTRUCTIONS

Every Claude Code session MUST begin with these steps in order:

1. Read CLAUDE.md (this file) fully
2. Read DONE.md to understand what was last built
3. Read .claude/agents/testing.md — MANDATORY EVERY SESSION
4. If session touches web: read .claude/agents/deployment.md — MANDATORY
5. Read all other applicable agents based on the lookup table above
6. Run ALL pre-flight checklists from every agent loaded
7. For any table you will query: run `\d tablename` on RPi5 to verify columns
8. Only then begin writing code

Do not skip any step. Agents exist because the same bugs have been introduced
and fixed 3-5 times each. Reading the agents prevents repeating known mistakes.
```

---

## STEP 4 — Update wrapup.md

Add this section at the TOP of wrapup.md (before existing content):

```markdown
## MANDATORY PRE-WRAPUP TESTING

You MUST complete all of the following before updating DONE.md.
"Verified in source" does NOT count. Only actual test execution counts.

### DB verification (any session with DB writes)
Run for EVERY table written to this session:
```bash
ssh rasp@rpi5-eth
cd /mnt/chefsbook/supabase
docker compose exec db psql -U postgres -d postgres -c \
  "SELECT * FROM [table] ORDER BY created_at DESC LIMIT 3;"
```
Confirm rows exist. If not, the feature is broken — fix before /wrapup.

### Cross-platform verification
If the session was cross-platform (mobile + web):
- Web: curl -I https://chefsbk.app/[affected-page] returns 200
- Mobile: ADB screenshot confirms UI renders correctly
- BOTH must pass. If only one platform tested, the session is NOT done.

### Entry point verification
If a new component was built, verify it is used in ALL required locations:
```bash
grep -rn "NewComponentName" apps/ --include="*.tsx"
```
Count the usages. If fewer than expected, wire the missing entry points first.

### Schema verification
For any new query written: confirm column names match actual DB schema.
```bash
docker compose exec db psql -U postgres -d postgres -c "\d [tablename]"
```

### Deployment (web sessions)
Follow .claude/agents/deployment.md fully before /wrapup.
Do not update DONE.md until chefsbk.app is serving the new code.
```

---

## STEP 5 — Add schema reference to CLAUDE.md

Add a "Key Table Schemas" section to CLAUDE.md with the columns that have caused
repeated bugs:

```markdown
## KEY TABLE SCHEMAS — verify before querying

These columns have caused repeated bugs from wrong assumptions:

recipe_user_photos:
  url TEXT (NOT photo_url)
  storage_path TEXT
  is_primary BOOLEAN
  sort_order INTEGER

user_follows:
  follower_id UUID (NOT follower)
  following_id UUID (NOT followed_id)

shopping_list_items:
  list_id UUID (ownership via shopping_lists.user_id)
  (no user_id column — RLS via parent list)

Always run \d [tablename] on RPi5 before writing any new query.
```

---

## COMPLETION CHECKLIST

- [ ] All 6 agent files in .claude/agents/ (wrapup, navigator, ui-guardian,
      import-pipeline, image-system, data-flow, testing, deployment)
- [ ] CLAUDE.md agent lookup table updated with testing.md and deployment.md
- [ ] SESSION START updated to include testing.md and deployment.md as mandatory
- [ ] wrapup.md updated with mandatory pre-wrapup testing section
- [ ] Key table schemas added to CLAUDE.md
- [ ] Run /wrapup to update DONE.md
