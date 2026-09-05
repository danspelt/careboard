import { index, integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';

export const members = sqliteTable('members', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  role: text('role').notNull().default('worker'),
  color: text('color').notNull(),
  createdAt: text('created_at').notNull(),
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
  },
  (table) => [
    index('idx_chores_status_due_date').on(table.status, table.dueDate),
    index('idx_chores_assigned_to_status').on(table.assignedTo, table.status),
  ],
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
