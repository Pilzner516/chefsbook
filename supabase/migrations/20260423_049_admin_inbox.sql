-- Migration: Admin Inbox Support
-- Adds columns needed for the merged Admin Messages Hub

-- Add read_by_admin to track which messages admins have seen
ALTER TABLE direct_messages
ADD COLUMN IF NOT EXISTS read_by_admin BOOLEAN DEFAULT FALSE;

-- Add message_tag for categorizing messages (e.g., account_restriction_inquiry)
ALTER TABLE direct_messages
ADD COLUMN IF NOT EXISTS message_tag TEXT DEFAULT NULL;

-- Add constraint for valid message tags
ALTER TABLE direct_messages
ADD CONSTRAINT direct_messages_tag_check
CHECK (message_tag IS NULL OR message_tag IN ('account_restriction_inquiry', 'admin_outreach', 'general'));

-- Index for efficient admin inbox queries
CREATE INDEX IF NOT EXISTS idx_dm_admin_inbox
ON direct_messages (read_by_admin, created_at DESC)
WHERE message_tag IS NOT NULL OR read_by_admin = false;

-- Index for filtering by message tag
CREATE INDEX IF NOT EXISTS idx_dm_message_tag
ON direct_messages (message_tag, created_at DESC)
WHERE message_tag IS NOT NULL;
