# ChefsBook — Session 57: Install AI Cost Agent
# Purpose: Add ai-cost.md to agent system and update CLAUDE.md
# Target: .claude/agents/ + CLAUDE.md

---

## STEP 1 — Copy agent file

```powershell
copy docs\prompts\agents\ai-cost.md .claude\agents\ai-cost.md
```

Verify it exists in `.claude/agents/`.

---

## STEP 2 — Update CLAUDE.md agent lookup table

Add ai-cost.md to the AGENT SYSTEM section:

```markdown
| Any feature that calls Claude API or @chefsbook/ai | ai-cost.md (MANDATORY) |
```

---

## STEP 3 — Update SESSION START

Add to the SESSION START INSTRUCTIONS in CLAUDE.md:

```markdown
- If session touches any AI feature or @chefsbook/ai: read ai-cost.md
```

---

## COMPLETION CHECKLIST

- [ ] ai-cost.md in .claude/agents/
- [ ] CLAUDE.md lookup table updated
- [ ] SESSION START updated
- [ ] Run /wrapup
