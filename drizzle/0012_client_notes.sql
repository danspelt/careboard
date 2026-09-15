CREATE TABLE IF NOT EXISTS client_note_submissions (
  id TEXT PRIMARY KEY NOT NULL,
  household_id TEXT NOT NULL DEFAULT 'default',
  client_member_id TEXT NOT NULL REFERENCES members(id),
  submitted_by TEXT NOT NULL REFERENCES members(id),
  source_photo_id TEXT REFERENCES proof_photos(id) ON DELETE SET NULL,
  ocr_text TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  approved_text TEXT,
  reviewed_by TEXT REFERENCES members(id),
  reviewed_at TEXT,
  created_at TEXT NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_client_note_submissions_status ON client_note_submissions(household_id, status, created_at);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_client_note_submissions_client ON client_note_submissions(client_member_id, created_at);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS worker_inbox_items (
  id TEXT PRIMARY KEY NOT NULL,
  household_id TEXT NOT NULL DEFAULT 'default',
  worker_id TEXT NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK (kind IN ('manager_message', 'direct_message', 'client_note_pending', 'client_note_approved', 'client_note_rejected')),
  body TEXT NOT NULL,
  submission_id TEXT REFERENCES client_note_submissions(id) ON DELETE SET NULL,
  created_by TEXT NOT NULL REFERENCES members(id),
  created_at TEXT NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_worker_inbox_items_worker ON worker_inbox_items(household_id, worker_id, created_at);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_worker_inbox_items_sender ON worker_inbox_items(household_id, created_by, created_at);
