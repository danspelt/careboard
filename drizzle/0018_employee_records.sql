ALTER TABLE members ADD COLUMN date_of_birth TEXT;
--> statement-breakpoint
ALTER TABLE members ADD COLUMN address TEXT NOT NULL DEFAULT '';
--> statement-breakpoint
ALTER TABLE members ADD COLUMN job_title TEXT NOT NULL DEFAULT 'Care worker';
--> statement-breakpoint
ALTER TABLE members ADD COLUMN employment_started_on TEXT;
