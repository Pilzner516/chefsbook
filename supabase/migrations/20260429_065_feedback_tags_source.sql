-- Migration 065: Add tag and source columns to user_feedback for Got an Idea routing
-- Session: USER-FEEDBACK-1

-- Add tag column with new allowed values
ALTER TABLE user_feedback ADD COLUMN IF NOT EXISTS tag TEXT NOT NULL DEFAULT 'Other';

-- Add source column to distinguish Got an Idea from other feedback
ALTER TABLE user_feedback ADD COLUMN IF NOT EXISTS source TEXT NOT NULL DEFAULT 'feedback';

-- Add username and email for Got an Idea submissions
ALTER TABLE user_feedback ADD COLUMN IF NOT EXISTS username TEXT;
ALTER TABLE user_feedback ADD COLUMN IF NOT EXISTS user_email TEXT;

-- Add display_name for admin view
ALTER TABLE user_feedback ADD COLUMN IF NOT EXISTS display_name TEXT;

-- Drop old type check constraint and create new one with expanded values
ALTER TABLE user_feedback DROP CONSTRAINT IF EXISTS user_feedback_type_check;
ALTER TABLE user_feedback ADD CONSTRAINT user_feedback_type_check
  CHECK (type = ANY (ARRAY['bug'::text, 'suggestion'::text, 'praise'::text, 'feature_request'::text, 'question'::text, 'other'::text]));

-- Add check constraint for tag values
ALTER TABLE user_feedback ADD CONSTRAINT user_feedback_tag_check
  CHECK (tag = ANY (ARRAY['Bug'::text, 'Feature Request'::text, 'Question'::text, 'Other'::text]));

-- Add check constraint for source values
ALTER TABLE user_feedback ADD CONSTRAINT user_feedback_source_check
  CHECK (source = ANY (ARRAY['feedback'::text, 'got_an_idea'::text, 'qa_notepad'::text]));

-- Create index for filtering by tag
CREATE INDEX IF NOT EXISTS idx_user_feedback_tag ON user_feedback(tag);

-- Create index for filtering by source
CREATE INDEX IF NOT EXISTS idx_user_feedback_source ON user_feedback(source);
