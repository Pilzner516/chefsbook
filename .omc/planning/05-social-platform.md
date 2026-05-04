# Social and Community Platform Design

## Executive Summary

ChefsBook has social infrastructure (follows, likes, comments, DMs) but lacks the **identity layer** that makes Strava sticky. Strava users open the app 35+ times/month because it validates their athletic identity. ChefsBook must validate cooking identity. The equivalent of Strava's "kudos" is the "Cooked it!" - social proof that a recipe was actually made.

## Current Social Features Audit

### What Exists (from packages/db/src/queries/)

| Feature | Table | Status | Usage |
|---------|-------|--------|-------|
| Follow users | user_follows | Built | Low |
| Save recipes | recipe_saves | Built | Medium |
| Like recipes | recipe_likes | Built | Medium |
| Comment on recipes | recipe_comments | Built | Low |
| Like comments | comment_likes | Built | Low |
| Direct messages | direct_messages | Built | Very Low |
| Notifications | notifications | Built | Medium |
| Public profile | user_profiles | Built | Medium |
| Share recipes | share_token | Built | Low |

### What's Missing

| Feature | Impact | Complexity |
|---------|--------|------------|
| "Cooked it!" social proof | High | Low |
| Cooking streaks | High | Low |
| Challenges/events | High | Medium |
| Family recipe vaults | High | Medium |
| Live cooking | Medium | High |
| Chef reputation/badges | Medium | Medium |
| Collaborative menus | Medium | Low |
| Food journaling | Medium | Medium |

## Social Platform Design

### The Identity Layer: "Cooked it!"

**Insight from Strava**: Activities get 8x more engagement than Twitter posts because they validate identity ("I am a runner").

**ChefsBook equivalent**: "Cooked it!" posts validate cooking identity ("I am a cook").

**Implementation**:
```
User finishes Cook Mode
→ Prompt: "Share your dish?"
→ Photo upload + optional notes
→ Post to Discover feed
→ Original recipe creator gets notification
→ Recipe gets "X people cooked this" counter
→ Photo appears on recipe detail page
```

**Database**:
```sql
CREATE TABLE cook_posts (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES user_profiles,
  recipe_id UUID REFERENCES recipes,
  photo_url TEXT NOT NULL,
  notes TEXT,
  rating SMALLINT CHECK (rating BETWEEN 1 AND 5),
  created_at TIMESTAMPTZ DEFAULT now()
);
```

**Why This Works**:
- Social proof drives recipe adoption
- Creators feel appreciated (notification)
- Photos improve recipe pages
- Generates content without creator burden

### Cooking Streaks

**Model**: Duolingo-style daily/weekly consistency tracking.

**Implementation**:
- Track: days with at least one recipe cooked
- Milestones: 7 days, 30 days, 100 days, 365 days
- Push notifications: "Don't break your streak! Quick 15-min recipe?"
- Profile badge: "30-day cooking streak"

**Database**:
```sql
ALTER TABLE user_profiles 
ADD COLUMN current_streak INTEGER DEFAULT 0,
ADD COLUMN longest_streak INTEGER DEFAULT 0,
ADD COLUMN last_cook_date DATE;
```

**Why This Works**:
- Gamification drives retention (Duolingo proof)
- Simple to implement
- Creates daily habit

### Challenges and Events

**Types**:
1. **Platform challenges**: "30-day vegetarian challenge"
2. **Seasonal events**: "Thanksgiving menu competition"
3. **User-created challenges**: "My dinner party menu"
4. **Brand-sponsored challenges**: "Cooking with X ingredient"

**Implementation**:
```sql
CREATE TABLE challenges (
  id UUID PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  type TEXT CHECK (type IN ('platform', 'seasonal', 'user', 'sponsored')),
  start_date DATE,
  end_date DATE,
  rules JSONB,
  prize_description TEXT,
  sponsor_id UUID REFERENCES user_profiles,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE challenge_entries (
  id UUID PRIMARY KEY,
  challenge_id UUID REFERENCES challenges,
  user_id UUID REFERENCES user_profiles,
  recipe_id UUID REFERENCES recipes,
  cook_post_id UUID REFERENCES cook_posts,
  submitted_at TIMESTAMPTZ DEFAULT now()
);
```

**Example Challenge**: "Pasta Week"
- Cook 5 different pasta dishes in 7 days
- Share each with #PastaWeek tag
- Winner: most likes across entries
- Prize: 3 months Pro free

### Family Recipe Vaults

**Insight**: Emotional value of preserving family recipes is enormous. "Grandma's lasagna" must never be lost.

**Implementation**:
```sql
CREATE TABLE family_vaults (
  id UUID PRIMARY KEY,
  name TEXT NOT NULL,
  created_by UUID REFERENCES user_profiles,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE family_vault_members (
  vault_id UUID REFERENCES family_vaults,
  user_id UUID REFERENCES user_profiles,
  role TEXT CHECK (role IN ('admin', 'member', 'viewer')),
  invited_at TIMESTAMPTZ DEFAULT now(),
  accepted_at TIMESTAMPTZ,
  PRIMARY KEY (vault_id, user_id)
);

CREATE TABLE family_vault_recipes (
  vault_id UUID REFERENCES family_vaults,
  recipe_id UUID REFERENCES recipes,
  added_by UUID REFERENCES user_profiles,
  story TEXT, -- "Grandma made this every Christmas"
  original_source TEXT, -- "Handwritten card from 1962"
  added_at TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (vault_id, recipe_id)
);
```

