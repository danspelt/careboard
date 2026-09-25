CREATE TABLE shift_handoffs (
  id TEXT PRIMARY KEY NOT NULL,
  household_id TEXT NOT NULL DEFAULT 'default',
  author_id TEXT NOT NULL REFERENCES members(id),
  shift_date TEXT NOT NULL,
  completed_care TEXT NOT NULL,
  outstanding_tasks TEXT NOT NULL,
  observations TEXT NOT NULL,
  checklist_json TEXT NOT NULL DEFAULT '[]',
  created_at TEXT NOT NULL
);
--> statement-breakpoint
CREATE INDEX idx_shift_handoffs_date ON shift_handoffs(household_id, shift_date, created_at);
--> statement-breakpoint
CREATE TABLE safety_incidents (
  id TEXT PRIMARY KEY NOT NULL,
  household_id TEXT NOT NULL DEFAULT 'default',
  reporter_id TEXT NOT NULL REFERENCES members(id),
  category TEXT NOT NULL CHECK(category IN ('hazard','injury','violence_threat','unsafe_home','near_miss')),
  severity TEXT NOT NULL CHECK(severity IN ('low','medium','high','urgent')),
  occurred_at TEXT NOT NULL,
  location TEXT NOT NULL,
  description TEXT NOT NULL,
  immediate_action TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'submitted' CHECK(status IN ('submitted','reviewing','resolved')),
  assigned_to TEXT REFERENCES members(id),
  follow_up TEXT NOT NULL DEFAULT '',
  resolved_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
--> statement-breakpoint
CREATE INDEX idx_safety_incidents_triage ON safety_incidents(household_id, status, severity, created_at);
