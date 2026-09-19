-- CareBoard PostgreSQL schema (consolidated from SQLite migrations 0000–0013)
-- Applied as a single transaction on first connection to a fresh database.

CREATE TABLE members (
  id TEXT PRIMARY KEY NOT NULL,
  name TEXT NOT NULL,
  role TEXT DEFAULT 'worker' NOT NULL,
  color TEXT NOT NULL,
  created_at TEXT NOT NULL,
  phone TEXT,
  sms_opt_in INTEGER NOT NULL DEFAULT 0,
  availability TEXT NOT NULL DEFAULT '',
  skills_notes TEXT NOT NULL DEFAULT '',
  emergency_contact TEXT,
  certifications TEXT NOT NULL DEFAULT '',
  languages TEXT NOT NULL DEFAULT '',
  profile_photo_id TEXT,
  hourly_rate DOUBLE PRECISION,
  date_of_birth TEXT,
  address TEXT NOT NULL DEFAULT '',
  job_title TEXT NOT NULL DEFAULT 'Care worker',
  employment_started_on TEXT
);
--> statement-breakpoint
CREATE TABLE chores (
  id TEXT PRIMARY KEY NOT NULL,
  title TEXT NOT NULL,
  area TEXT NOT NULL,
  due_date TEXT,
  status TEXT DEFAULT 'open' NOT NULL,
  created_by TEXT NOT NULL REFERENCES members(id) ON UPDATE NO ACTION ON DELETE NO ACTION,
  assigned_to TEXT REFERENCES members(id) ON UPDATE NO ACTION ON DELETE NO ACTION,
  completed_by TEXT REFERENCES members(id) ON UPDATE NO ACTION ON DELETE NO ACTION,
  created_at TEXT NOT NULL,
  completed_at TEXT,
  started_at TEXT,
  priority TEXT NOT NULL DEFAULT 'normal' CHECK(priority IN ('low','normal','high','urgent')),
  instructions TEXT NOT NULL DEFAULT '',
  due_time TEXT,
  recurrence TEXT CHECK(recurrence IN ('daily','weekly','monthly')),
  recurrence_parent_id TEXT REFERENCES chores(id),
  recurrence_date TEXT,
  progress_notes TEXT NOT NULL DEFAULT '',
  completion_notes TEXT NOT NULL DEFAULT '',
  issue_report TEXT NOT NULL DEFAULT '',
  reminder_lead_days INTEGER,
  expected_completion_at TEXT,
  issue_open INTEGER NOT NULL DEFAULT 0 CHECK(issue_open IN (0,1)),
  review_status TEXT CHECK(review_status IS NULL OR review_status IN ('pending','approved'))
);
--> statement-breakpoint
CREATE INDEX idx_chores_status_due_date ON chores (status, due_date);
--> statement-breakpoint
CREATE INDEX idx_chores_assigned_to_status ON chores (assigned_to, status);
--> statement-breakpoint
CREATE UNIQUE INDEX idx_chores_recurrence_instance ON chores(recurrence_parent_id, recurrence_date) WHERE recurrence_parent_id IS NOT NULL;
--> statement-breakpoint
CREATE TABLE activity (
  id TEXT PRIMARY KEY NOT NULL,
  chore_id TEXT REFERENCES chores(id) ON UPDATE NO ACTION ON DELETE CASCADE,
  member_id TEXT NOT NULL REFERENCES members(id) ON UPDATE NO ACTION ON DELETE NO ACTION,
  action TEXT NOT NULL,
  detail TEXT NOT NULL,
  created_at TEXT NOT NULL
);
--> statement-breakpoint
CREATE INDEX idx_activity_created_at ON activity (created_at);
--> statement-breakpoint
CREATE TABLE account_lifecycle (
  member_id TEXT PRIMARY KEY NOT NULL REFERENCES members(id) ON UPDATE NO ACTION ON DELETE NO ACTION,
  household_id TEXT DEFAULT 'default' NOT NULL,
  status TEXT DEFAULT 'active' NOT NULL,
  activated_at TEXT,
  disabled_at TEXT,
  updated_at TEXT NOT NULL
);
--> statement-breakpoint
CREATE INDEX idx_account_lifecycle_household_status ON account_lifecycle (household_id, status);
--> statement-breakpoint
CREATE TABLE auth_credentials (
  email TEXT PRIMARY KEY NOT NULL,
  password_hash TEXT NOT NULL,
  must_change_password INTEGER DEFAULT 1 NOT NULL,
  updated_at TEXT NOT NULL
);
--> statement-breakpoint
CREATE TABLE google_accounts (
  email TEXT PRIMARY KEY NOT NULL,
  member_id TEXT NOT NULL UNIQUE REFERENCES members(id) ON DELETE CASCADE
);
--> statement-breakpoint
CREATE TABLE proof_photos (
  id TEXT PRIMARY KEY NOT NULL,
  chore_id TEXT REFERENCES chores(id) ON DELETE CASCADE,
  profile_member_id TEXT REFERENCES members(id) ON DELETE CASCADE,
  uploaded_by TEXT NOT NULL REFERENCES members(id),
  stored_name TEXT NOT NULL UNIQUE,
  original_name TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  byte_size INTEGER NOT NULL,
  created_at TEXT NOT NULL
);
--> statement-breakpoint
CREATE INDEX idx_proof_photos_chore ON proof_photos(chore_id, created_at);
--> statement-breakpoint
CREATE INDEX idx_proof_photos_profile_member ON proof_photos(profile_member_id, created_at);
--> statement-breakpoint
ALTER TABLE members ADD CONSTRAINT members_profile_photo_fk FOREIGN KEY (profile_photo_id) REFERENCES proof_photos(id) ON DELETE SET NULL;
--> statement-breakpoint
CREATE TABLE task_notes (
  id TEXT PRIMARY KEY NOT NULL,
  chore_id TEXT NOT NULL REFERENCES chores(id) ON DELETE CASCADE,
  member_id TEXT NOT NULL REFERENCES members(id),
  kind TEXT NOT NULL CHECK(kind IN ('progress','completion','issue')),
  body TEXT NOT NULL,
  created_at TEXT NOT NULL
);
--> statement-breakpoint
CREATE INDEX idx_task_notes_chore ON task_notes(chore_id, created_at);
--> statement-breakpoint
CREATE TABLE audit_log (
  id TEXT PRIMARY KEY NOT NULL,
  chore_id TEXT REFERENCES chores(id),
  actor_id TEXT NOT NULL REFERENCES members(id),
  action TEXT NOT NULL,
  detail TEXT NOT NULL,
  created_at TEXT NOT NULL
);
--> statement-breakpoint
CREATE OR REPLACE FUNCTION activity_to_audit_fn() RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO audit_log(id, chore_id, actor_id, action, detail, created_at)
  VALUES(gen_random_uuid()::TEXT, NEW.chore_id, NEW.member_id, NEW.action, NEW.detail, NEW.created_at);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint
