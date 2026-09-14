ALTER TABLE worker_inbox_items ADD COLUMN safety_category TEXT CHECK (safety_category IS NULL OR safety_category IN ('abuse', 'threat', 'medication', 'emergency'));
--> statement-breakpoint
ALTER TABLE worker_inbox_items ADD COLUMN safety_reason TEXT;
--> statement-breakpoint
ALTER TABLE worker_inbox_items ADD COLUMN safety_reviewed_by TEXT REFERENCES members(id);
--> statement-breakpoint
ALTER TABLE worker_inbox_items ADD COLUMN safety_reviewed_at TEXT;
