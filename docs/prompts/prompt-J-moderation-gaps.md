# Prompt J — Moderation Gaps: Tags, Post-Publish Edits, Replies, Profiles, Cookbooks
## Scope: apps/web, packages/ai (moderation functions)

---

## AGENTS TO READ FIRST (in order)
1. `.claude/agents/wrapup.md`
2. `CLAUDE.md`
3. `DONE.md`
4. `.claude/agents/testing.md`
5. `.claude/agents/feature-registry.md`
6. `.claude/agents/deployment.md`
7. `.claude/agents/ai-cost.md` — MANDATORY (multiple new AI calls)
8. `.claude/agents/import-pipeline.md`

Run ALL pre-flight checklists before writing a single line of code.
Read the moderation audit in DONE.md (commit 186cd5c) before starting —
it contains the full coverage table and all function locations.

Key files from the audit:
- packages/ai/src/moderateRecipe.ts
- packages/ai/src/moderateComment.ts
- packages/ai/src/usernameCheck.ts
- apps/web/lib/saveWithModeration.ts
- apps/web/app/recipe/[id]/page.tsx (edit handlers)
- apps/web/app/dashboard/settings/page.tsx
- apps/web/components/RecipeComments.tsx

---

## CONTEXT

The moderation audit identified 11 unmoderated publicly visible fields.
This session closes all gaps using a NON-BLOCKING approach:
- Content saves immediately
- AI moderation runs async after save
- If AI flags the content, it is hidden/flagged automatically
- User sees no delay — only a consequence if content violates standards

Model for all new moderation calls: HAIKU (consistent with existing moderateRecipe)

---

## FIX 1 — Tag moderation

### Context
Tags are stored as a `text[]` array on the recipes table. They are completely
unmoderated and publicly visible on recipe cards.

### What to build
Create a new function `packages/ai/src/moderateTag.ts`:

```typescript
export async function moderateTag(tag: string): Promise<{
  verdict: 'clean' | 'flagged';
  reason?: string;
}>
```

Prompt (Haiku):
```
You are a content moderator for a family-friendly cooking platform.
Evaluate whether this recipe tag is appropriate for all audiences.
A tag should be rejected if it contains: profanity, hate speech,
sexual content, violence, drugs, or any content inappropriate for children.
Cooking-related tags are always acceptable.
Tag: "{tag}"
Respond with JSON only: { "verdict": "clean" | "flagged", "reason": "..." }
```

### Where to call it
In the tag save handler on the recipe detail page
(`apps/web/app/recipe/[id]/page.tsx`), after a new tag is saved to the DB:
- Fire `moderateTag(tag)` async (do not await — non-blocking)
- If verdict is `flagged`: remove the tag from the recipe's tags array
  and show a toast: *"That tag was removed — it doesn't meet our
  community guidelines."*
- Log the call via `logAiCall` — action: `moderate_tag`, model: `haiku`

