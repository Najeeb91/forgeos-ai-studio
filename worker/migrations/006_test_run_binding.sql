ALTER TABLE test_runs ADD COLUMN IF NOT EXISTS run_id UUID REFERENCES ai_runs(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_test_runs_run ON test_runs(run_id, created_at DESC);