ALTER TABLE chores ADD COLUMN priority TEXT NOT NULL DEFAULT 'normal' CHECK(priority IN ('low','normal','high','urgent'));
--> statement-breakpoint
ALTER TABLE chores ADD COLUMN instructions TEXT NOT NULL DEFAULT '';
--> statement-breakpoint
ALTER TABLE chores ADD COLUMN due_time TEXT;
--> statement-breakpoint
ALTER TABLE chores ADD COLUMN recurrence TEXT CHECK(recurrence IN ('daily','weekly','monthly'));
--> statement-breakpoint
ALTER TABLE chores ADD COLUMN recurrence_parent_id TEXT REFERENCES chores(id);
--> statement-breakpoint
ALTER TABLE chores ADD COLUMN recurrence_date TEXT;
--> statement-breakpoint
ALTER TABLE chores ADD COLUMN progress_notes TEXT NOT NULL DEFAULT '';
--> statement-breakpoint
ALTER TABLE chores ADD COLUMN completion_notes TEXT NOT NULL DEFAULT '';
--> statement-breakpoint
ALTER TABLE chores ADD COLUMN issue_report TEXT NOT NULL DEFAULT '';
--> statement-breakpoint
ALTER TABLE members ADD COLUMN phone TEXT;
--> statement-breakpoint
ALTER TABLE members ADD COLUMN availability TEXT NOT NULL DEFAULT '';
--> statement-breakpoint
ALTER TABLE members ADD COLUMN skills_notes TEXT NOT NULL DEFAULT '';
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS idx_chores_recurrence_instance ON chores(recurrence_parent_id, recurrence_date) WHERE recurrence_parent_id IS NOT NULL;
--> statement-breakpoint
CREATE TABLE proof_photos (id TEXT PRIMARY KEY NOT NULL, chore_id TEXT NOT NULL REFERENCES chores(id) ON DELETE CASCADE, uploaded_by TEXT NOT NULL REFERENCES members(id), stored_name TEXT NOT NULL UNIQUE, original_name TEXT NOT NULL, mime_type TEXT NOT NULL, byte_size INTEGER NOT NULL, created_at TEXT NOT NULL);
--> statement-breakpoint
CREATE INDEX idx_proof_photos_chore ON proof_photos(chore_id, created_at);
--> statement-breakpoint
CREATE TABLE task_notes (id TEXT PRIMARY KEY NOT NULL, chore_id TEXT NOT NULL REFERENCES chores(id) ON DELETE CASCADE, member_id TEXT NOT NULL REFERENCES members(id), kind TEXT NOT NULL CHECK(kind IN ('progress','completion','issue')), body TEXT NOT NULL, created_at TEXT NOT NULL);
--> statement-breakpoint
CREATE INDEX idx_task_notes_chore ON task_notes(chore_id, created_at);
--> statement-breakpoint
CREATE TABLE audit_log (id TEXT PRIMARY KEY NOT NULL, chore_id TEXT REFERENCES chores(id), actor_id TEXT NOT NULL REFERENCES members(id), action TEXT NOT NULL, detail TEXT NOT NULL, created_at TEXT NOT NULL);
--> statement-breakpoint
CREATE TRIGGER activity_to_audit AFTER INSERT ON activity BEGIN INSERT INTO audit_log(id,chore_id,actor_id,action,detail,created_at) VALUES(lower(hex(randomblob(16))),NEW.chore_id,NEW.member_id,NEW.action,NEW.detail,NEW.created_at); END;
--> statement-breakpoint
CREATE TRIGGER audit_log_no_update BEFORE UPDATE ON audit_log BEGIN SELECT RAISE(ABORT, 'audit history is immutable'); END;
--> statement-breakpoint
CREATE TRIGGER audit_log_no_delete BEFORE DELETE ON audit_log BEGIN SELECT RAISE(ABORT, 'audit history is immutable'); END;