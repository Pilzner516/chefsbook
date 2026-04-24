-- Migration: Add public read RLS policy to user_account_tags
-- Required for UserBadges component to fetch tags from client-side

CREATE POLICY "user_account_tags: public read" ON user_account_tags
FOR SELECT USING (true);
