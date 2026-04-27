-- Migration 058: Feedback message threads
-- Two-way messaging between admin and feedback submitter

CREATE TABLE feedback_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  feedback_id UUID NOT NULL REFERENCES user_feedback(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES auth.users(id),
  message TEXT NOT NULL,
  is_admin_message BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_feedback_messages_feedback_id ON feedback_messages(feedback_id);
CREATE INDEX idx_feedback_messages_created_at ON feedback_messages(created_at DESC);

ALTER TABLE feedback_messages ENABLE ROW LEVEL SECURITY;

-- Admin can read/write all messages on any feedback
CREATE POLICY "Admin full access" ON feedback_messages
  FOR ALL
  USING (EXISTS (
    SELECT 1 FROM admin_users WHERE user_id = auth.uid()
  ));

-- User can read/write messages only on their own feedback
CREATE POLICY "User own feedback" ON feedback_messages
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM user_feedback
      WHERE id = feedback_messages.feedback_id
      AND user_id = auth.uid()
    )
  );
