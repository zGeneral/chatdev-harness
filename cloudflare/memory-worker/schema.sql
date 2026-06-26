-- D1 schema for chatdev-memory: raw text keyed by the Vectorize vector id.
CREATE TABLE IF NOT EXISTS memories (
  id        TEXT PRIMARY KEY,
  namespace TEXT NOT NULL,
  text      TEXT NOT NULL,
  metadata  TEXT,
  created   TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_memories_namespace ON memories (namespace);
