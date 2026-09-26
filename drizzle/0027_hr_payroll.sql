ALTER TABLE household_settings ADD COLUMN pay_period_days INTEGER NOT NULL DEFAULT 14;
--> statement-breakpoint
ALTER TABLE household_settings ADD COLUMN pay_period_anchor TEXT NOT NULL DEFAULT '2025-01-06';
--> statement-breakpoint
CREATE TABLE pay_periods (
  id TEXT PRIMARY KEY NOT NULL,
  household_id TEXT NOT NULL DEFAULT 'default',
  start_on TEXT NOT NULL,
  end_on TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'review', 'closed')),
  created_at TEXT NOT NULL,
  UNIQUE (household_id, start_on)
);
--> statement-breakpoint
CREATE TABLE pay_runs (
  id TEXT PRIMARY KEY NOT NULL,
  household_id TEXT NOT NULL DEFAULT 'default',
  period_id TEXT NOT NULL REFERENCES pay_periods(id),
  closed_at TEXT NOT NULL,
  closed_by TEXT NOT NULL REFERENCES members(id),
  notes TEXT NOT NULL DEFAULT ''
);
--> statement-breakpoint
CREATE TABLE pay_run_lines (
  id TEXT PRIMARY KEY NOT NULL,
  run_id TEXT NOT NULL REFERENCES pay_runs(id),
  member_id TEXT NOT NULL REFERENCES members(id),
  hours REAL NOT NULL,
  hourly_rate REAL,
  gross_amount REAL NOT NULL,
  entry_ids_json TEXT NOT NULL DEFAULT '[]'
);
--> statement-breakpoint
CREATE INDEX idx_pay_periods_status ON pay_periods(household_id, status, end_on);
--> statement-breakpoint
CREATE INDEX idx_pay_run_lines_run ON pay_run_lines(run_id, member_id);
