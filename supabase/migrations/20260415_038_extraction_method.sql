-- Session 146: Track which extraction method succeeded for each import attempt.
ALTER TABLE import_attempts
  ADD COLUMN IF NOT EXISTS extraction_method TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.check_constraints
    WHERE constraint_name = 'import_attempts_extraction_method_check'
  ) THEN
    ALTER TABLE import_attempts
      ADD CONSTRAINT import_attempts_extraction_method_check
      CHECK (extraction_method IS NULL OR extraction_method IN (
        'json-ld', 'claude-html', 'claude-only',
        'pdf-fallback', 'vision-screenshot', 'manual',
        'extension-html', 'refresh-from-source'
      ));
  END IF;
END$$;

CREATE INDEX IF NOT EXISTS import_attempts_method_idx
  ON import_attempts(extraction_method, attempted_at DESC);
