# Prompt: ChefsBook AI Brain — Data Strategy & Sous Chef Intelligence Research

## LAUNCH PROMPT (paste this into Claude Code to start the session)

```
/deep-interview --autoresearch "Read and execute docs/prompts/ai-brain-research.md fully and autonomously. Produce docs/ai-brain-strategy.md as the final deliverable. Do not stop for questions unless you hit a genuine blocker."
```

> This is a **pure research session**. Write zero production code.
> The deliverable is a single strategy document: `docs/ai-brain-strategy.md`.
> If you find yourself writing code, stop — you are in the wrong mode.

---

## TYPE: RESEARCH — STRATEGY DOCUMENT
## OMC MODE: deep-interview + autoresearch (no code, no migrations, no deployment)

## Mission

Produce a comprehensive, actionable strategy document that answers:

1. **What does ChefsBook's AI currently know?** — Map every AI touchpoint,
   every prompt, every data table the AI reads or writes.

2. **What is the knowledge graph today and what is it missing?** — Audit the
   `cooking_action_timings` table, the `inferStepTimings()` function, and the
   full learning loop design vs. its current implementation state.

3. **What does the Sous Chef feature specifically need to be great?** — Map
   `askSousChef()`, the personal versions system, and what data would make
   suggestions faster, cheaper, and more accurate.

4. **What external data sources should we use and why?** — Evaluate each
   candidate source against ChefsBook's specific gaps, with licensing, cost,
   format, and integration complexity assessed.

5. **What is the priority build order?** — Rank every recommended data
   acquisition and integration by impact vs. effort, tied to specific user-
   facing improvements.

---

## OMC agent routing

| Task | Agent | Model |
|------|-------|-------|
| Read all planning docs | researcher | opus |
| Audit packages/ai/src/ | researcher | sonnet |
| Audit DB schema (AI-related tables) | researcher | sonnet |
| Read ai-cost.md + cost analysis | researcher | haiku |
| External dataset evaluation | researcher | sonnet |
| Gap analysis synthesis | architect | opus |
| Write final strategy document | architect | opus |

---

## Step 1 — Read all internal strategy and planning documents

Read these files in full before doing anything else:

```
.omc/planning/01-competitive-landscape.md
.omc/planning/02-data-strategy.md
.omc/planning/04-monetisation.md
.omc/planning/chefsbook-strategy-2026.md
CLAUDE.md
DONE.md  (full — pay particular attention to all AI-related sessions)
.claude/agents/ai-cost.md
.claude/agents/import-pipeline.md
.claude/agents/feature-registry.md
```

Extract and note:
- The knowledge graph learning loop design
- The `step_actuals` gap and what completing it would unlock
- The `inferStepTimings()` cost-reduction model
- Every AI function listed in `ai-cost.md` with its model, cost, and purpose
- The competitive moat claims — what data would actually prove them

---

## Step 2 — Audit the full AI layer in packages/ai/src/

Read every file in `packages/ai/src/`. For each function, record:

| Function | Model | Trigger | Input data | Output | Reads from DB | Writes to DB |
|----------|-------|---------|------------|--------|---------------|--------------|

Pay special attention to:
- `importFromUrl.ts` — what does the AI extract and what gets stored?
- `askSousChef()` — what context does it receive? what would improve it?
- `inferStepTimings()` — how does it query the knowledge graph? what hits vs misses?
- `suggestTagsForRecipe.ts` — what taxonomy does it use?
- `moderateRecipe.ts` — what signals does it evaluate?
- `generateMealPlan()` — what constraints does it understand?
- Any function that currently calls Claude when cached/structured data could answer instead

---

## Step 3 — Audit AI-related database tables

Query slux for current state of every knowledge/AI table:

```bash
# Knowledge graph
ssh pilzner@slux "docker exec supabase-db psql -U postgres -c \
  \"SELECT technique, COUNT(*) as entries, AVG(confidence) as avg_confidence,
    MIN(duration_min) as min_mins, MAX(duration_max) as max_mins
    FROM cooking_action_timings GROUP BY technique ORDER BY entries DESC;\""

# What techniques exist vs what are missing
ssh pilzner@slux "docker exec supabase-db psql -U postgres -c \
  \"SELECT source, COUNT(*) FROM cooking_action_timings GROUP BY source;\""

# Recipe completeness — what fields are consistently populated
ssh pilzner@slux "docker exec supabase-db psql -U postgres -c \
  \"SELECT
    COUNT(*) as total,
    COUNT(description) as has_description,
    COUNT(nutrition) as has_nutrition,
    COUNT(tags) FILTER (WHERE array_length(tags,1) > 0) as has_tags,
    COUNT(cuisine_type) as has_cuisine,
    COUNT(source_url) as has_source_url
    FROM recipes;\""

# Cooking sessions — how much actual cook mode data exists
ssh pilzner@slux "docker exec supabase-db psql -U postgres -c \
  \"SELECT COUNT(*) FROM cooking_sessions;\""

# step_actuals — does this table exist yet?
ssh pilzner@slux "docker exec supabase-db psql -U postgres -c \
  \"SELECT to_regclass('public.step_actuals');\""

# Personal versions — usage signal
ssh pilzner@slux "docker exec supabase-db psql -U postgres -c \
  \"SELECT COUNT(*) FROM recipes WHERE is_personal_version = true;\""
```

Document the current state precisely. The gap between designed and actual is
the most important finding.

---

## Step 4 — Map the Sous Chef feature end-to-end

