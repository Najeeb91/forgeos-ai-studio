ALTER TABLE deployments ADD COLUMN IF NOT EXISTS run_id UUID REFERENCES ai_runs(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_deployments_run ON deployments(run_id, created_at DESC);