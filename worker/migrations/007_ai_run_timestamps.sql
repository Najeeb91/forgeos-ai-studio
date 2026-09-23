ALTER TABLE ai_runs ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT now();
ALTER TABLE ai_runs ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();
UPDATE ai_runs
SET created_at = COALESCE(created_at, started_at, now()),
    updated_at = COALESCE(updated_at, completed_at, started_at, now())
WHERE created_at IS NULL OR updated_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_ai_runs_project_updated ON ai_runs(project_id, updated_at DESC);