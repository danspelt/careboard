CREATE TABLE households (
  id TEXT PRIMARY KEY NOT NULL,
  name TEXT NOT NULL,
  created_at TEXT NOT NULL
);
--> statement-breakpoint
CREATE TABLE household_members (
  household_id TEXT NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  member_id TEXT NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'worker' CHECK (role IN ('manager', 'worker', 'viewer')),
  created_at TEXT NOT NULL,
  PRIMARY KEY (household_id, member_id)
);
--> statement-breakpoint
CREATE INDEX idx_household_members_member ON household_members(member_id, household_id);
--> statement-breakpoint
ALTER TABLE chores ADD COLUMN household_id TEXT NOT NULL DEFAULT 'default';
--> statement-breakpoint
ALTER TABLE shifts ADD COLUMN household_id TEXT NOT NULL DEFAULT 'default';
--> statement-breakpoint
ALTER TABLE availability_windows ADD COLUMN household_id TEXT NOT NULL DEFAULT 'default';
--> statement-breakpoint
ALTER TABLE time_entries ADD COLUMN household_id TEXT NOT NULL DEFAULT 'default';
--> statement-breakpoint
ALTER TABLE messages ADD COLUMN household_id TEXT NOT NULL DEFAULT 'default';
--> statement-breakpoint
ALTER TABLE proof_photos ADD COLUMN household_id TEXT NOT NULL DEFAULT 'default';
--> statement-breakpoint
ALTER TABLE task_notes ADD COLUMN household_id TEXT NOT NULL DEFAULT 'default';
--> statement-breakpoint
ALTER TABLE activity ADD COLUMN household_id TEXT NOT NULL DEFAULT 'default';
--> statement-breakpoint
ALTER TABLE audit_log ADD COLUMN household_id TEXT NOT NULL DEFAULT 'default';
--> statement-breakpoint
ALTER TABLE certification_records ADD COLUMN household_id TEXT NOT NULL DEFAULT 'default';
--> statement-breakpoint
ALTER TABLE worker_invites ADD COLUMN household_id TEXT NOT NULL DEFAULT 'default';
--> statement-breakpoint
CREATE INDEX idx_chores_household_status ON chores(household_id, status, due_date);
--> statement-breakpoint
CREATE INDEX idx_shifts_household ON shifts(household_id, member_id, weekday);
--> statement-breakpoint
CREATE INDEX idx_messages_household ON messages(household_id, created_at);
--> statement-breakpoint
CREATE INDEX idx_proof_photos_household ON proof_photos(household_id, created_at);
--> statement-breakpoint
CREATE INDEX idx_activity_household ON activity(household_id, created_at);
--> statement-breakpoint
CREATE INDEX idx_time_entries_household ON time_entries(household_id, member_id, started_at);
--> statement-breakpoint
INSERT INTO households (id, name, created_at)
SELECT 'default', 'Primary home', '2020-01-01T00:00:00.000Z'
WHERE NOT EXISTS (SELECT 1 FROM households WHERE id = 'default');
--> statement-breakpoint
INSERT INTO household_settings (household_id) VALUES ('default') ON CONFLICT (household_id) DO NOTHING;
--> statement-breakpoint
INSERT INTO household_members (household_id, member_id, role, created_at)
SELECT 'default', m.id, m.role, COALESCE(m.created_at, '2020-01-01T00:00:00.000Z')
FROM members m
WHERE NOT EXISTS (
  SELECT 1 FROM household_members hm WHERE hm.household_id = 'default' AND hm.member_id = m.id
);
