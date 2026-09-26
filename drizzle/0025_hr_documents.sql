CREATE TABLE hr_documents (
  id TEXT PRIMARY KEY NOT NULL,
  household_id TEXT NOT NULL DEFAULT 'default',
  title TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('policy', 'contract', 'handbook', 'other')),
  body TEXT NOT NULL DEFAULT '',
  required INTEGER NOT NULL DEFAULT 0,
  created_by TEXT NOT NULL REFERENCES members(id),
  created_at TEXT NOT NULL,
  archived_at TEXT
);
--> statement-breakpoint
CREATE TABLE hr_document_acks (
  document_id TEXT NOT NULL REFERENCES hr_documents(id),
  member_id TEXT NOT NULL REFERENCES members(id),
  acknowledged_at TEXT NOT NULL,
  PRIMARY KEY (document_id, member_id)
);
--> statement-breakpoint
CREATE INDEX idx_hr_documents_active ON hr_documents(household_id, archived_at, required);
