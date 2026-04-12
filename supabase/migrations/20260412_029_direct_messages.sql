-- Migration 029: Direct messaging system

CREATE TABLE IF NOT EXISTS direct_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  recipient_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  content TEXT NOT NULL CHECK (char_length(content) <= 1000),
  is_read BOOLEAN DEFAULT false,
  moderation_status TEXT DEFAULT 'clean' CHECK (moderation_status IN ('clean','mild','serious')),
  flag_reason TEXT,
  flagged_at TIMESTAMPTZ,
  is_hidden BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_dm_recipient ON direct_messages(recipient_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_dm_sender ON direct_messages(sender_id, created_at DESC);

ALTER TABLE direct_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own messages"
  ON direct_messages FOR SELECT
  USING (sender_id = auth.uid() OR recipient_id = auth.uid());

CREATE POLICY "Auth users can send messages"
  ON direct_messages FOR INSERT
  WITH CHECK (sender_id = auth.uid());

CREATE POLICY "Sender can delete own messages"
  ON direct_messages FOR DELETE
  USING (sender_id = auth.uid());

-- Message flags
CREATE TABLE IF NOT EXISTS message_flags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id UUID NOT NULL REFERENCES direct_messages(id) ON DELETE CASCADE,
  flagged_by UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  reason TEXT NOT NULL CHECK (reason IN ('Inappropriate','Harassment','Spam','Other')),
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(message_id, flagged_by)
);

ALTER TABLE message_flags ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can flag messages they received"
  ON message_flags FOR INSERT
  WITH CHECK (flagged_by = auth.uid());

CREATE POLICY "Users can read own flags"
  ON message_flags FOR SELECT
  USING (flagged_by = auth.uid());

-- Unread count on user_profiles
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS unread_messages_count INT DEFAULT 0;

-- Trigger: increment unread count on new message
CREATE OR REPLACE FUNCTION increment_unread_messages()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE user_profiles SET unread_messages_count = unread_messages_count + 1
  WHERE id = NEW.recipient_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_new_message
  AFTER INSERT ON direct_messages
  FOR EACH ROW EXECUTE FUNCTION increment_unread_messages();
