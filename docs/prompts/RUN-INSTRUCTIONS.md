# ChefsBook AI Brain — Master Build Instructions

## What this builds

Five sessions that transform ChefsBook's AI from a static layer into a
self-improving knowledge engine, with a community engagement loop that
feeds it continuously.

---

## Setup: before running anything

### 1. Install the prompt files

Copy all five prompt files into your repo:

```bash
cp knowledge-graph-promotion.md  /path/to/repo/docs/prompts/
cp library-account.md            /path/to/repo/docs/prompts/
cp community-knowledge.md        /path/to/repo/docs/prompts/
cp cook-mode-ui.md               /path/to/repo/docs/prompts/
cp ai-brain-research.md          /path/to/repo/docs/prompts/
```

### 2. Install OMC (if not already done)

In a Claude Code session:
```
/plugin marketplace add https://github.com/Yeachan-Heo/oh-my-claudecode
/plugin install oh-my-claudecode
/oh-my-claudecode:omc-setup --local
```

### 3. Set up the HUD (once, before your first session)

```
/oh-my-claudecode:hud setup
```

---

## Run order — strict, do not skip

```
Session 1:  knowledge-graph-promotion.md
Session 2:  library-account.md
Session 3:  community-knowledge.md
Session 4:  cook-mode-ui.md
Session 5:  ai-brain-research.md   ← runs last, after real data exists
```

Sessions 1-4 can be run on separate days.
Session 5 should run after at least Sessions 1-3 are complete.
Sessions 3 and 4 can run in parallel if you have two machines, but
Session 3 depends on Session 2 (@souschef must exist first).

---

## Session 1 — knowledge-graph-promotion.md

**What it does:** Activates 1,200+ step timings already in the DB.
Adds technique classification, promotes data into the knowledge graph,
fixes inferStepTimings() to self-feed going forward.

**Launch:**
```
/autopilot "Read and execute docs/prompts/knowledge-graph-promotion.md fully and autonomously from pre-flight through deployment and wrapup. Do not stop for questions unless you hit a genuine blocker."
```

**Rate limit handling:**
The classification script runs ~1,200 Haiku calls over ~10-15 minutes.
If Claude Code hits a rate limit mid-script:
```
omc wait --start
```
OMC will resume automatically when the limit resets.

**Verify before moving to Session 2:**
```bash
ssh pilzner@slux "docker exec supabase-db psql -U postgres -c \
  'SELECT COUNT(*), source FROM cooking_action_timings GROUP BY source;'"
```
Must show more than 40 rows total. If still 40, something went wrong —
check `scripts/food-lab-import-log.json` equivalent in that session's logs.

---

## Session 2 — library-account.md

**What it does:** Creates the @souschef ChefsBook Library account,
admin token management UI, library badge.

**Launch:**
```
/autopilot "Read and execute docs/prompts/library-account.md fully and autonomously from pre-flight through deployment and wrapup. Do not stop for questions unless you hit a genuine blocker."
```

**After this session completes:**
Go to `/admin/library-accounts` and generate a token for @souschef.
Save it to `.env.local` on slux as `CHEFSBOOK_LIBRARY_TOKEN`.
You will need this for any future targeted recipe imports.

**Verify before moving to Session 3:**
```bash
ssh pilzner@slux "docker exec supabase-db psql -U postgres -c \
  \"SELECT username, account_type, is_verified FROM user_profiles \
    WHERE username = 'souschef';\""
```
Must return one row with `account_type = library` and `is_verified = true`.

---

## Session 3 — community-knowledge.md

**What it does:** Gap detection job, admin gap queue, agent URL discovery,
community request card on My Recipes, private points and badges system.

**Depends on:** Session 2 complete (@souschef must exist).

**Launch:**
```
/autopilot "Read and execute docs/prompts/community-knowledge.md fully and autonomously from pre-flight through deployment and wrapup. ultrawork. Do not stop for questions unless you hit a genuine blocker."
```

