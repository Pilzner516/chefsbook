-- Migration 057: Admin notes on feedback items
-- Private tracking notes visible only to admins

CREATE TABLE feedback_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  feedback_id UUID NOT NULL REFERENCES user_feedback(id) ON DELETE CASCADE,
  admin_id UUID NOT NULL REFERENCES auth.users(id),
  note TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_feedback_notes_feedback_id ON feedback_notes(feedback_id);

-- RLS: only admins can read/write notes
ALTER TABLE feedback_notes ENABLE ROW LEVEL SECURITY;

-- Admin check via user_profiles.is_admin or admin_users table
CREATE POLICY "Admins only" ON feedback_notes
  FOR ALL
  USING (EXISTS (
    SELECT 1 FROM admin_users WHERE user_id = auth.uid()
  ));
