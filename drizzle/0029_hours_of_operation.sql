ALTER TABLE household_settings ADD COLUMN operating_hours_start TEXT NOT NULL DEFAULT '08:00';
--> statement-breakpoint
ALTER TABLE household_settings ADD COLUMN operating_hours_end TEXT NOT NULL DEFAULT '14:00';
--> statement-breakpoint
ALTER TABLE household_settings ADD COLUMN operating_weekdays TEXT NOT NULL DEFAULT '1,2,3,4,5';
