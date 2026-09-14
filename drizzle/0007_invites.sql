CREATE TABLE IF NOT EXISTS worker_invites (
  id TEXT PRIMARY KEY NOT NULL,
  member_id TEXT NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  accepted_at TEXT,
  created_at TEXT NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_worker_invites_member ON worker_invites(member_id);
