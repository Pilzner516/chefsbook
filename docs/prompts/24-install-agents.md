# ChefsBook — Session: Install Specialist Agents
# Source: Architecture review after QA sessions 01–25
# Target: .claude/agents/ + CLAUDE.md

---

## CONTEXT

After 25 sessions, four recurring failure patterns account for the majority of QA bugs:
1. Android safe area violations (buttons hidden below nav bar)
2. Import routing errors (URLs going to wrong handler)
3. Image display/upload failures (missing headers, wrong URLs)
4. Stale data not refreshing after mutations

This session installs specialist agent files that prevent these patterns by running
mandatory checklists before and after every code change. These are not suggestions —
they are pre-flight and post-flight requirements.

---

## STEP 1 — Copy agent files into the project

The following files exist in `docs/prompts/agents/` — copy them to `.claude/agents/`:

```powershell
copy docs\prompts\agents\ui-guardian.md .claude\agents\ui-guardian.md
copy docs\prompts\agents\import-pipeline.md .claude\agents\import-pipeline.md
copy docs\prompts\agents\image-system.md .claude\agents\image-system.md
copy docs\prompts\agents\data-flow.md .claude\agents\data-flow.md
```

Verify all 4 files exist in `.claude/agents/` alongside the existing `wrapup.md` and
`navigator.md`.

---

## STEP 2 — Update CLAUDE.md with agent usage instructions

Add the following section to CLAUDE.md immediately after the opening project overview,
before any other sections:

```markdown
## AGENT SYSTEM — READ BEFORE EVERY SESSION

Specialist agent files live in `.claude/agents/`. Every session MUST read the relevant
agents before writing any code.

| If your session touches... | Read this agent |
|---------------------------|----------------|
| Any screen, modal, or component | ui-guardian.md (ALWAYS) |
| Any import path (URL, scan, Instagram, speak, file) | import-pipeline.md |
| Any image upload, display, or storage | image-system.md |
| Any Zustand store, data fetch, or cache | data-flow.md |
| Recipe detail screen (read or edit mode) | recipe-detail.md (coming soon) |
| Shopping lists | shopping-system.md (coming soon) |

Multiple agents may apply to a single session. Read all that apply.

### How to invoke an agent
At the start of your session prompt, the user will specify which agents to read.
If not specified, you must determine which apply based on the checklist above and
read them yourself before starting.

### The agents contain:
- Mandatory rules (violations = bugs)
- Pre-flight checklist (run before writing any code)
- Post-flight checklist (run before /wrapup)
- Known failure patterns specific to this codebase (do not repeat these)
```

---

## STEP 3 — Update the wrapup agent

Open `.claude/agents/wrapup.md` and add the following to the end of the wrapup
instructions:

```markdown
## POST-FLIGHT AGENT CHECKS (run before updating DONE.md)

Before declaring a session complete, confirm:

UI checks:
- Every new bottom-positioned element uses useSafeAreaInsets()
- Every new screen with text input has KeyboardAvoidingView
- Every new button row fits at 360px minimum width
- Every new user-visible string has i18n keys in all 5 locale files

Import checks (if any import path was touched):
- URL routing: Instagram URLs → IG handler, recipe URLs → URL handler, never to search
- Every import path shows PostImportImageSheet if an image could be available
- Every imported recipe has title, description, ingredients, steps populated

Image checks (if any image code was touched):
- All uploads use FileSystem.uploadAsync with Authorization + apikey headers
- All Image components for Supabase URLs have apikey header
- Recipe card reflects image changes without app restart

Data checks (if any store or DB query was touched):
- After any write: the displaying screen reflects the change without navigation
- List screens use useFocusEffect to refresh on focus

General:
- No console.log or console.warn left in production code
- TypeScript: tsc --noEmit passes with no errors
```

---

## STEP 4 — Update the session launch pattern in CLAUDE.md

Find the SESSION START section in CLAUDE.md (or add one if missing) and update it to:

```markdown
## SESSION START INSTRUCTIONS

Every Claude Code session must begin with:

1. Read CLAUDE.md (this file) fully
2. Read DONE.md to see what was last built
3. Determine which specialist agents apply to this session (see AGENT SYSTEM above)
4. Read all applicable agent files from .claude/agents/
5. Run the pre-flight checklist from each applicable agent
6. Only then begin writing code

Do not skip any of these steps. The pre-flight checklists exist because the same
bugs have been introduced and fixed multiple times. Reading the agents prevents
repeating known mistakes.
```

---

## COMPLETION CHECKLIST

- [ ] All 4 agent files copied to .claude/agents/
- [ ] .claude/agents/ now contains: wrapup.md, navigator.md, ui-guardian.md,
      import-pipeline.md, image-system.md, data-flow.md
- [ ] CLAUDE.md updated with AGENT SYSTEM section
- [ ] CLAUDE.md updated with SESSION START instructions
- [ ] wrapup.md updated with post-flight agent checks
- [ ] Run /wrapup to update DONE.md
