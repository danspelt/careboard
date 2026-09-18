CREATE TABLE IF NOT EXISTS shift_handovers (
  id TEXT PRIMARY KEY NOT NULL,
  household_id TEXT NOT NULL DEFAULT 'default',
  member_id TEXT NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  shift_date TEXT NOT NULL,
  completed_summary TEXT NOT NULL DEFAULT '',
  pending_summary TEXT NOT NULL DEFAULT '',
  notes TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS idx_shift_handovers_member_date ON shift_handovers(household_id, member_id, shift_date);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_shift_handovers_recent ON shift_handovers(household_id, created_at);
