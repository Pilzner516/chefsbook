# Prompt Q — Categorical Field Moderation: Close All Pipeline Gaps
## Scope: packages/ai, apps/web (all import paths + save handlers)

---

## AGENTS TO READ FIRST (in order)
1. `.claude/agents/wrapup.md`
2. `CLAUDE.md`
3. `DONE.md`
4. `.claude/agents/testing.md`
5. `.claude/agents/feature-registry.md`
6. `.claude/agents/deployment.md`
7. `.claude/agents/import-pipeline.md`
8. `.claude/agents/import-quality.md`
9. `.claude/agents/ai-cost.md`

Run ALL pre-flight checklists before writing a single line of code.

Read the following files in full before writing any code:
- `packages/ai/src/moderateTag.ts`
- `packages/db/src/queries/tagModeration.ts`
- `.claude/agents/import-pipeline.md` — understand ALL import paths

Inspect: `\d recipes`

---

## CONTEXT

The tag moderation system (Prompt J + M) runs when users add tags
via the recipe detail page tag save handler. However multiple gaps exist:

1. **Cuisine field** — user-visible, never moderated at any path
2. **Import-time gaps** — URL import moderates tags[] but not cuisine
3. **Scan/Speak/YouTube/PDF paths** — may bypass tag moderation entirely
4. **Re-import/refresh** — re-fetched content not re-moderated

A recipe was found with cuisine = "my butt" — publicly visible, never
flagged. This is the class of bug this prompt fixes permanently.

---

## THE FIX: Single shared moderateCategoricalFields() helper

### Step 1 — Create the helper
Create `packages/ai/src/moderateCategoricalFields.ts`:

```typescript
import { isTagBlocked, logTagRemoval } from '@chefsbook/db';
import { moderateTag } from './moderateTag';

export interface CategoricalFields {
  tags?: string[];
  cuisine?: string;
  course?: string;      // meal type / course if stored separately
  // add other categorical fields as found in recipes table
}

export interface ModerationResult {
  tags: string[];           // cleaned tags array
  cuisine: string | null;   // cleaned cuisine or null if removed
  course: string | null;    // cleaned course or null if removed
  removed: Array<{
    field: string;
    value: string;
    reason: 'blocked_list' | 'ai_flagged';
  }>;
}

export async function moderateCategoricalFields(
  recipeId: string,
  userId: string,
  fields: CategoricalFields
): Promise<ModerationResult> {
  const result: ModerationResult = {
    tags: fields.tags ?? [],
    cuisine: fields.cuisine ?? null,
    course: fields.course ?? null,
    removed: [],
  };

  // Helper to check a single value
  async function checkValue(
    field: string,
    value: string
  ): Promise<boolean> {
    // Step 1: blocked list (fast, no AI cost)
    if (await isTagBlocked(value)) {
      await logTagRemoval(recipeId, value, 'blocked_list',
        `${field} field`, userId);
      result.removed.push({ field, value, reason: 'blocked_list' });
      return false; // remove this value
    }
    // Step 2: AI check
    const verdict = await moderateTag(value);
    if (verdict.verdict === 'flagged') {
      await logTagRemoval(recipeId, value, 'ai',
        verdict.reason ?? `${field} field`, userId);
      result.removed.push({ field, value, reason: 'ai_flagged' });
      return false; // remove this value
    }
    return true; // keep this value
  }

  // Check tags array
  const cleanTags: string[] = [];
  for (const tag of (fields.tags ?? [])) {
    if (await checkValue('tags', tag)) {
      cleanTags.push(tag);
    }
  }
  result.tags = cleanTags;

  // Check cuisine
  if (fields.cuisine) {
    const keep = await checkValue('cuisine', fields.cuisine);
    result.cuisine = keep ? fields.cuisine : null;
  }

  // Check course/meal type if present
  if (fields.course) {
    const keep = await checkValue('course', fields.course);
    result.course = keep ? fields.course : null;
  }

  return result;
}
```

Export from `packages/ai/src/index.ts`.

### Step 2 — Identify ALL import paths
Read `.claude/agents/import-pipeline.md` carefully.
Find every function/route that creates or updates a recipe with
categorical fields. This includes at minimum:
- URL import (`packages/ai/src/importFromUrl.ts`)
- YouTube import (`packages/ai/src/importFromYouTube.ts`)
- Scan/OCR import
- Speak a Recipe import
- PDF import
- Re-import / refresh from source
- Instagram import (if exists)
- Extension import route (`apps/web/app/api/extension/import/route.ts`)

