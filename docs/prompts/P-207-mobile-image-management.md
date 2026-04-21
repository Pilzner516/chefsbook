# P-207 — Mobile: Recipe Image Management (Generate, Change, Remove)

## WAVE 2 — Starts only after P-205 /wrapup is complete
## git pull required at session start to pick up P-205's recipe/[id].tsx changes

---

## SESSION START

Wait for confirmation that P-205 has completed `/wrapup` and DONE.md has been updated before beginning.

```bash
git pull origin main
```

Read agents in this order:
1. `.claude/agents/wrapup.md`
2. `CLAUDE.md` (full)
3. `DONE.md` — confirm P-205 entries are present
4. `.claude/agents/testing.md` (MANDATORY)
5. `.claude/agents/feature-registry.md` (MANDATORY)
6. `.claude/agents/ui-guardian.md` (MANDATORY)
7. `.claude/agents/navigator.md` (MANDATORY)
8. `.claude/agents/image-system.md` (MANDATORY — any image upload, display, storage)
9. `.claude/agents/ai-cost.md` (MANDATORY — AI image generation calls)
10. `.claude/agents/data-flow.md`

Run ALL pre-flight checklists before proceeding.

---

## Context
QA report 4/20/2026 Item 5. Currently: no way on mobile to add, change, or remove a recipe image; Speak-a-Recipe generates no image. Web has full image management — this session brings parity to mobile.

---

## Pre-Flight Research (required before writing any code)

Read the web implementation first:
- Find the "Change image" popup/modal on web (`apps/web/`)
- Find the AI image generation flow (Replicate Flux, creativity slider, 10-theme system)
- Find `EditImageGallery` component referenced in CLAUDE.md
- Understand plan gating: Free/Chef/Family → Flux Schnell; Pro → Flux Dev; admin override always allows Pro

Verify DB schema:
```bash
ssh rasp@rpi5-eth "psql postgresql://supabase_admin:<pw>@localhost:5432/postgres -c '\d recipes'"
ssh rasp@rpi5-eth "psql postgresql://supabase_admin:<pw>@localhost:5432/postgres -c '\d recipe_user_photos'"
```

---

## Feature A — "Change Image" on Recipe Detail (owner only)

On `apps/mobile/app/recipe/[id].tsx`, for `recipe.user_id === currentUser.id` only:

1. Add a **"Change Image"** button overlaid on the recipe hero image — small floating button bottom-right of the image, camera/pencil icon.
2. Tap opens a bottom sheet / action sheet with options:
   - **Take a Photo** — camera → upload to Supabase storage → set as primary image
   - **Choose from Library** — image picker → upload to Supabase storage → set as primary image
   - **Generate AI Image** — opens Feature B below
   - **Remove Image** — clear `recipes.image_url`, show empty placeholder. Confirm with ChefsDialog first.
3. After any change: update `recipes.image_url` in DB + update local Zustand state optimistically.
4. All Supabase storage uploads MUST include `apikey` header — per CLAUDE.md gotcha. Follow the same pattern as `EditImageGallery` on web exactly.

---

## Feature B — AI Image Generation Modal

When "Generate AI Image" is selected:

1. Open a modal/sheet with:
   - **Theme picker** — 10 themes (reuse the theme list from web code exactly). Horizontal scroll or grid with names. No remote preview images required.
   - **Creativity slider** — 1–5, default 3. Label "Creativity" with − / + controls or a slider.
   - **Generate** button — pomodoro red `#ce2b37`, white text.
2. Loading state while generating: spinner + "Generating your image…" text.
3. On success: show generated image preview. Two buttons: **Use this image** / **Try again** (honour the one-free-regeneration limit — check web logic for how this is tracked and replicate).
4. **Use this image**: upload to Supabase storage (with `apikey` header), update `recipes.image_url`, close modal.
5. Plan gating — check plan BEFORE showing Generate button:
   - Free: upgrade prompt instead of Generate button
   - Chef/Family: Flux Schnell
   - Pro: Flux Dev
   - Admin: always Flux Dev
6. Generation call must go through existing `@chefsbook/ai` or a server-side API endpoint — do NOT call Replicate directly from mobile client.
7. Log every generation call via `logAiCallFromClient` (same pattern as GuidedScanFlow, session 203).
8. If Replicate credits are $0: show "Image generation unavailable. Please try again later." — do NOT crash.

---

## Feature C — Auto-Generate Image for Speak-a-Recipe

When a recipe is saved via the Speak-a-Recipe flow and has no image:

1. After recipe save succeeds, trigger Flux Schnell image generation in the background — non-blocking, do not delay recipe save or user navigation.
2. Use recipe title as prompt seed. Default theme (index 0 or web default). Creativity 3.
3. On success: update `recipes.image_url` silently — user sees image when they next open recipe detail.
4. On failure: silent. Recipe exists without image. No error shown to user.
5. Plan gating: Free → skip (no image, not an error). Chef+ → Flux Schnell. Pro → Flux Dev.
6. Log via `logAiCallFromClient`.

---

## Testing Evidence Required

**Feature A (Change Image):**
- ADB screenshot — "Change Image" button visible on recipe hero image for owned recipe
- ADB screenshot — action sheet with all four options visible

**Feature B (AI Generation):**
- ADB screenshot — theme picker and creativity slider in generation modal
- ADB screenshot — loading state during generation
- ADB screenshot — image preview with "Use this image" / "Try again"
- psql: `SELECT image_url, updated_at FROM recipes WHERE id = '<test recipe id>';` — confirm image_url updated

**Feature C (Speak-a-Recipe auto-generate):**
- Create a recipe via Speak-a-Recipe with a Chef+ account
- psql: confirm new recipe has `image_url` populated (Chef+) or null (Free)

**Plan gating:**
- ADB screenshot — Free user sees upgrade prompt instead of Generate button

---

## Session Close
```
/wrapup
```
Wrapup requires all evidence above plus confirmation that `logAiCallFromClient` calls appear in the `ai_usage` table for any generation that ran.

---

## Guardrails
- git pull before starting — must have P-205's recipe/[id].tsx changes
- Do NOT touch scan/camera flow (P-208)
- Do NOT touch web files
- Do NOT call Replicate directly from mobile client
- Do NOT change `recipe_user_photos` gallery if it already exists — only modify primary `image_url`
- All Supabase storage uploads must include `apikey` header
- All AI generation must be logged via `logAiCallFromClient`
- Do NOT add new DB tables or columns unless absolutely necessary