CREATE TRIGGER activity_to_audit AFTER INSERT ON activity FOR EACH ROW EXECUTE FUNCTION activity_to_audit_fn();
--> statement-breakpoint
CREATE OR REPLACE FUNCTION audit_log_immutable_fn() RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'audit history is immutable';
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint
CREATE TRIGGER audit_log_no_update BEFORE UPDATE ON audit_log FOR EACH ROW EXECUTE FUNCTION audit_log_immutable_fn();
--> statement-breakpoint
CREATE TRIGGER audit_log_no_delete BEFORE DELETE ON audit_log FOR EACH ROW EXECUTE FUNCTION audit_log_immutable_fn();
--> statement-breakpoint
CREATE TABLE household_settings (
  household_id TEXT PRIMARY KEY NOT NULL DEFAULT 'default',
  recurrence_horizon_days INTEGER NOT NULL DEFAULT 30 CHECK(recurrence_horizon_days BETWEEN 1 AND 365),
  reminder_default_lead_days INTEGER NOT NULL DEFAULT 1 CHECK(reminder_default_lead_days BETWEEN 0 AND 90),
  retention_days INTEGER NOT NULL DEFAULT 90 CHECK(retention_days BETWEEN 1 AND 365),
  updated_at TEXT NOT NULL DEFAULT (NOW()::TEXT),
  funded_hours_monthly DOUBLE PRECISION NOT NULL DEFAULT 0,
  funding_hourly_rate DOUBLE PRECISION NOT NULL DEFAULT 0
);
--> statement-breakpoint
INSERT INTO household_settings (household_id, recurrence_horizon_days, reminder_default_lead_days, retention_days, updated_at)
VALUES ('default', 30, 1, 90, NOW()::TEXT)
ON CONFLICT (household_id) DO NOTHING;
--> statement-breakpoint
CREATE TABLE shifts (
  id TEXT PRIMARY KEY NOT NULL,
  member_id TEXT NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  weekday INTEGER NOT NULL CHECK(weekday BETWEEN 0 AND 6),
  start_time TEXT NOT NULL,
  end_time TEXT NOT NULL,
  created_at TEXT NOT NULL
);
--> statement-breakpoint
CREATE INDEX idx_shifts_member ON shifts(member_id, weekday);
--> statement-breakpoint
CREATE TABLE availability_windows (
  id TEXT PRIMARY KEY NOT NULL,
  member_id TEXT NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  weekday INTEGER NOT NULL CHECK(weekday BETWEEN 0 AND 6),
  start_time TEXT NOT NULL,
  end_time TEXT NOT NULL,
  created_at TEXT NOT NULL
);
--> statement-breakpoint
CREATE INDEX idx_availability_member ON availability_windows(member_id, weekday);
--> statement-breakpoint
CREATE TABLE worker_invites (
  id TEXT PRIMARY KEY NOT NULL,
  member_id TEXT NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  accepted_at TEXT,
  created_at TEXT NOT NULL
);
--> statement-breakpoint
CREATE INDEX idx_worker_invites_member ON worker_invites(member_id);
--> statement-breakpoint
CREATE TABLE time_entries (
  id TEXT PRIMARY KEY NOT NULL,
  member_id TEXT NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  started_at TEXT NOT NULL,
  ended_at TEXT,
  created_at TEXT NOT NULL
);
--> statement-breakpoint
CREATE INDEX idx_time_entries_member ON time_entries(member_id, started_at);
--> statement-breakpoint
CREATE TABLE certification_records (
  id TEXT PRIMARY KEY,
  member_id TEXT NOT NULL,
  name TEXT NOT NULL,
  expires_on TEXT NOT NULL,
  created_at TEXT NOT NULL
);
--> statement-breakpoint
CREATE INDEX idx_certification_records_member ON certification_records(member_id);
--> statement-breakpoint
CREATE TABLE messages (
  id TEXT PRIMARY KEY NOT NULL,
  member_id TEXT NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  body TEXT NOT NULL,
  created_at TEXT NOT NULL
);
--> statement-breakpoint
CREATE INDEX idx_messages_created ON messages(created_at);
--> statement-breakpoint
CREATE TABLE client_note_submissions (
  id TEXT PRIMARY KEY NOT NULL,
  household_id TEXT NOT NULL DEFAULT 'default',
  client_member_id TEXT NOT NULL REFERENCES members(id),
  submitted_by TEXT NOT NULL REFERENCES members(id),
  source_photo_id TEXT REFERENCES proof_photos(id) ON DELETE SET NULL,
  ocr_text TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  approved_text TEXT,
  reviewed_by TEXT REFERENCES members(id),
  reviewed_at TEXT,
  created_at TEXT NOT NULL
);
--> statement-breakpoint
CREATE INDEX idx_client_note_submissions_status ON client_note_submissions(household_id, status, created_at);
--> statement-breakpoint
CREATE INDEX idx_client_note_submissions_client ON client_note_submissions(client_member_id, created_at);
--> statement-breakpoint
CREATE TABLE worker_inbox_items (
  id TEXT PRIMARY KEY NOT NULL,
  household_id TEXT NOT NULL DEFAULT 'default',
  worker_id TEXT NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK (kind IN ('manager_message', 'direct_message', 'client_note_pending', 'client_note_approved', 'client_note_rejected')),
  body TEXT NOT NULL,
  submission_id TEXT REFERENCES client_note_submissions(id) ON DELETE SET NULL,
  created_by TEXT NOT NULL REFERENCES members(id),
  created_at TEXT NOT NULL,
  safety_category TEXT CHECK (safety_category IS NULL OR safety_category IN ('abuse', 'threat', 'medication', 'emergency')),
  safety_reason TEXT,
  safety_reviewed_by TEXT REFERENCES members(id),
  safety_reviewed_at TEXT
);
--> statement-breakpoint
CREATE INDEX idx_worker_inbox_items_worker ON worker_inbox_items(household_id, worker_id, created_at);
--> statement-breakpoint
CREATE INDEX idx_worker_inbox_items_sender ON worker_inbox_items(household_id, created_by, created_at);
--> statement-breakpoint
CREATE TABLE schedule_change_requests (
  id TEXT PRIMARY KEY NOT NULL,
  household_id TEXT NOT NULL DEFAULT 'default',
  requester_id TEXT NOT NULL REFERENCES members(id),
  shift_id TEXT NOT NULL REFERENCES shifts(id),
  requested_date TEXT NOT NULL,
  start_time TEXT NOT NULL,
  end_time TEXT NOT NULL,
  reason TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'covered')),
  accepted_by TEXT REFERENCES members(id),
  accepted_at TEXT,
  created_at TEXT NOT NULL,
  UNIQUE(requester_id, requested_date)
);
--> statement-breakpoint
CREATE INDEX idx_schedule_change_requests_status_date ON schedule_change_requests(household_id, status, requested_date);
--> statement-breakpoint
CREATE TABLE shift_handoffs (
  id TEXT PRIMARY KEY NOT NULL,
  household_id TEXT NOT NULL DEFAULT 'default',
  author_id TEXT NOT NULL REFERENCES members(id),
  shift_date TEXT NOT NULL,
  completed_care TEXT NOT NULL,
  outstanding_tasks TEXT NOT NULL,
  observations TEXT NOT NULL,
  checklist_json TEXT NOT NULL DEFAULT '[]',
  created_at TEXT NOT NULL
);
--> statement-breakpoint
CREATE INDEX idx_shift_handoffs_date ON shift_handoffs(household_id, shift_date, created_at);
--> statement-breakpoint
CREATE TABLE safety_incidents (
  id TEXT PRIMARY KEY NOT NULL,
  household_id TEXT NOT NULL DEFAULT 'default',
  reporter_id TEXT NOT NULL REFERENCES members(id),
  category TEXT NOT NULL CHECK(category IN ('hazard','injury','violence_threat','unsafe_home','near_miss')),
  severity TEXT NOT NULL CHECK(severity IN ('low','medium','high','urgent')),
  occurred_at TEXT NOT NULL,
  location TEXT NOT NULL,
  description TEXT NOT NULL,
  immediate_action TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'submitted' CHECK(status IN ('submitted','reviewing','resolved')),
  assigned_to TEXT REFERENCES members(id),
  follow_up TEXT NOT NULL DEFAULT '',
  resolved_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
--> statement-breakpoint
CREATE INDEX idx_safety_incidents_triage ON safety_incidents(household_id, status, severity, created_at);
