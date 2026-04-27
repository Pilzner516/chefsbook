-- Migration 056: Add status column to user_feedback
-- Allows admins to track feedback progress

ALTER TABLE user_feedback
  ADD COLUMN status TEXT NOT NULL DEFAULT 'new'
    CHECK (status IN ('new', 'under_review', 'resolved'));

-- Index for filtering by status
CREATE INDEX idx_user_feedback_status ON user_feedback(status);
