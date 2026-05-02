-- Fix GoTrue NULL token crash
-- Users created with GOTRUE_MAILER_AUTOCONFIRM=true get NULL token columns,
-- which causes GoTrue to crash when scanning the user later.
-- This function patches NULL tokens to empty strings for a specific user.

CREATE OR REPLACE FUNCTION fix_gotrue_null_tokens(target_user_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = auth, public
AS $$
BEGIN
  UPDATE auth.users
  SET
    confirmation_token = COALESCE(confirmation_token, ''),
    recovery_token = COALESCE(recovery_token, ''),
    email_change_token_new = COALESCE(email_change_token_new, ''),
    email_change_token_current = COALESCE(email_change_token_current, ''),
    reauthentication_token = COALESCE(reauthentication_token, '')
  WHERE id = target_user_id;
END;
$$;

-- Grant execute to service role (admin client)
GRANT EXECUTE ON FUNCTION fix_gotrue_null_tokens(UUID) TO service_role;

COMMENT ON FUNCTION fix_gotrue_null_tokens IS 'Patches NULL token columns to empty strings for a user, preventing GoTrue scanner crash';
