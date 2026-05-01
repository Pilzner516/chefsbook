-- Instagram completion jobs queue
-- Moves completion from client-side to server-side background processing

CREATE TABLE import_completion_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  recipe_id UUID NOT NULL REFERENCES recipes(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'processing', 'complete', 'failed')),
  attempts INTEGER NOT NULL DEFAULT 0,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(recipe_id)
);

CREATE INDEX idx_completion_jobs_user_pending
  ON import_completion_jobs(user_id, status)
  WHERE status IN ('pending', 'processing');

CREATE INDEX idx_completion_jobs_recipe
  ON import_completion_jobs(recipe_id);

ALTER TABLE import_completion_jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own completion jobs" ON import_completion_jobs
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Service role full access" ON import_completion_jobs
  FOR ALL USING (true);