**Features**:
- Private family cookbook
- Recipe stories ("Mom learned this from her mother")
- Photo archives (scan old recipe cards)
- Member invite system
- Legacy planning ("Transfer vault ownership")

### Collaborative Menus

**Use Case**: Planning a dinner party with friends.

**Implementation**:
- Extend existing menus table with collaboration:
```sql
ALTER TABLE menus ADD COLUMN is_collaborative BOOLEAN DEFAULT false;

CREATE TABLE menu_collaborators (
  menu_id UUID REFERENCES menus,
  user_id UUID REFERENCES user_profiles,
  role TEXT CHECK (role IN ('host', 'contributor', 'viewer')),
  assigned_courses TEXT[], -- ["appetizer", "dessert"]
  rsvp_status TEXT CHECK (rsvp_status IN ('pending', 'yes', 'no', 'maybe')),
  dietary_restrictions TEXT[],
  PRIMARY KEY (menu_id, user_id)
);
```

**Features**:
- Host creates menu, invites friends
- Each guest can claim a course
- Dietary restrictions aggregated
- Combined shopping list
- Day-of: Cook Mode shows who's making what

### Chef Reputation System

**Model**: Stack Overflow / Reddit karma.

**Reputation Events**:
| Event | Points |
|-------|--------|
| Recipe gets cooked | +10 |
| Recipe gets saved | +2 |
| Recipe gets liked | +1 |
| Comment gets liked | +1 |
| Complete a challenge | +50 |
| 30-day streak | +100 |

**Badges**:
- Technique mastery: "Sauté Master" (10 sautéed dishes)
- Cuisine explorer: "World Traveler" (recipes from 10 cuisines)
- Community builder: "Mentor" (10 followers who cooked your recipes)
- Consistency: "Iron Chef" (365-day streak)

**Display**:
- Profile shows reputation score
- Badge shelf on profile
- Leaderboards (monthly, all-time)
- Badge on recipe cards from top creators

### Viral Mechanics

**The Strava Playbook Applied to Cooking**:

| Strava | ChefsBook Equivalent |
|--------|---------------------|
| Kudos (one-tap validation) | "Looks delicious!" reaction |
| Segments (competitive routes) | Recipe ratings (best carbonara) |
| Clubs (group identity) | Cuisine communities (Thai food lovers) |
| Year in Review | "Your Year in Cooking" |
| Activity feed | Discover feed |

**Viral Loops**:

1. **Cook → Share → Inspire**
   - User cooks recipe → shares Cooked it! → followers see → they cook → loop

2. **Challenge → Compete → Share**
   - User joins challenge → posts entries → friends see → they join → loop

3. **Family → Invite → Preserve**
   - User creates vault → invites family → they add recipes → more invites → loop

### Community Architecture

**Layers**:

1. **Global**: Discover feed, trending recipes, platform challenges
2. **Cuisine**: Thai food community, Italian cooking group
3. **Local**: "Seattle Home Cooks" - local meetups, ingredient swaps
4. **Family**: Private family vaults
5. **Friends**: Following feed, collaborative menus

**Moderation**:
- AI moderation already built (moderateComment, moderateRecipe)
- Human review for flagged content (admin dashboard exists)
- Community guidelines enforcement

## Retention Drivers

| Feature | Retention Impact | Build Effort |
|---------|------------------|--------------|
| Cooking streaks | Very High | Low |
| "Cooked it!" posts | High | Low |
| Challenges | High | Medium |
| Family vaults | High (emotional lock-in) | Medium |
| Reputation/badges | Medium | Medium |
| Collaborative menus | Medium | Low |

## Implementation Roadmap

### Phase 1: Identity Layer (Weeks 1-4)
1. cook_posts table and API
2. "Cooked it!" prompt after Cook Mode
3. Recipe detail: show cook_posts gallery
4. Cooking streaks with notifications

### Phase 2: Gamification (Weeks 5-8)
1. Reputation scoring system
2. Badge definitions and awards
3. Profile badge shelf
4. Basic leaderboards

### Phase 3: Community (Weeks 9-12)
1. Challenges system
2. Platform challenge: first 30-day challenge
3. Challenge feed in Discover
4. Winner announcement system

### Phase 4: Family (Months 4-6)
1. Family vaults
2. Invite system
3. Recipe stories
4. Legacy transfer

## Success Metrics

| Metric | Current | 6-Month Target | 12-Month Target |
|--------|---------|----------------|-----------------|
| DAU/MAU ratio | Unknown | 25% | 40% |
| Average session opens/month | Unknown | 15 | 30 |
| "Cooked it!" posts/week | 0 | 500 | 5,000 |
| Active challenge participants | 0 | 200 | 2,000 |
| Family vaults created | 0 | 100 | 1,000 |
| Users with 7+ day streak | 0 | 5% | 15% |
