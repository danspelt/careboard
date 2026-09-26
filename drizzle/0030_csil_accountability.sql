ALTER TABLE household_settings ADD COLUMN csil_health_authority TEXT NOT NULL DEFAULT '';
--> statement-breakpoint
ALTER TABLE household_settings ADD COLUMN csil_agreement_start TEXT;
--> statement-breakpoint
ALTER TABLE household_settings ADD COLUMN csil_agreement_end TEXT;
--> statement-breakpoint
ALTER TABLE household_settings ADD COLUMN csil_client_contribution REAL NOT NULL DEFAULT 0;
--> statement-breakpoint
ALTER TABLE household_settings ADD COLUMN csil_report_due_days INTEGER NOT NULL DEFAULT 45;
--> statement-breakpoint
ALTER TABLE household_settings ADD COLUMN csil_account_last_four TEXT NOT NULL DEFAULT '';
--> statement-breakpoint
ALTER TABLE household_settings ADD COLUMN csil_contact_name TEXT NOT NULL DEFAULT '';
--> statement-breakpoint
ALTER TABLE household_settings ADD COLUMN csil_contact_email TEXT NOT NULL DEFAULT '';
--> statement-breakpoint
CREATE TABLE csil_expenses (
  id TEXT PRIMARY KEY NOT NULL,
  household_id TEXT NOT NULL DEFAULT 'default',
  expense_date TEXT NOT NULL,
  vendor TEXT NOT NULL,
  category TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  amount REAL NOT NULL,
  eligibility_status TEXT NOT NULL DEFAULT 'pending' CHECK (eligibility_status IN ('confirmed','pending','ineligible')),
  receipt_reference TEXT NOT NULL DEFAULT '',
  created_by TEXT NOT NULL REFERENCES members(id),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
--> statement-breakpoint
CREATE INDEX idx_csil_expenses_household_date ON csil_expenses(household_id, expense_date);
--> statement-breakpoint
CREATE TABLE csil_monthly_reports (
  id TEXT PRIMARY KEY NOT NULL,
  household_id TEXT NOT NULL DEFAULT 'default',
  report_month TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','submitted','accepted','returned')),
  submitted_at TEXT,
  notes TEXT NOT NULL DEFAULT '',
  created_by TEXT NOT NULL REFERENCES members(id),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE(household_id, report_month)
);
--> statement-breakpoint
CREATE INDEX idx_csil_reports_household_month ON csil_monthly_reports(household_id, report_month);
