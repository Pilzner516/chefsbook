-- Migration 084: Library Accounts
-- Adds support for library accounts (like @souschef) with special import tokens

-- Add account_type to user_profiles
ALTER TABLE user_profiles
  ADD COLUMN IF NOT EXISTS account_type TEXT NOT NULL DEFAULT 'user'
    CHECK (account_type IN ('user', 'library'));

-- Add verified flag (library accounts are always verified)
ALTER TABLE user_profiles
  ADD COLUMN IF NOT EXISTS is_verified BOOLEAN NOT NULL DEFAULT FALSE;

-- Library account import tokens
-- Allows super_admins to generate long-lived tokens for library accounts
-- without sharing the account password
CREATE TABLE IF NOT EXISTS library_account_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  -- SHA-256 hash of the actual token — token is shown once and never stored
  description TEXT NOT NULL DEFAULT 'Import token',
  created_by UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_used_at TIMESTAMPTZ,
  is_active BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE INDEX idx_library_tokens_user_id ON library_account_tokens(user_id);
CREATE INDEX idx_library_tokens_hash ON library_account_tokens(token_hash);

-- Super admin only — no public access
ALTER TABLE library_account_tokens ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Super admins only" ON library_account_tokens
  USING (
    EXISTS (
      SELECT 1 FROM admin_users
      WHERE admin_users.user_id = auth.uid()
      AND admin_users.role = 'super_admin'
    )
  );

-- Reserve the 'souschef' username
INSERT INTO reserved_usernames (username, approved_for_user_id)
VALUES ('souschef', NULL)
ON CONFLICT (username) DO NOTHING;