For each path, find where `tags`, `cuisine`, and `course` are set
before being saved to the DB.

### Step 3 — Wire moderateCategoricalFields() into every import path

At the point where categorical fields are assembled (before DB insert),
call `moderateCategoricalFields()` and use the cleaned result:

```typescript
// BEFORE saving to DB:
const moderated = await moderateCategoricalFields(
  recipeId,    // use temp ID or recipe ID after insert
  userId,
  {
    tags: extractedTags,
    cuisine: extractedCuisine,
    course: extractedCourse,
  }
);

// Use moderated values for DB insert:
tags = moderated.tags;
cuisine = moderated.cuisine;
course = moderated.course;
```

**Important:** At import time this is BLOCKING — we want the saved
recipe to already have clean fields. This is acceptable because the
user is waiting for import to complete anyway and the AI cost is tiny.

### Step 4 — Wire into recipe detail save handlers

In `apps/web/app/recipe/[id]/page.tsx`, the cuisine field (if editable)
must also pass through moderation on save. Find the cuisine save handler
and add the check.

For the tag save handler — verify it already calls `isTagBlocked()` and
`moderateTag()`. If it does, update it to use the new shared helper
instead of duplicate logic.

### Step 5 — Re-import path
In the re-import/refresh from source flow, ensure that when new tags
or cuisine values come back from the source, they are moderated before
being saved. The re-import should not bypass moderation.

---

## FIELD NAMES TO CHECK

Before writing code, verify the actual column names:
```sql
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'recipes'
AND column_name IN ('tags', 'cuisine', 'course', 'meal_type', 
                    'category', 'diet_type');
```

Only moderate fields that actually exist. Report which fields were found.

---

## AI COST

`moderateCategoricalFields()` calls `moderateTag()` (Haiku) for each
field value not in the blocked list.

For a typical import with 8 tags + cuisine + course = ~10 values:
- Blocked list hits: free
- AI checks: ~10 × $0.0002 = ~$0.002 per import

This is acceptable. Update `ai-cost.md` with the new row:
- Function: `moderateCategoricalFields`
- Model: Haiku
- Cost: ~$0.0002 per field checked
- Trigger: every import + save of categorical fields

---

## IMPLEMENTATION ORDER
1. Inspect recipes table schema for categorical field names
2. Create `packages/ai/src/moderateCategoricalFields.ts`
3. Export from packages/ai index
4. Wire into URL import path
5. Wire into YouTube import path
6. Wire into scan/OCR import path
7. Wire into Speak a Recipe path
8. Wire into PDF import path (if exists)
9. Wire into re-import/refresh path
10. Wire into extension import route
11. Wire into recipe detail cuisine save handler (if editable)
12. Update tag save handler to use shared helper (remove duplication)
13. Update ai-cost.md
14. TypeScript check: `cd apps/web && npx tsc --noEmit` — must be clean
15. Also check: `cd packages/ai && npx tsc --noEmit` if possible
16. Deploy per `deployment.md`

---

## GUARDRAILS
- Import-time moderation is BLOCKING (acceptable — user is waiting)
- Recipe detail save handlers are NON-BLOCKING (fire async after save)
- Never call AI for values that are in the blocked list — blocked list
  check always runs first
- If moderateCategoricalFields() throws, log the error and proceed
  with unmoderated values — never fail an import due to moderation error
- Do NOT moderate the cuisine/course values that come from a predefined
  system list (e.g. dropdown options) — only moderate free-text values
  that users or AI can generate freely

---

## REGRESSION CHECKS — MANDATORY
1. Import a URL recipe → cuisine and tags are moderated, clean values saved ✓
2. Import a YouTube recipe → same ✓
3. Offensive cuisine value at import → removed before save ✓
4. Offensive tag at import → removed before save ✓  
5. Re-import a recipe → new tags/cuisine moderated ✓
6. Existing working imports not broken — normal recipes import correctly ✓
7. tag_moderation_log has entries for removed fields ✓
8. My Recipes images still show ✓
9. Search page images still show ✓
10. Recipe detail page still works ✓

---

## WRAPUP REQUIREMENT
DONE.md entry must include:
- Categorical fields found in DB (actual column names)
- List of ALL import paths updated (with file paths)
- Any import paths that were NOT updated and why
- ai-cost.md updated row confirmed
- All 10 regression checks confirmed
- tsc clean + deploy confirmed