Also moderate tags at import time — in the import pipeline, after tags
are extracted, filter any flagged tags before saving. This one CAN be
blocking (it's during import, not a user-facing edit).

---

## FIX 2 — Post-publish edit re-moderation (non-blocking)

### Context
When a user edits a recipe field (title, description, ingredients, steps,
notes) on a recipe that is already public, no moderation re-runs.
Attack vector: import clean recipe → publish → edit to add bad content.

### What to build
In `apps/web/app/recipe/[id]/page.tsx`, in each save handler for:
- title
- description
- ingredients
- steps
- notes

After the save completes successfully (DB updated), check if
`recipe.visibility === 'public'`. If yes:

1. Fire `moderateRecipe(updatedRecipeData)` async (do not await)
2. If verdict is `flagged` or `serious`:
   - Set `recipe.visibility = 'private'` and `recipe.moderation_status = 'flagged'`
   - Show toast to the user: *"Your recipe has been hidden while our team
     reviews a recent edit. You'll be notified when it's cleared."*
3. If verdict is `clean`: do nothing (recipe stays public)
4. Log via `logAiCall` — action: `moderate_recipe_edit`, model: `haiku`

### Important
- Only re-moderate if recipe is currently public
- Private recipes: no re-moderation needed (not publicly visible)
- Do NOT re-moderate on servings, image, or tag changes (only text content)
- Reuse the existing `moderateRecipe` function — do not duplicate it
- The existing function checks title, description, first 5 ingredients,
  first 3 steps, notes — pass the full updated recipe object

---

## FIX 3 — Comment reply moderation

### Context
`moderateComment` runs on top-level comments only. Replies (comments with
a `parent_id`) are not moderated. This is a bypass vector.

### What to build
In `apps/web/components/RecipeComments.tsx`, find where replies are saved.
Apply the same `moderateComment` call that top-level comments use.

The only difference between top-level and reply moderation should be the
`parent_id` — the content check is identical.

If the existing comment moderation has a CORS issue on web (noted in audit),
wrap in try/catch and allow the reply to post if moderation fails — same
pattern as existing top-level comment handling.

Log via `logAiCall` — action: `moderate_comment_reply`, model: `haiku`

---

## FIX 4 — User bio and display name moderation

### Context
User bio (160 chars) and display_name are publicly visible on chef profiles
and recipe attribution. Neither is moderated on save.

### What to build
Create `packages/ai/src/moderateProfile.ts`:

```typescript
export async function moderateProfile(fields: {
  bio?: string;
  display_name?: string;
}): Promise<{
  verdict: 'clean' | 'flagged';
  flaggedFields: string[];
  reason?: string;
}>
```

Prompt (Haiku):
```
You are a content moderator for a family-friendly cooking platform.
Evaluate whether these user profile fields are appropriate for all audiences.
Reject content containing: profanity, hate speech, sexual content,
violence, spam, or anything inappropriate for children.
Fields to check:
Display name: "{display_name}"
Bio: "{bio}"
Respond with JSON only: { "verdict": "clean" | "flagged",
"flaggedFields": ["bio"|"display_name"], "reason": "..." }
```

### Where to call it
In `apps/web/app/dashboard/settings/page.tsx`, after bio or display_name
is saved:
- Fire `moderateProfile()` async (non-blocking)
- If flagged: revert the field(s) to previous value in DB, show toast:
  *"Your profile update was removed — it doesn't meet our community
  guidelines."*
- Log via `logAiCall` — action: `moderate_profile`, model: `haiku`

---

## FIX 5 — Cookbook name and description moderation

### Context
Cookbook names and descriptions are publicly visible if the cookbook is
set to public. Neither is currently moderated.

### What to build
Find the cookbook create/edit handler. After save:
- If cookbook is public: fire `moderateProfile()` (reuse — same simple
  text check) with `{ bio: description, display_name: name }` async
- If flagged: set cookbook visibility to private, show toast:
  *"Your cookbook has been hidden — the name or description doesn't meet
  our community guidelines."*
- Log via `logAiCall` — action: `moderate_cookbook`, model: `haiku`

---

## AI COST ESTIMATE

All new moderation calls use Haiku (~$0.0001–$0.0003 each):
- Tag moderation: fires on each new tag added (~$0.0002/tag)
- Post-publish edit re-moderation: fires on each public recipe edit
  (~$0.0003/edit)
- Comment reply moderation: fires on each reply (~$0.0001/reply)
- Profile moderation: fires on bio/display_name save (~$0.0002/save)
- Cookbook moderation: fires on public cookbook save (~$0.0002/save)

Update `.claude/agents/ai-cost.md` with all new rows.

---

## IMPLEMENTATION ORDER

1. Create `packages/ai/src/moderateTag.ts`
2. Create `packages/ai/src/moderateProfile.ts`
3. Wire tag moderation into recipe detail page tag save handler
4. Wire tag moderation into import pipeline (blocking, import-time)
5. Wire post-publish edit re-moderation into each text field save handler
6. Wire comment reply moderation into RecipeComments.tsx
7. Wire profile moderation into settings page
8. Wire cookbook moderation into cookbook edit handler
9. Update `ai-cost.md` with all new rows
10. Update `feature-registry.md`
11. TypeScript check: `cd apps/web && npx tsc --noEmit` — must be clean
12. Deploy per `deployment.md`

---

## GUARDRAILS
- All new moderation is NON-BLOCKING for user-facing edits — save first,
  moderate async
- Import-time tag moderation is the ONLY blocking moderation added here
- Never block a user action waiting for AI — wrap all async calls in
  try/catch, allow action if AI fails
- Reuse existing `moderateRecipe` and `moderateComment` functions —
  do not duplicate
- Only re-moderate public recipes on edit — private recipes skip
- Do NOT add moderation to image uploads (separate concern)
- Model is ALWAYS Haiku for moderation — never Sonnet

---

## TESTING REQUIREMENTS

1. Add an offensive tag to a public recipe → tag is removed, toast appears
2. Edit title of a public recipe to contain profanity → recipe goes private,
   toast appears
3. Post a reply comment with profanity → reply is hidden/flagged
4. Save a bio with offensive content → bio reverts, toast appears
5. Clean edits (normal text) → no moderation action, content saves normally
6. Private recipe edit → no re-moderation triggered

---

## WRAPUP REQUIREMENT
DONE.md entry must include:
- All new files created (moderateTag.ts, moderateProfile.ts)
- All files modified with the specific save handlers that were updated
- ai-cost.md updated rows confirmed
- tsc clean confirmed
- Deploy confirmed
