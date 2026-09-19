ALTER TABLE household_settings ADD COLUMN bookkeeper_email TEXT NOT NULL DEFAULT '';
--> statement-breakpoint
ALTER TABLE household_settings ADD COLUMN payroll_last_sent TEXT NOT NULL DEFAULT '';
