# ChefsBook — Session 30: Likes + Comments + AI Moderation
# Depends on: Sessions 26, 27, 28, 29
# Target: apps/mobile + apps/web + @chefsbook/ai + packages/db

---

## CROSS-PLATFORM REQUIREMENT — READ FIRST

Every feature in this session MUST be implemented on BOTH platforms:
- `apps/mobile` — React Native / Expo
- `apps/web` — Next.js

Do not implement a feature on one platform and leave the other with a TODO.
Both must be fully working before /wrapup.

Platform-specific notes:
- Like button + count → on recipe cards AND recipe detail on both platforms
- Like viewer list (who liked) → recipe detail on both platforms
- Comment section → recipe detail on both platforms (public recipes only)
- Flag button (🚩) → on every comment on both platforms
- Recipe owner controls (delete, block, toggle) → available on both platforms
- Comment input → KeyboardAvoidingView on mobile, standard form on web
- All new bottom sheets → safe area insets on mobile, modal/drawer on web

---

## CONTEXT

Likes (any plan), comments (Chef+ with searchable account), AI moderation of comments,
and user flagging. Comments only on public recipes. Read all applicable agents.

---

## DB CHANGES

Migration `021_likes_comments.sql`:

```sql
-- Likes
CREATE TABLE IF NOT EXISTS recipe_likes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recipe_id UUID NOT NULL REFERENCES recipes(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(recipe_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_likes_recipe ON recipe_likes(recipe_id);

ALTER TABLE recipe_likes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read likes" ON recipe_likes FOR SELECT USING (true);
CREATE POLICY "Auth users can manage own likes"
  ON recipe_likes FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Auto-update like count on recipes
ALTER TABLE recipes ADD COLUMN IF NOT EXISTS like_count INTEGER DEFAULT 0;

CREATE OR REPLACE FUNCTION update_like_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE recipes SET like_count = like_count + 1 WHERE id = NEW.recipe_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE recipes SET like_count = like_count - 1 WHERE id = OLD.recipe_id;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER like_count_trigger
  AFTER INSERT OR DELETE ON recipe_likes
  FOR EACH ROW EXECUTE FUNCTION update_like_count();

-- Comments
CREATE TYPE comment_status AS ENUM ('visible', 'hidden_pending_review', 'rejected', 'approved');
CREATE TYPE flag_severity AS ENUM ('mild', 'serious');
CREATE TYPE flag_source AS ENUM ('ai', 'user');

CREATE TABLE IF NOT EXISTS recipe_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recipe_id UUID NOT NULL REFERENCES recipes(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  parent_id UUID REFERENCES recipe_comments(id) ON DELETE CASCADE,
  content TEXT NOT NULL CHECK (char_length(content) <= 500),
  status comment_status DEFAULT 'visible',
  flag_severity flag_severity,
  flag_source flag_source,
  flag_reason TEXT,
  flagged_at TIMESTAMPTZ,
  reviewed_by UUID REFERENCES user_profiles(id),
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_comments_recipe ON recipe_comments(recipe_id);
CREATE INDEX IF NOT EXISTS idx_comments_user ON recipe_comments(user_id);

ALTER TABLE recipe_comments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read visible comments"
  ON recipe_comments FOR SELECT
  USING (status = 'visible' OR status = 'approved' OR user_id = auth.uid());

CREATE POLICY "Auth users can insert comments"
  ON recipe_comments FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own comments"
  ON recipe_comments FOR UPDATE
  USING (user_id = auth.uid());

-- Comment settings on recipes
ALTER TABLE recipes
  ADD COLUMN IF NOT EXISTS comments_enabled BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS comment_count INTEGER DEFAULT 0;

-- Comment settings for recipe owners
CREATE TABLE IF NOT EXISTS comment_flags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  comment_id UUID NOT NULL REFERENCES recipe_comments(id) ON DELETE CASCADE,
  flagged_by UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  reason TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(comment_id, flagged_by)
);
```

---

## LIKES

### Like button on recipe cards
- Heart icon with count: `♡ 42`
- Filled red heart when liked by current user: `❤️ 43`
- Any plan can like (including Free)
- Tap toggles like (optimistic update)
- Like count updates immediately via trigger

### Like count — tap to see who liked
- Tapping the like count on the recipe OWNER'S view opens a sheet:
  ```
  ┌─────────────────────────────────┐
  │  42 people liked this recipe    │
  │─────────────────────────────────│
  │  [Avatar] @username1  ↗        │
  │  [Avatar] @username2  ↗        │
  │  [Avatar] @username3  ↗        │
  └─────────────────────────────────┘
  ```
- Each row tappable → navigates to that user's public profile
- Only recipe owner sees this — other users just see the count

---

## COMMENTS

### Who can comment
- Must have Chef plan or above
- Must have `is_searchable = true` (public account)
- Recipe must have `visibility = 'public'` and `comments_enabled = true`