**Note on ultrawork:** This session uses ultrawork for parallel agent
delegation. The web and mobile community cards, admin UI, and points system
are built simultaneously. If you see multiple subagents active in the HUD,
that is expected.

**After this session completes:**
1. Go to `/admin/knowledge-gaps` and run the gap detection job
2. Review detected gaps, approve the highest-priority ones
3. Set a few to "Active" so the community request card appears
4. Verify the card shows at position 2 on My Recipes

**Verify before moving to Session 4:**
```bash
ssh pilzner@slux "docker exec supabase-db psql -U postgres -c \
  'SELECT status, COUNT(*) FROM knowledge_gaps GROUP BY status;'"
```
Must show at least some `active` gaps for the card to render.

---

## Session 4 — cook-mode-ui.md

**What it does:** Full Kitchen Conductor Cook Mode UI on web and mobile,
step_actuals table, real timing feedback into the knowledge graph,
"Cooked it!" completion with points.

**Depends on:** Session 1 complete (technique columns must exist on recipe_steps).

**Launch:**
```
/autopilot "Read and execute docs/prompts/cook-mode-ui.md fully and autonomously from pre-flight through deployment and wrapup. Do not stop for questions unless you hit a genuine blocker."
```

**After this session completes:**
Cook a recipe all the way through using the new Kitchen Conductor on web
to generate the first real `step_actuals` data. Then verify:
```bash
ssh pilzner@slux "docker exec supabase-db psql -U postgres -c \
  'SELECT COUNT(*) FROM step_actuals;'"
```
Must be > 0.

---

## Session 5 — ai-brain-research.md

**What it does:** Pure research. Reads all internal docs and live DB state,
evaluates external data sources, produces `docs/ai-brain-strategy.md`.

**Depends on:** Sessions 1-3 complete (real data in the DB to analyse).

**Launch:**
```
/deep-interview --autoresearch "Read and execute docs/prompts/ai-brain-research.md fully and autonomously. Produce docs/ai-brain-strategy.md as the final deliverable. Do not stop for questions unless you hit a genuine blocker."
```

**Note:** This session writes zero code and zero migrations. If you see
the agent attempting to create files outside `docs/`, stop it and restart.
The only output is `docs/ai-brain-strategy.md`.

**After this session:**
Read `docs/ai-brain-strategy.md` carefully. It will tell you:
- What the knowledge graph now covers after Sessions 1-4
- What specific external data sources would fill remaining gaps
- The priority order for the next phase of builds
- Whether targeted recipe imports via the community queue are sufficient
  or whether structured external data is needed

---

## If a session gets stuck

**Rate limit:** `omc wait --start` — auto-resumes when limit resets.

**Genuine blocker (missing env var, etc.):** The agent will stop and tell
you what it needs. Fix the blocker, then:
```
/autopilot "Continue executing docs/prompts/[filename].md from where you
left off. The blocker has been resolved: [explain what you fixed]."
```

**Wrong output / agent went off-track:** Check the HUD for what the agent
did. If it wrote code it shouldn't have, `git diff` to review, then:
```
/autopilot "Revert the changes in [files] and continue from [step]."
```

---

## After all five sessions

The full system will be live:

| Component | Status |
|-----------|--------|
| Knowledge graph | 100+ entries, self-feeding via step_actuals |
| @souschef library account | Live, token ready for targeted imports |
| Gap detection | Running daily, gaps surfaced to admin |
| Community request cards | Live on My Recipes, users contributing |
| Cook Mode Kitchen Conductor | Live web + mobile |
| step_actuals learning loop | Active, every cook improves the graph |
| AI brain strategy doc | Produced, next phase planned |

**The first review point** is 30 days after Session 4 goes live.
Check: how many step_actuals have been recorded, how many gaps have been
filled by community contributions, and whether the knowledge graph hit rate
in inferStepTimings() has improved.

That data will tell you whether the next priority is more community
engagement, more external data, or Cook Mode improvements.
