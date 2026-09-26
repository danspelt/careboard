CREATE TABLE hire_checklist_templates (
  id TEXT PRIMARY KEY NOT NULL,
  household_id TEXT NOT NULL DEFAULT 'default',
  title TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0
);
--> statement-breakpoint
CREATE TABLE hire_checklist_items (
  id TEXT PRIMARY KEY NOT NULL,
  household_id TEXT NOT NULL DEFAULT 'default',
  member_id TEXT NOT NULL REFERENCES members(id),
  title TEXT NOT NULL,
  done INTEGER NOT NULL DEFAULT 0,
  done_at TEXT,
  done_by TEXT REFERENCES members(id),
  sort_order INTEGER NOT NULL DEFAULT 0
);
--> statement-breakpoint
CREATE INDEX idx_hire_checklist_member ON hire_checklist_items(household_id, member_id, sort_order);
