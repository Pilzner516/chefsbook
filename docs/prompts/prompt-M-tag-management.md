# Prompt M — Tag Management: AI Proctor + Admin Tag Page
## Scope: apps/web (admin pages, tag moderation, blocked tag list)

---

## AGENTS TO READ FIRST (in order)
1. `.claude/agents/wrapup.md`
2. `CLAUDE.md`
3. `DONE.md`
4. `.claude/agents/testing.md`
5. `.claude/agents/feature-registry.md`
6. `.claude/agents/deployment.md`
7. `.claude/agents/ui-guardian.md`
8. `.claude/agents/ai-cost.md`

Run ALL pre-flight checklists before writing a single line of code.
Inspect: `\d recipes` `\d admin_users`

---

## CONTEXT

Tag moderation was added in Prompt J (`moderateTag` in packages/ai).
That function checks individual tags via Haiku and removes flagged ones.
This session adds:
1. A blocked tag list — fast pre-AI filter, no AI cost
2. An admin tag management page — view removed tags, manage blocked list,
   override AI decisions
3. Improved AI tag moderation logging — track what was removed and why

---

## FEATURE 1 — Blocked tag list (DB + fast filter)

### New table
```sql
CREATE TABLE IF NOT EXISTS blocked_tags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tag TEXT NOT NULL UNIQUE,
  reason TEXT,
  blocked_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_blocked_tags_tag ON blocked_tags(tag);
ALTER TABLE blocked_tags ENABLE ROW LEVEL SECURITY;
-- Only admins can read/write (via service role in API routes)
```

Apply migration on RPi5, restart supabase-rest.

### How it works
Before calling `moderateTag()` (AI), check the blocked_tags table first:

```typescript
// In the tag save handler (recipe detail page tag save)
const blockedTags = await getBlockedTags(); // cached, see below
if (blockedTags.includes(tag.toLowerCase())) {
  // Remove immediately, no AI call needed
  await removeTag(recipeId, tag);
  toast("That tag isn't allowed on Chefsbook.");
  return;
}
// Otherwise proceed to AI check
await moderateTag(tag);
```

### Caching
The blocked tags list should be cached in memory (module-level cache,
refresh every 5 minutes) to avoid a DB query on every tag save.
The cache is server-side only.

---

## FEATURE 2 — Tag moderation logging

### New table
```sql
CREATE TABLE IF NOT EXISTS tag_moderation_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recipe_id UUID REFERENCES recipes(id) ON DELETE CASCADE,
  tag TEXT NOT NULL,
  removed_by TEXT NOT NULL CHECK (removed_by IN ('ai', 'admin', 'blocked_list')),
  reason TEXT,
  user_id UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  reinstated BOOLEAN DEFAULT FALSE,
  reinstated_by UUID REFERENCES auth.users(id),
  reinstated_at TIMESTAMPTZ
);

CREATE INDEX idx_tag_mod_log_recipe ON tag_moderation_log(recipe_id);
CREATE INDEX idx_tag_mod_log_created ON tag_moderation_log(created_at DESC);
ALTER TABLE tag_moderation_log ENABLE ROW LEVEL SECURITY;
```

Apply migration on RPi5, restart supabase-rest.

### Where to log
Whenever a tag is removed (by AI, by blocked list, or by admin):
insert a row into `tag_moderation_log`.

Update `moderateTag()` in `packages/ai/src/moderateTag.ts` to accept
`recipeId` and `userId` params and log removals.

---

## FEATURE 3 — Admin tag management page

### Where
Add a "Tags" tab to the existing admin section
(`apps/web/app/admin/` or `apps/web/app/dashboard/admin/`).

### Three sections on the page

#### Section A — Recently removed tags
A table showing the last 100 tag removals from `tag_moderation_log`:
- Tag text
- Recipe title (link to recipe detail)
- Recipe owner username  
- Removed by (AI / Admin / Blocked List)
- Reason
- Date removed
- **"Reinstate"** button — adds the tag back to the recipe, marks log
  entry as reinstated
- **"Block this tag"** button — adds to blocked_tags table so it's
  always blocked going forward

#### Section B — Blocked tag list
Shows all entries in `blocked_tags` table:
- Tag text
- Reason
- Blocked by (username)
- Date added
- **"Remove block"** button — deletes from blocked_tags, clears cache

Input at top: text field + "Block tag" button to add new blocked tags.
Admin enters the tag text and an optional reason, clicks Block.

#### Section C — Tag statistics (simple)
- Total tags removed this week / month
- Top 10 most-blocked tag terms
- Count: AI removals vs blocked list vs admin removals

### API routes
Create:
- `GET /api/admin/tags/log` — recent removals
- `GET /api/admin/tags/blocked` — blocked list
- `POST /api/admin/tags/blocked` — add to blocked list
- `DELETE /api/admin/tags/blocked/[id]` — remove from blocked list
- `POST /api/admin/tags/reinstate` — reinstate a removed tag

All routes: service role client, verify admin_users before executing.

---

## REGRESSION CHECKS — MANDATORY

After deploying, verify ALL of the following:
1. Adding a normal tag to a recipe → saves, no moderation triggered ✓
2. Adding a blocked tag → removed immediately, toast shown, no AI call ✓
3. Adding an inappropriate tag (not in blocked list) → AI removes it,
   toast shown, logged in tag_moderation_log ✓
4. Admin tag page loads with recent removals ✓
5. Admin can block a new tag from the tag page ✓
6. Admin can reinstate a removed tag ✓
7. Blocked tag added → immediately blocked on next attempt ✓
8. My Recipes images still show ✓
9. Search page images still show ✓
10. Recipe detail page still works ✓

---

## IMPLEMENTATION ORDER
1. Apply both migrations (blocked_tags, tag_moderation_log) on RPi5
2. Feature 1 — blocked_tags fast filter in tag save handler
3. Feature 2 — logging in moderateTag + blocked list filter
4. Feature 3 — admin API routes
5. Feature 3 — admin tag management UI (3 sections)
6. Update ai-cost.md (blocked list saves AI calls)
7. TypeScript check: `cd apps/web && npx tsc --noEmit` — must be clean
8. Deploy per `deployment.md`

---

## GUARDRAILS
- Blocked tag check runs BEFORE AI — never call AI for a known-blocked tag
- Cache the blocked list server-side — never query DB on every tag save
- Admin reinstate does NOT remove the tag from the blocked list —
  reinstating a specific instance is different from unblocking a term globally
- All admin routes verify admin status server-side via admin_users table
- Tag text comparison is case-insensitive (normalize to lowercase)

---

## WRAPUP REQUIREMENT
DONE.md entry must include:
- Both migrations applied confirmed
- Blocked list cache implementation (where, how long)
- Admin tag page route path
- All 10 regression checks confirmed
- tsc clean + deploy confirmed
