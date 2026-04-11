-- Fix infinite recursion in admin_users RLS policy
-- The old policy: "EXISTS (SELECT FROM admin_users WHERE user_id = auth.uid())"
-- caused infinite recursion because evaluating the policy required reading admin_users again.
-- New policy: users can read their own row directly (no subquery on the same table).

DROP POLICY IF EXISTS "Only admins can read admin_users" ON admin_users;

CREATE POLICY "Users can read own admin row" ON admin_users
  FOR SELECT USING (user_id = auth.uid());
