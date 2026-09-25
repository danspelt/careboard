CREATE TABLE IF NOT EXISTS medications (
  id TEXT PRIMARY KEY NOT NULL,
  household_id TEXT NOT NULL DEFAULT 'default',
  name TEXT NOT NULL,
  dose TEXT NOT NULL DEFAULT '',
  instructions TEXT NOT NULL DEFAULT '',
  times_json TEXT NOT NULL DEFAULT '[]',
  prn INTEGER NOT NULL DEFAULT 0,
  active INTEGER NOT NULL DEFAULT 1,
  created_by TEXT NOT NULL REFERENCES members(id),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS medication_logs (
  id TEXT PRIMARY KEY NOT NULL,
  household_id TEXT NOT NULL DEFAULT 'default',
  medication_id TEXT NOT NULL REFERENCES medications(id) ON DELETE CASCADE,
  dose_date TEXT NOT NULL,
  scheduled_time TEXT,
  outcome TEXT NOT NULL CHECK (outcome IN ('given', 'refused', 'missed', 'held')),
  note TEXT NOT NULL DEFAULT '',
  logged_by TEXT NOT NULL REFERENCES members(id),
  logged_at TEXT NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS idx_medication_logs_slot ON medication_logs(medication_id, dose_date, scheduled_time) WHERE scheduled_time IS NOT NULL;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_medication_logs_date ON medication_logs(household_id, dose_date);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS care_profile (
  household_id TEXT PRIMARY KEY NOT NULL DEFAULT 'default',
  preferred_name TEXT NOT NULL DEFAULT '',
  important_to_me TEXT NOT NULL DEFAULT '',
  how_to_support TEXT NOT NULL DEFAULT '',
  communication TEXT NOT NULL DEFAULT '',
  daily_routine TEXT NOT NULL DEFAULT '',
  likes TEXT NOT NULL DEFAULT '',
  dislikes TEXT NOT NULL DEFAULT '',
  important_to_know TEXT NOT NULL DEFAULT '',
  emergency_contacts TEXT NOT NULL DEFAULT '',
  updated_by TEXT REFERENCES members(id),
  updated_at TEXT NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS appointments (
  id TEXT PRIMARY KEY NOT NULL,
  household_id TEXT NOT NULL DEFAULT 'default',
  title TEXT NOT NULL,
  appointment_date TEXT NOT NULL,
  appointment_time TEXT,
  location TEXT NOT NULL DEFAULT '',
  notes TEXT NOT NULL DEFAULT '',
  accompanying_id TEXT REFERENCES members(id),
  status TEXT NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'done', 'cancelled')),
  outcome TEXT NOT NULL DEFAULT '',
  created_by TEXT NOT NULL REFERENCES members(id),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_appointments_date ON appointments(household_id, status, appointment_date);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS kudos (
  id TEXT PRIMARY KEY NOT NULL,
  household_id TEXT NOT NULL DEFAULT 'default',
  sender_id TEXT NOT NULL REFERENCES members(id),
  recipient_id TEXT NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  badge TEXT NOT NULL,
  message TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_kudos_recent ON kudos(household_id, created_at);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS supply_items (
  id TEXT PRIMARY KEY NOT NULL,
  household_id TEXT NOT NULL DEFAULT 'default',
  name TEXT NOT NULL,
  quantity TEXT NOT NULL DEFAULT '',
  urgency TEXT NOT NULL DEFAULT 'normal' CHECK (urgency IN ('out', 'soon', 'normal')),
  added_by TEXT NOT NULL REFERENCES members(id),
  purchased_by TEXT REFERENCES members(id),
  purchased_at TEXT,
  created_at TEXT NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_supply_items_open ON supply_items(household_id, purchased_at, created_at);
