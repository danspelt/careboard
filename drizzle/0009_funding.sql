ALTER TABLE household_settings ADD COLUMN funded_hours_monthly REAL NOT NULL DEFAULT 0;
--> statement-breakpoint
ALTER TABLE household_settings ADD COLUMN funding_hourly_rate REAL NOT NULL DEFAULT 0;
--> statement-breakpoint
ALTER TABLE members ADD COLUMN hourly_rate REAL;
