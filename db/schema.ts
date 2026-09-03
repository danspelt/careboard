import { index, sqliteTable, text } from 'drizzle-orm/sqlite-core';

export const members = sqliteTable('members', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  role: text('role').notNull().default('worker'),
  color: text('color').notNull(),
  createdAt: text('created_at').notNull(),
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
