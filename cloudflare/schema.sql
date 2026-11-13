CREATE TABLE IF NOT EXISTS benchmark_runs (
  id TEXT PRIMARY KEY,
  suite_version TEXT NOT NULL,
  profile TEXT NOT NULL,
  result_json TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_benchmark_runs_created ON benchmark_runs(created_at DESC);
CREATE TABLE IF NOT EXISTS reports (
  id TEXT PRIMARY KEY,
  receiver TEXT NOT NULL,
  category TEXT NOT NULL,
  evidence_ref TEXT NOT NULL,
  description TEXT NOT NULL,
  reporter TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  submitted_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_reports_receiver_status ON reports(receiver,status);
CREATE TABLE IF NOT EXISTS agent_market_jobs (
  id TEXT PRIMARY KEY,
  external_job_id TEXT NOT NULL,
  title TEXT NOT NULL,
  budget_json TEXT NOT NULL,
  created_at TEXT NOT NULL
);
