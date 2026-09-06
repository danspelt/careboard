CREATE TABLE IF NOT EXISTS household_settings (
  household_id TEXT PRIMARY KEY NOT NULL DEFAULT 'default',
  recurrence_horizon_days INTEGER NOT NULL DEFAULT 30 CHECK(recurrence_horizon_days BETWEEN 1 AND 365),
  reminder_default_lead_days INTEGER NOT NULL DEFAULT 1 CHECK(reminder_default_lead_days BETWEEN 0 AND 90),
  retention_days INTEGER NOT NULL DEFAULT 90 CHECK(retention_days BETWEEN 1 AND 365),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
--> statement-breakpoint
INSERT OR IGNORE INTO household_settings (household_id, recurrence_horizon_days, reminder_default_lead_days, retention_days, updated_at)
VALUES ('default', 30, 1, 90, datetime('now'));
--> statement-breakpoint
ALTER TABLE members ADD COLUMN emergency_contact TEXT;
--> statement-breakpoint
ALTER TABLE members ADD COLUMN certifications TEXT NOT NULL DEFAULT '';
--> statement-breakpoint
ALTER TABLE members ADD COLUMN languages TEXT NOT NULL DEFAULT '';
--> statement-breakpoint
ALTER TABLE members ADD COLUMN profile_photo_id TEXT REFERENCES proof_photos(id) ON DELETE SET NULL;
--> statement-breakpoint
ALTER TABLE chores ADD COLUMN reminder_lead_days INTEGER;
--> statement-breakpoint
ALTER TABLE chores ADD COLUMN expected_completion_at TEXT;
--> statement-breakpoint
ALTER TABLE chores ADD COLUMN issue_open INTEGER NOT NULL DEFAULT 0 CHECK(issue_open IN (0,1));
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS proof_photos_new (
  id TEXT PRIMARY KEY NOT NULL,
  chore_id TEXT REFERENCES chores(id) ON DELETE CASCADE,
  profile_member_id TEXT REFERENCES members(id) ON DELETE CASCADE,
  uploaded_by TEXT NOT NULL REFERENCES members(id),
  stored_name TEXT NOT NULL UNIQUE,
  original_name TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  byte_size INTEGER NOT NULL,
  created_at TEXT NOT NULL
);
--> statement-breakpoint
INSERT INTO proof_photos_new (id, chore_id, uploaded_by, stored_name, original_name, mime_type, byte_size, created_at)
SELECT id, chore_id, uploaded_by, stored_name, original_name, mime_type, byte_size, created_at FROM proof_photos;
--> statement-breakpoint
DROP TABLE proof_photos;
--> statement-breakpoint
ALTER TABLE proof_photos_new RENAME TO proof_photos;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_proof_photos_chore ON proof_photos(chore_id, created_at);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_proof_photos_profile_member ON proof_photos(profile_member_id, created_at);
