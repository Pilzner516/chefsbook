# Prompt A — Global "Sous Chef" Rename
## Scope: All authenticated in-app AI loading/status text (Web + Mobile)

---

## AGENTS TO READ FIRST (in order)
1. `.claude/agents/wrapup.md`
2. `CLAUDE.md`
3. `DONE.md`
4. `.claude/agents/testing.md`
5. `.claude/agents/feature-registry.md`
6. `.claude/agents/deployment.md` (web is touched)
7. `.claude/agents/ui-guardian.md` (text/copy changes in components)

Run ALL pre-flight checklists before writing a single line of code.

---

## OBJECTIVE

Rename all AI references in the **authenticated in-app experience** to use the "Sous Chef" persona.
This is a copy/UX change only — no logic, no API calls, no schema changes.

The Sous Chef persona is: warm, skilled, helpful. It is the platform's name for any AI action
happening on behalf of the user inside the app. Think of it as the friendly kitchen assistant
that works in the background.

---

## CARVE-OUTS — DO NOT TOUCH

1. **`apps/web/app/page.tsx` (landing page)** and any marketing/feature-description copy at
   `chefsbk.app` that is visible to unauthenticated users. These describe features to prospective
   users and must stay as-is.
2. **Code identifiers** — function names, variable names, type names, file names, API route paths.
   Only user-facing display strings change.
3. **Error messages that reference technical failures** (e.g. "Claude API error", server logs,
   console.warn) — leave those as-is; they are developer-facing.
4. **Comments in source code** — leave unchanged.

---

## SEARCH STRATEGY

Do a project-wide text search for each of the following terms and review every hit:

```
"AI is"
"AI will"
"AI has"
"AI can"
"Generating"
"Scanning"
"Analyzing"
"Processing your recipe"
"Fetching"
"Importing"
"Reading your"
"Creating your"
"Building your"
"Detecting"
"Identifying"
```

Also search for the spinner/loading text props on:
- Any `LoadingSpinner` or equivalent component
- Any `toast(...)` call that references AI activity
- Any `placeholder` or `label` text adjacent to an AI-triggered action
- Any modal/drawer title that shows during an AI operation

---

## REPLACEMENT RULES

Apply these mappings. The goal is warm, natural language — not robotic announcements.

| Context | Old pattern (examples) | New copy |
|---|---|---|
| Recipe import / URL fetch | "Fetching recipe…", "Importing recipe…", "AI is importing" | "Your Sous Chef is fetching this recipe…" |
| Recipe scan / OCR | "Scanning…", "AI is reading", "Analyzing image" | "Your Sous Chef is reading your recipe…" |
| AI image generation | "Generating image…", "AI is creating your image" | "Your Sous Chef is creating your image…" |
| Recipe suggestion / fill | "AI is suggesting…", "Generating suggestions" | "Your Sous Chef is preparing suggestions…" |
| Meal plan generation | "Generating meal plan…", "AI is building" | "Your Sous Chef is planning your week…" |
| Recipe translation | "Translating…", "AI is translating" | "Your Sous Chef is translating this recipe…" |
| Comment moderation | Any user-visible moderation spinner text | "Your Sous Chef is reviewing…" |
| YouTube import | "Fetching from YouTube…" | "Your Sous Chef is fetching this recipe…" |
| Guided scan follow-up questions | "AI is generating questions" | "Your Sous Chef has a few questions…" |
| Generic AI loading fallback | Any other AI loading state not listed above | "Your Sous Chef is working on it…" |
| Re-import / refresh from source | "Re-importing…", "Refreshing…" | "Your Sous Chef is refreshing this recipe…" |

---

## PLATFORM-SPECIFIC NOTES

### Web (`apps/web`)
- Toast messages: `toast.loading(...)`, `toast.success(...)`, `toast.error(...)` — update the
  loading/in-progress ones only. Error toasts stay factual.
- Modal/drawer titles shown during AI operations.
- Button loading states (e.g. a button that shows spinner text while AI runs).
- Any `aria-label` on a spinner that describes AI activity.

### Mobile (`apps/mobile`)
- `ActivityIndicator` label props and any sibling `<Text>` that describes what AI is doing.
- Alert titles/messages triggered by AI operations.
- Any `GuidedScanFlow.tsx` step text that describes AI processing.
- i18n locale files: **update all 5 locales** (`en`, `fr`, `es`, `it`, `de`) with appropriate
  translations of "Sous Chef" (it is a French culinary term — it can be used as-is in all locales,
  but the surrounding sentence should be in the target language).
  - Example French: "Votre Sous Chef prépare votre recette…"
  - Example Italian: "Il tuo Sous Chef sta preparando la ricetta…"
  - Example Spanish: "Tu Sous Chef está preparando la receta…"
  - Example German: "Dein Sous Chef bereitet dein Rezept vor…"

---

## IMPLEMENTATION ORDER

1. Web — search and replace all loading/status strings in `apps/web`
2. Web — update any i18n locale files under `apps/web/locales/`
3. Mobile — search and replace all loading/status strings in `apps/mobile`
4. Mobile — update all 5 locale files under `apps/mobile/locales/`
5. TypeScript check: `cd apps/web && npx tsc --noEmit` — must be clean
6. TypeScript check: `cd apps/mobile && npx tsc --noEmit` — must be clean (pre-existing
   expo-file-system warning is acceptable)

---

## TESTING REQUIREMENTS

For each platform, provide a list of every file changed with the old string and new string.
Do not mark this done without that list.

Web deploy: follow `deployment.md` — build on RPi5, verify chefsbk.app loads.

---

## GUARDRAILS

- Do NOT change any logic, conditions, or API calls.
- Do NOT rename any functions or variables.
- Do NOT touch the landing page (`apps/web/app/page.tsx` or any unauthenticated route).
- Do NOT change error messages in catch blocks (those are developer-facing).
- If a string is used in both authenticated and unauthenticated contexts, leave it unchanged
  and flag it in your DONE.md entry for a future pass.

---

## WRAPUP REQUIREMENT

DONE.md entry must include:
- Full list of files changed
- Before/after for every string modified
- tsc output for both web and mobile
- Confirmation that landing page was not touched (grep proof: `grep -r "Sous Chef" apps/web/app/page.tsx` returns nothing)
