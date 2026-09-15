CREATE TABLE IF NOT EXISTS worker_inbox_items_new (
  id TEXT PRIMARY KEY NOT NULL,
  household_id TEXT NOT NULL DEFAULT 'default',
  worker_id TEXT NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK (kind IN ('manager_message', 'direct_message', 'client_note_pending', 'client_note_approved', 'client_note_rejected')),
  body TEXT NOT NULL,
  submission_id TEXT REFERENCES client_note_submissions(id) ON DELETE SET NULL,
  created_by TEXT NOT NULL REFERENCES members(id),
  created_at TEXT NOT NULL,
  safety_category TEXT CHECK (safety_category IS NULL OR safety_category IN ('abuse', 'threat', 'medication', 'emergency')),
  safety_reason TEXT,
  safety_reviewed_by TEXT REFERENCES members(id),
  safety_reviewed_at TEXT
);
--> statement-breakpoint
INSERT INTO worker_inbox_items_new (id, household_id, worker_id, kind, body, submission_id, created_by, created_at, safety_category, safety_reason, safety_reviewed_by, safety_reviewed_at)
SELECT id, household_id, worker_id, kind, body, submission_id, created_by, created_at, safety_category, safety_reason, safety_reviewed_by, safety_reviewed_at FROM worker_inbox_items;
--> statement-breakpoint
DROP TABLE worker_inbox_items;
--> statement-breakpoint
ALTER TABLE worker_inbox_items_new RENAME TO worker_inbox_items;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_worker_inbox_items_worker ON worker_inbox_items(household_id, worker_id, created_at);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_worker_inbox_items_sender ON worker_inbox_items(household_id, created_by, created_at);