### Comment UI on recipe detail
```
── Comments (12) ──────────────────────────
  [Avatar] @username · 2h ago
  "This recipe is amazing! I added extra..."
  [👍 Reply] [🚩 Flag]

  [Avatar] @username2 · 1d ago
  "Used this for dinner party..."
  [👍 Reply] [🚩 Flag]

[Add a comment...]                    [Post]
─────────────────────────────────────────────
```

- Shown below recipe notes on recipe detail (public recipes only)
- Max 500 characters per comment
- Comment count shown in header

### Recipe owner controls
Recipe owner sees additional options on each comment:
- [Delete] — removes comment immediately
- [Block user] — prevents that user from commenting on any of their recipes
- Toggle comments on/off for the recipe (in edit menu):
  "Comments are ON/OFF for this recipe"

### Comment posting flow
1. User types comment → taps Post
2. Send to `moderateComment()` in `@chefsbook/ai` BEFORE saving
3. If clean → save as `status: 'visible'`
4. If mild violation → save as `status: 'visible'`, set `flag_severity: 'mild'`,
   notify admin dashboard
5. If serious violation → save as `status: 'hidden_pending_review'`,
   set `flag_severity: 'serious'`, suspend commenter's comment permissions,
   notify admin dashboard with red alert

---

## AI COMMENT MODERATION

In `@chefsbook/ai`, create `moderateComment()`:

```ts
export type ModerationResult = {
  verdict: 'clean' | 'mild' | 'serious';
  reason?: string;
}

export async function moderateComment(
  content: string
): Promise<ModerationResult>
```

Claude prompt:
```
You are a content moderator for a family-friendly recipe sharing app.
Review the following comment for violations.

Rules:
- No swearing or profanity (any language)
- No hate speech or discrimination
- No personal attacks or harassment
- No spam or promotional content
- No off-topic content unrelated to cooking/food
- No sexual or violent content
- Must be family-friendly

Comment: "${content}"

Classify as:
- "clean": no violations
- "mild": borderline language, minor rudeness, slightly off-topic
  (show comment but flag for review)
- "serious": clear profanity, hate speech, harassment, explicit content
  (hide comment immediately, suspend user's comment ability)

Return JSON only:
{
  "verdict": "clean" | "mild" | "serious",
  "reason": "brief explanation if not clean, null if clean"
}
```

### Commenter suspension
When a serious violation is detected:
- Set `user_profiles.comments_suspended = true`
  ```sql
  ALTER TABLE user_profiles
    ADD COLUMN IF NOT EXISTS comments_suspended BOOLEAN DEFAULT false;
  ```
- Suspended commenters see: "Your commenting privileges are suspended pending review"
- Super admin can restore in admin dashboard User Management

### User flagging
Any logged-in user can flag a comment:
- Tap 🚩 Flag on any comment
- Brief reason picker: "Inappropriate language" / "Harassment" / "Spam" / "Other"
- Creates a row in `comment_flags`
- If a comment gets 3+ user flags → automatically escalated to admin dashboard
  as "USER REPORTED" with blue badge

---

## ADMIN DASHBOARD — COMMENT QUEUE

(Extends session 28 admin dashboard)

Flagged Comments section shows:
- **Red "AUTO-HIDDEN"** badge: serious AI violations (hidden, commenter suspended)
  → Approve: restore comment + restore commenter permissions
  → Reject: delete comment permanently, keep suspension
- **Yellow "AI FLAGGED"** badge: mild AI violations (visible)
  → Approve: clear flag, mark clean
  → Reject: hide comment
- **Blue "USER REPORTED"** badge: user-flagged comments
  → Same approve/reject actions

Super admin dashboard overview widget shows pending count in red when > 0.

---

## COMPLETION CHECKLIST

- [ ] Migration 021 applied to RPi5
- [ ] Like button on recipe cards (all plans)
- [ ] Like count updates immediately via trigger
- [ ] Recipe owner can see who liked (tap count → user list)
- [ ] Comment section on public recipe detail
- [ ] Comments gated: Chef+ and searchable account required
- [ ] `moderateComment()` in @chefsbook/ai with Claude prompt
- [ ] Clean comments → visible immediately
- [ ] Mild violations → visible + flagged to admin
- [ ] Serious violations → hidden + commenter suspended
- [ ] User flagging (🚩 button, reason picker)
- [ ] 3+ user flags → escalated to admin
- [ ] Recipe owner: delete comment, block user, toggle comments on/off
- [ ] Admin dashboard: three-tier flag queue with approve/reject
- [ ] `comments_suspended` field + message shown to suspended users
- [ ] Safe area insets on all new UI
- [ ] i18n keys for all new strings
- [ ] Run /wrapup to update DONE.md and CLAUDE.md
