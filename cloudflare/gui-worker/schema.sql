-- Run-dashboard records (logged by tools/run_log.py at the end of a graph run).
CREATE TABLE IF NOT EXISTS runs (
  id      TEXT PRIMARY KEY,
  graph   TEXT NOT NULL,
  green   INTEGER NOT NULL DEFAULT 0,
  steps   INTEGER NOT NULL DEFAULT 0,
  final   TEXT,
  created TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_runs_created ON runs (created DESC);
