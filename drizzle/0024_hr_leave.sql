ALTER TABLE household_settings ADD COLUMN default_vacation_hours REAL NOT NULL DEFAULT 80;
--> statement-breakpoint
CREATE TABLE leave_balances (
  member_id TEXT NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('vacation', 'sick', 'other')),
  hours_entitled REAL NOT NULL DEFAULT 0,
  hours_used REAL NOT NULL DEFAULT 0,
  PRIMARY KEY (member_id, kind),
  FOREIGN KEY (member_id) REFERENCES members(id)
);
--> statement-breakpoint
CREATE TABLE leave_requests (
  id TEXT PRIMARY KEY NOT NULL,
  household_id TEXT NOT NULL DEFAULT 'default',
  member_id TEXT NOT NULL REFERENCES members(id),
  kind TEXT NOT NULL CHECK (kind IN ('vacation', 'sick', 'other')),
  start_on TEXT NOT NULL,
  end_on TEXT NOT NULL,
  hours REAL NOT NULL,
  note TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'denied', 'cancelled')),
  decided_by TEXT REFERENCES members(id),
  decided_at TEXT,
  created_at TEXT NOT NULL
);
--> statement-breakpoint
CREATE INDEX idx_leave_requests_status ON leave_requests(household_id, status, created_at);
