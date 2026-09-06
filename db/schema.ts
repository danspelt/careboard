import { index, integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';

export const members = sqliteTable('members', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  role: text('role').notNull().default('worker'),
  color: text('color').notNull(),
  createdAt: text('created_at').notNull(),
  phone: text('phone'),
  availability: text('availability').notNull().default(''),
  skillsNotes: text('skills_notes').notNull().default(''),
  emergencyContact: text('emergency_contact'),
  certifications: text('certifications').notNull().default(''),
  languages: text('languages').notNull().default(''),
  profilePhotoId: text('profile_photo_id'),
});

export const accountLifecycle = sqliteTable(
  'account_lifecycle',
  {
    memberId: text('member_id').primaryKey().references(() => members.id),
    householdId: text('household_id').notNull().default('default'),
    status: text('status').notNull().default('active'),
    activatedAt: text('activated_at'),
    disabledAt: text('disabled_at'),
    updatedAt: text('updated_at').notNull(),
  },
  (table) => [index('idx_account_lifecycle_household_status').on(table.householdId, table.status)],
);

export const authCredentials = sqliteTable('auth_credentials', {
  email: text('email').primaryKey(),
  passwordHash: text('password_hash').notNull(),
  mustChangePassword: integer('must_change_password', { mode: 'boolean' }).notNull().default(true),
  updatedAt: text('updated_at').notNull(),
});

export const householdSettings = sqliteTable('household_settings', {
  householdId: text('household_id').primaryKey().default('default'),
  recurrenceHorizonDays: integer('recurrence_horizon_days').notNull().default(30),
  reminderDefaultLeadDays: integer('reminder_default_lead_days').notNull().default(1),
  retentionDays: integer('retention_days').notNull().default(90),
  updatedAt: text('updated_at').notNull(),
});

export const chores = sqliteTable(
  'chores',
  {
    id: text('id').primaryKey(),
    title: text('title').notNull(),
    area: text('area').notNull(),
    dueDate: text('due_date'),
    status: text('status').notNull().default('open'),
    createdBy: text('created_by').notNull().references(() => members.id),
    assignedTo: text('assigned_to').references(() => members.id),
    completedBy: text('completed_by').references(() => members.id),
    createdAt: text('created_at').notNull(),
    completedAt: text('completed_at'),
    startedAt: text('started_at'),
    priority: text('priority').notNull().default('normal'),
    instructions: text('instructions').notNull().default(''),
    dueTime: text('due_time'),
    recurrence: text('recurrence'),
    recurrenceParentId: text('recurrence_parent_id'),
    recurrenceDate: text('recurrence_date'),
    progressNotes: text('progress_notes').notNull().default(''),
    completionNotes: text('completion_notes').notNull().default(''),
    issueReport: text('issue_report').notNull().default(''),
    issueOpen: integer('issue_open').notNull().default(0),
    reminderLeadDays: integer('reminder_lead_days'),
    expectedCompletionAt: text('expected_completion_at'),
  },
  (table) => [
    index('idx_chores_status_due_date').on(table.status, table.dueDate),
    index('idx_chores_assigned_to_status').on(table.assignedTo, table.status),
  ],
);

export const proofPhotos = sqliteTable(
  'proof_photos',
  {
    id: text('id').primaryKey(),
    choreId: text('chore_id').references(() => chores.id, { onDelete: 'cascade' }),
    profileMemberId: text('profile_member_id').references(() => members.id, { onDelete: 'cascade' }),
    uploadedBy: text('uploaded_by').notNull().references(() => members.id),
    storedName: text('stored_name').notNull(),
    originalName: text('original_name').notNull(),
    mimeType: text('mime_type').notNull(),
    byteSize: integer('byte_size').notNull(),
    createdAt: text('created_at').notNull(),
  },
  (table) => [index('idx_proof_photos_chore').on(table.choreId, table.createdAt)],
);

export const taskNotes = sqliteTable(
  'task_notes',
  {
    id: text('id').primaryKey(),
    choreId: text('chore_id').notNull().references(() => chores.id, { onDelete: 'cascade' }),
    memberId: text('member_id').notNull().references(() => members.id),
    kind: text('kind').notNull(),
    body: text('body').notNull(),
    createdAt: text('created_at').notNull(),
  },
  (table) => [index('idx_task_notes_chore').on(table.choreId, table.createdAt)],
);

export const activity = sqliteTable(
  'activity',
  {
    id: text('id').primaryKey(),
    choreId: text('chore_id').references(() => chores.id, { onDelete: 'cascade' }),
    memberId: text('member_id').notNull().references(() => members.id),
    action: text('action').notNull(),
    detail: text('detail').notNull(),
    createdAt: text('created_at').notNull(),
  },
  (table) => [index('idx_activity_created_at').on(table.createdAt)],
);

export const auditLog = sqliteTable(
  'audit_log',
  {
    id: text('id').primaryKey(),
    choreId: text('chore_id').references(() => chores.id),
    actorId: text('actor_id').notNull().references(() => members.id),
    action: text('action').notNull(),
    detail: text('detail').notNull(),
    createdAt: text('created_at').notNull(),
  },
  (table) => [index('idx_audit_log_created_at').on(table.createdAt)],
);
