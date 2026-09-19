CREATE TABLE IF NOT EXISTS schedule_change_requests (
  id TEXT PRIMARY KEY NOT NULL,
  household_id TEXT NOT NULL DEFAULT 'default',
  requester_id TEXT NOT NULL REFERENCES members(id),
  shift_id TEXT NOT NULL REFERENCES shifts(id),
  requested_date TEXT NOT NULL,
  start_time TEXT NOT NULL,
  end_time TEXT NOT NULL,
  reason TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'covered')),
  accepted_by TEXT REFERENCES members(id),
  accepted_at TEXT,
  created_at TEXT NOT NULL,
  UNIQUE(requester_id, requested_date)
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_schedule_change_requests_status_date ON schedule_change_requests(household_id, status, requested_date);
