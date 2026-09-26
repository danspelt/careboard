ALTER TABLE household_settings ADD COLUMN csil_financial_retention_years INTEGER NOT NULL DEFAULT 7;
--> statement-breakpoint
ALTER TABLE household_settings ADD COLUMN csil_authority_template_json TEXT NOT NULL DEFAULT '{}';
--> statement-breakpoint
CREATE TABLE csil_documents (id TEXT PRIMARY KEY NOT NULL, household_id TEXT NOT NULL DEFAULT 'default', expense_id TEXT REFERENCES csil_expenses(id) ON DELETE SET NULL, kind TEXT NOT NULL, stored_name TEXT NOT NULL, original_name TEXT NOT NULL, mime_type TEXT NOT NULL, byte_size INTEGER NOT NULL, ocr_text TEXT NOT NULL DEFAULT '', uploaded_by TEXT NOT NULL REFERENCES members(id), created_at TEXT NOT NULL);
--> statement-breakpoint
CREATE TABLE csil_bank_transactions (id TEXT PRIMARY KEY NOT NULL, household_id TEXT NOT NULL DEFAULT 'default', posted_on TEXT NOT NULL, description TEXT NOT NULL, amount REAL NOT NULL, external_id TEXT NOT NULL DEFAULT '', matched_expense_id TEXT REFERENCES csil_expenses(id), import_batch TEXT NOT NULL, created_at TEXT NOT NULL, UNIQUE(household_id, external_id));
--> statement-breakpoint
CREATE TABLE csil_reimbursements (id TEXT PRIMARY KEY NOT NULL, household_id TEXT NOT NULL DEFAULT 'default', claimant_id TEXT NOT NULL REFERENCES members(id), expense_date TEXT NOT NULL, description TEXT NOT NULL, amount REAL NOT NULL, status TEXT NOT NULL DEFAULT 'pending', decided_by TEXT REFERENCES members(id), decided_at TEXT, decision_note TEXT NOT NULL DEFAULT '', created_at TEXT NOT NULL);
--> statement-breakpoint
CREATE TABLE csil_consents (id TEXT PRIMARY KEY NOT NULL, household_id TEXT NOT NULL DEFAULT 'default', subject_member_id TEXT REFERENCES members(id), purpose TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'granted', granted_at TEXT, expires_on TEXT, withdrawn_at TEXT, recorded_by TEXT NOT NULL REFERENCES members(id), created_at TEXT NOT NULL);
--> statement-breakpoint
CREATE TABLE csil_emergency_plan (household_id TEXT PRIMARY KEY NOT NULL DEFAULT 'default', primary_contact TEXT NOT NULL DEFAULT '', backup_contacts TEXT NOT NULL DEFAULT '', agency_plan TEXT NOT NULL DEFAULT '', essential_care TEXT NOT NULL DEFAULT '', escalation TEXT NOT NULL DEFAULT '', last_reviewed_on TEXT, updated_by TEXT REFERENCES members(id), updated_at TEXT NOT NULL);