Read:
- `apps/mobile/components/AskSousChefSheet.tsx`
- `apps/web/components/AskSousChefModal.tsx`
- `packages/ai/src/` — the `askSousChef()` function
- `apps/web/app/api/recipes/[id]/sous-chef-suggest/route.ts`

Answer these questions precisely:

1. What context does `askSousChef()` receive today? (recipe data, user history,
   knowledge graph, nothing else?)
2. What does it NOT receive that would make suggestions materially better?
3. How does a user's modification feedback loop back into future suggestions?
   (Does it at all right now?)
4. What is the token cost per `askSousChef()` call and what drives it up?
5. Where could structured data replace a Claude call entirely?

---

## Step 5 — Evaluate external data sources

Evaluate each source against ChefsBook's specific identified gaps.
Do not produce generic summaries — map each source to exact gaps found in Steps 2-4.

### Sources to evaluate:

**RecipeNLG** (Hugging Face, CC-BY 4.0)
- 2.2M recipes, ingredients + steps + titles
- Assess: what gaps in ChefsBook's knowledge does this fill?
- Assess: RAG index vs. structured extraction vs. fine-tuning — which fits?
- Assess: overlap with what Claude already knows natively

**USDA FoodData Central** (public domain)
- Nutritional data, ingredient taxonomy, portion sizes
- Assess: does ChefsBook's nutrition feature already use this or similar?
- Assess: what Sous Chef suggestions would this unlock?

**Open Food Facts** (CC-BY-SA 4.0)
- 3M+ products, ingredients, allergens, nutritional data
- Assess: ingredient substitution use case
- Assess: dietary restriction compliance checking

**Wikipedia Cooking Techniques** (CC-BY-SA)
- Already partially used via `seed-cooking-knowledge.mjs`
- Assess: what techniques are still missing from `cooking_action_timings`?
- Assess: what other Wikipedia categories are relevant beyond timing?

**TheMealDB** (free API, structured)
- Categorised recipes by cuisine, ingredient, area
- Assess: taxonomy/categorisation value vs. recipe content value
- Assess: licence terms for commercial use

**Wikidata food ontology** (CC0)
- Ingredient relationships, cuisine hierarchies, flavour pairings
- Assess: flavour pairing use case for menu Sous Chef
- Assess: integration complexity

**Pre-1928 Public Domain Cookbooks**
- Escoffier's Le Guide Culinaire (1903), Fannie Farmer (1896),
  Larousse Gastronomique (1938 — check edition dates carefully)
- Assess: classical technique coverage gaps
- Assess: extraction approach (PDF → structured data)

**FoodPairing API** (commercial, molecular gastronomy)
- Flavour compound compatibility data
- Assess: menu-level Sous Chef use case
- Assess: cost per query vs. value

For each source, produce a structured assessment:
```
Source: [name]
Licence: [exact licence, commercial use: yes/no]
Size: [volume of data]
Format: [how it arrives — API/download/CSV/etc]
Gaps it fills: [specific gaps from Steps 2-4]
Gaps it does NOT fill: [honest assessment]
Integration approach: [RAG / structured DB / fine-tune / query-time API]
Estimated effort: [hours to integrate]
Estimated cost: [one-time / recurring]
Recommendation: [Use / Evaluate further / Skip — with one sentence why]
```

---

## Step 6 — Synthesise and write docs/ai-brain-strategy.md

Write a complete strategy document with these sections:

### 1. Executive summary (1 page)
The current state, the biggest gap, the single highest-leverage action.

### 2. Current AI architecture map
Every AI touchpoint, its cost, its data inputs, and what it produces.
Include the `inferStepTimings()` cost-reduction model and its current hit rate.

### 3. The knowledge graph: current state vs. designed state
What was designed in `.omc/planning/02-data-strategy.md`.
What is actually built and populated today.
What the gap costs in AI API spend and response quality.

### 4. Sous Chef: what it needs to be great
Specific data inputs that `askSousChef()` is missing.
What a "great" Sous Chef suggestion looks like vs. current output.
Which gaps are solvable with structured data vs. requiring more Claude.

### 5. External data source recommendations
Full assessment table for all evaluated sources.
Recommended stack with rationale.

### 6. Integration strategy
For each recommended source:
- How the data enters ChefsBook (script / API / migration)
- Where it lives in the DB schema
- How the AI layer consumes it (RAG / direct query / cached lookup)
- How it reduces Claude API calls over time

### 7. Priority build order
Ranked list of recommended actions, each with:
- What gets built
- Which user-facing feature improves and how
- Estimated AI cost reduction (if applicable)
- Effort estimate
- Dependency on other items in the list

### 8. The learning loop roadmap
Step-by-step plan from current state to the full knowledge graph learning loop:
`step_actuals` → `cooking_action_timings` → `inferStepTimings()` → cost curve
Include what Cook Mode UI milestones unlock each stage.

---

## Output requirements

- File: `docs/ai-brain-strategy.md`
- Audience: the engineering team and founder — technically precise, no fluff
- Length: as long as it needs to be, no padding
- Every recommendation must cite specific evidence from the internal docs or
  DB audit — no generic advice
- Do not recommend anything that contradicts existing architectural decisions
  in CLAUDE.md or the planning documents
- Flag any contradictions found between planning docs and current implementation

---

## Wrapup

This session produces one file: `docs/ai-brain-strategy.md`.
No DONE.md entry needed — this is planning, not implementation.
No deployment. No migrations. No code.

Add a single line to AGENDA.md:
```
[ ] Review docs/ai-brain-strategy.md and prioritise implementation items
```
