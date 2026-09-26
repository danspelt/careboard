import 'server-only';

import { getD1 } from '@/db';
import {
  DEFAULT_HIRE_CHECKLIST,
  type HireChecklistItem,
  type HrDocument,
  type HrDocumentAck,
  type HrDocumentCategory,
  type LeaveBalance,
  type LeaveKind,
  type LeaveRequest,
  type PayPeriod,
  type PayRun,
  type PayRunLine,
} from '@/lib/hr';
import { aggregateWorkerHours, grossFor, nextPeriod, periodContaining } from '@/lib/hr-payroll';

export type HrStateSlice = {
  leaveBalances: LeaveBalance[];
  leaveRequests: LeaveRequest[];
  hrDocuments: HrDocument[];
  hrDocumentAcks: HrDocumentAck[];
  hireChecklistItems: HireChecklistItem[];
  payPeriods: PayPeriod[];
  payRuns: PayRun[];
  payRunLines: PayRunLine[];
};

function optionalString(value: unknown, maxLength: number): string {
  const text = typeof value === 'string' ? value.trim() : '';
  return text.slice(0, maxLength);
}

function requiredString(value: unknown, label: string) {
  if (typeof value !== 'string' || !value.trim()) throw new Error(`${label} is required.`);
  return value.trim();
}

function clampNumber(value: unknown, min: number, max: number, fallback: number) {
  const number = typeof value === 'number' ? value : typeof value === 'string' && value.trim() ? Number(value) : NaN;
  if (!Number.isFinite(number)) return fallback;
  return Math.min(max, Math.max(min, number));
}

export async function loadHrState(): Promise<HrStateSlice> {
  const db = getD1();
  const [leaveBalances, leaveRequests, hrDocuments, hrDocumentAcks, hireChecklistItems, payPeriods, payRuns, payRunLines] = await Promise.all([
    db.prepare(`SELECT member_id AS memberId, kind, hours_entitled AS hoursEntitled, hours_used AS hoursUsed FROM leave_balances`).all<LeaveBalance>(),
    db.prepare(`SELECT id, member_id AS memberId, kind, start_on AS startOn, end_on AS endOn, hours, note, status, decided_by AS decidedBy, decided_at AS decidedAt, created_at AS createdAt FROM leave_requests ORDER BY created_at DESC LIMIT 300`).all<LeaveRequest>(),
    db.prepare(`SELECT id, title, category, body, required, created_by AS createdBy, created_at AS createdAt, archived_at AS archivedAt FROM hr_documents WHERE household_id='default' ORDER BY created_at DESC`).all<Omit<HrDocument, 'required'> & { required: number }>(),
    db.prepare(`SELECT document_id AS documentId, member_id AS memberId, acknowledged_at AS acknowledgedAt FROM hr_document_acks`).all<HrDocumentAck>(),
    db.prepare(`SELECT id, member_id AS memberId, title, done, done_at AS doneAt, done_by AS doneBy, sort_order AS sortOrder FROM hire_checklist_items WHERE household_id='default' ORDER BY member_id, sort_order`).all<Omit<HireChecklistItem, 'done'> & { done: number }>(),
    db.prepare(`SELECT id, start_on AS startOn, end_on AS endOn, status, created_at AS createdAt FROM pay_periods WHERE household_id='default' ORDER BY start_on DESC LIMIT 40`).all<PayPeriod>(),
    db.prepare(`SELECT id, period_id AS periodId, closed_at AS closedAt, closed_by AS closedBy, notes FROM pay_runs WHERE household_id='default' ORDER BY closed_at DESC LIMIT 40`).all<PayRun>(),
    db.prepare(`SELECT id, run_id AS runId, member_id AS memberId, hours, hourly_rate AS hourlyRate, gross_amount AS grossAmount, entry_ids_json AS entryIdsJson FROM pay_run_lines`).all<Omit<PayRunLine, 'entryIds'> & { entryIdsJson: string }>(),
  ]);
  return {
    leaveBalances: leaveBalances.results,
    leaveRequests: leaveRequests.results,
    hrDocuments: hrDocuments.results.map(({ required, ...doc }) => ({ ...doc, required: Boolean(required) })),
    hrDocumentAcks: hrDocumentAcks.results,
    hireChecklistItems: hireChecklistItems.results.map(({ done, ...item }) => ({ ...item, done: Boolean(done) })),
    payPeriods: payPeriods.results,
    payRuns: payRuns.results,
    payRunLines: payRunLines.results.map(({ entryIdsJson, ...line }) => {
      let entryIds: string[] = [];
      try { entryIds = JSON.parse(entryIdsJson) as string[]; } catch { entryIds = []; }
      return { ...line, entryIds };
    }),
  };
}

export async function ensureHireTemplates() {
  const db = getD1();
  const count = await db.prepare(`SELECT COUNT(*) AS count FROM hire_checklist_templates WHERE household_id='default'`).first<{ count: number }>();
  if ((count?.count ?? 0) > 0) return;
  await db.batch(DEFAULT_HIRE_CHECKLIST.map((title, index) =>
    db.prepare(`INSERT INTO hire_checklist_templates (id, household_id, title, sort_order) VALUES (?, 'default', ?, ?)`).bind(crypto.randomUUID(), title, index),
  ));
}

export async function seedLeaveBalancesForMember(memberId: string, defaultVacationHours: number) {
  const db = getD1();
  await db.batch([
    db.prepare(`INSERT INTO leave_balances (member_id, kind, hours_entitled, hours_used) VALUES (?, 'vacation', ?, 0) ON CONFLICT (member_id, kind) DO NOTHING`).bind(memberId, defaultVacationHours),
    db.prepare(`INSERT INTO leave_balances (member_id, kind, hours_entitled, hours_used) VALUES (?, 'sick', 0, 0) ON CONFLICT (member_id, kind) DO NOTHING`).bind(memberId),
  ]);
}

export async function seedHireChecklistForMember(memberId: string) {
  const db = getD1();
  await ensureHireTemplates();
  const existing = await db.prepare(`SELECT COUNT(*) AS count FROM hire_checklist_items WHERE member_id=?`).bind(memberId).first<{ count: number }>();
  if ((existing?.count ?? 0) > 0) return;
  const templates = await db.prepare(`SELECT title, sort_order AS sortOrder FROM hire_checklist_templates WHERE household_id='default' ORDER BY sort_order`).all<{ title: string; sortOrder: number }>();
  const titles = templates.results.length ? templates.results : DEFAULT_HIRE_CHECKLIST.map((title, sortOrder) => ({ title, sortOrder }));
  await db.batch(titles.map((row) =>
    db.prepare(`INSERT INTO hire_checklist_items (id, household_id, member_id, title, done, sort_order) VALUES (?, 'default', ?, ?, 0, ?)`).bind(crypto.randomUUID(), memberId, row.title, row.sortOrder),
  ));
}

export async function ensureOpenPayPeriod(settings: { payPeriodDays?: number; payPeriodAnchor?: string }) {
  const db = getD1();
  const today = new Date().toISOString().slice(0, 10);
  const days = settings.payPeriodDays ?? 14;
  const anchor = settings.payPeriodAnchor || '2025-01-06';
  const open = await db.prepare(`SELECT id, start_on AS startOn, end_on AS endOn, status, created_at AS createdAt FROM pay_periods WHERE household_id='default' AND status IN ('open','review') ORDER BY start_on DESC LIMIT 1`).first<PayPeriod>();
  if (open) return open;
  const bounds = periodContaining(today, anchor, days);
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  await db.prepare(`INSERT INTO pay_periods (id, household_id, start_on, end_on, status, created_at) VALUES (?, 'default', ?, ?, 'open', ?) ON CONFLICT (household_id, start_on) DO NOTHING`).bind(id, bounds.startOn, bounds.endOn, now).run();
  return (await db.prepare(`SELECT id, start_on AS startOn, end_on AS endOn, status, created_at AS createdAt FROM pay_periods WHERE household_id='default' AND start_on=?`).bind(bounds.startOn).first<PayPeriod>())!;
}

export async function applyHrMutation(input: {
  action: string;
  actorId: string;
  actorRole: string;
  now: string;
  payload: Record<string, unknown>;
  settings: { defaultVacationHours?: number; payPeriodDays?: number; payPeriodAnchor?: string };
}): Promise<boolean> {
  const { action, actorId, actorRole, now, payload, settings } = input;
  const db = getD1();
  const manager = actorRole === 'manager';

  if (action === 'requestLeave') {
    if (actorRole !== 'worker' && !manager) throw new Error('Only care workers can request leave.');
    const memberId = manager && typeof payload.memberId === 'string' && payload.memberId ? payload.memberId : actorId;
    if (!manager && memberId !== actorId) throw new Error('You can only request leave for yourself.');
    const kind = (['vacation', 'sick', 'other'].includes(String(payload.kind)) ? payload.kind : 'vacation') as LeaveKind;
    const startOn = requiredString(payload.startOn, 'Start date');
    const endOn = requiredString(payload.endOn, 'End date');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(startOn) || !/^\d{4}-\d{2}-\d{2}$/.test(endOn) || endOn < startOn) throw new Error('Choose a valid leave date range.');
    const hours = clampNumber(payload.hours, 0.25, 500, 8);
    const note = optionalString(payload.note, 1000);
    await db.prepare(`INSERT INTO leave_requests (id, household_id, member_id, kind, start_on, end_on, hours, note, status, created_at) VALUES (?, 'default', ?, ?, ?, ?, ?, ?, 'pending', ?)`).bind(crypto.randomUUID(), memberId, kind, startOn, endOn, hours, note, now).run();
    return true;
  }

  if (action === 'cancelLeaveRequest') {
    const requestId = requiredString(payload.requestId, 'Leave request');
    const row = await db.prepare(`SELECT member_id AS memberId, status FROM leave_requests WHERE id=?`).bind(requestId).first<{ memberId: string; status: string }>();
    if (!row || row.status !== 'pending') throw new Error('Only pending leave requests can be cancelled.');
    if (!manager && row.memberId !== actorId) throw new Error('You can only cancel your own leave request.');
    await db.prepare(`UPDATE leave_requests SET status='cancelled', decided_by=?, decided_at=? WHERE id=?`).bind(actorId, now, requestId).run();
    return true;
  }

  if (action === 'decideLeaveRequest') {
    if (!manager) throw new Error('Only the household manager can do that.');
    const requestId = requiredString(payload.requestId, 'Leave request');
    const decision = payload.decision === 'denied' ? 'denied' : 'approved';
    const row = await db.prepare(`SELECT member_id AS memberId, kind, hours, status FROM leave_requests WHERE id=?`).bind(requestId).first<{ memberId: string; kind: LeaveKind; hours: number; status: string }>();
    if (!row || row.status !== 'pending') throw new Error('That leave request is no longer pending.');
    await db.prepare(`UPDATE leave_requests SET status=?, decided_by=?, decided_at=? WHERE id=?`).bind(decision, actorId, now, requestId).run();
    if (decision === 'approved') {
      await db.prepare(`INSERT INTO leave_balances (member_id, kind, hours_entitled, hours_used) VALUES (?, ?, 0, ?) ON CONFLICT (member_id, kind) DO UPDATE SET hours_used = hours_used + excluded.hours_used`).bind(row.memberId, row.kind, row.hours).run();
    }
    return true;
  }

  if (action === 'setLeaveBalance') {
    if (!manager) throw new Error('Only the household manager can do that.');
    const memberId = requiredString(payload.memberId, 'Care worker');
    const kind = (['vacation', 'sick', 'other'].includes(String(payload.kind)) ? payload.kind : 'vacation') as LeaveKind;
    const hoursEntitled = clampNumber(payload.hoursEntitled, 0, 2000, 0);
    const hoursUsed = clampNumber(payload.hoursUsed, 0, 2000, 0);
    await db.prepare(`INSERT INTO leave_balances (member_id, kind, hours_entitled, hours_used) VALUES (?, ?, ?, ?) ON CONFLICT (member_id, kind) DO UPDATE SET hours_entitled=excluded.hours_entitled, hours_used=excluded.hours_used`).bind(memberId, kind, hoursEntitled, hoursUsed).run();
    return true;
  }

  if (action === 'saveHrDocument') {
    if (!manager) throw new Error('Only the household manager can do that.');
    const title = requiredString(payload.title, 'Document title').slice(0, 200);
    const category = (['policy', 'contract', 'handbook', 'other'].includes(String(payload.category)) ? payload.category : 'policy') as HrDocumentCategory;
    const body = optionalString(payload.body, 20_000);
    const required = payload.required === true || payload.required === 'true' || payload.required === 'on' || payload.required === '1';
    const id = typeof payload.id === 'string' && payload.id ? payload.id : crypto.randomUUID();
    const existing = await db.prepare(`SELECT id FROM hr_documents WHERE id=?`).bind(id).first();
    if (existing) {
      await db.prepare(`UPDATE hr_documents SET title=?, category=?, body=?, required=? WHERE id=? AND archived_at IS NULL`).bind(title, category, body, required ? 1 : 0, id).run();
    } else {
      await db.prepare(`INSERT INTO hr_documents (id, household_id, title, category, body, required, created_by, created_at) VALUES (?, 'default', ?, ?, ?, ?, ?, ?)`).bind(id, title, category, body, required ? 1 : 0, actorId, now).run();
    }
    return true;
  }

  if (action === 'archiveHrDocument') {
    if (!manager) throw new Error('Only the household manager can do that.');
    const documentId = requiredString(payload.documentId, 'Document');
    await db.prepare(`UPDATE hr_documents SET archived_at=? WHERE id=?`).bind(now, documentId).run();
    return true;
  }

  if (action === 'acknowledgeHrDocument') {
    const documentId = requiredString(payload.documentId, 'Document');
    const doc = await db.prepare(`SELECT id FROM hr_documents WHERE id=? AND archived_at IS NULL`).bind(documentId).first();
    if (!doc) throw new Error('That document is no longer available.');
    await db.prepare(`INSERT INTO hr_document_acks (document_id, member_id, acknowledged_at) VALUES (?, ?, ?) ON CONFLICT (document_id, member_id) DO UPDATE SET acknowledged_at=excluded.acknowledged_at`).bind(documentId, actorId, now).run();
    return true;
  }

  if (action === 'seedHireChecklist') {
    if (!manager) throw new Error('Only the household manager can do that.');
    await seedHireChecklistForMember(requiredString(payload.memberId, 'Care worker'));
    return true;
  }

  if (action === 'toggleHireChecklistItem') {
    if (!manager) throw new Error('Only the household manager can do that.');
    const itemId = requiredString(payload.itemId, 'Checklist item');
    const row = await db.prepare(`SELECT done FROM hire_checklist_items WHERE id=?`).bind(itemId).first<{ done: number }>();
    if (!row) throw new Error('Checklist item not found.');
    const done = !row.done;
    await db.prepare(`UPDATE hire_checklist_items SET done=?, done_at=?, done_by=? WHERE id=?`).bind(done ? 1 : 0, done ? now : null, done ? actorId : null, itemId).run();
    return true;
  }

  if (action === 'addHireChecklistItem') {
    if (!manager) throw new Error('Only the household manager can do that.');
    const memberId = requiredString(payload.memberId, 'Care worker');
    const title = requiredString(payload.title, 'Checklist item').slice(0, 200);
    const max = await db.prepare(`SELECT COALESCE(MAX(sort_order), -1) AS maxOrder FROM hire_checklist_items WHERE member_id=?`).bind(memberId).first<{ maxOrder: number }>();
    await db.prepare(`INSERT INTO hire_checklist_items (id, household_id, member_id, title, done, sort_order) VALUES (?, 'default', ?, ?, 0, ?)`).bind(crypto.randomUUID(), memberId, title, (max?.maxOrder ?? -1) + 1).run();
    return true;
  }

  if (action === 'ensurePayPeriods') {
    if (!manager) throw new Error('Only the household manager can do that.');
    await ensureOpenPayPeriod(settings);
    return true;
  }

  if (action === 'startPayPeriodReview') {
    if (!manager) throw new Error('Only the household manager can do that.');
    const period = await ensureOpenPayPeriod(settings);
    if (period.status === 'closed') throw new Error('That pay period is already closed.');
    await db.prepare(`UPDATE pay_periods SET status='review' WHERE id=?`).bind(period.id).run();
    return true;
  }

  if (action === 'reopenPayPeriod') {
    if (!manager) throw new Error('Only the household manager can do that.');
    const periodId = typeof payload.periodId === 'string' && payload.periodId
      ? payload.periodId
      : (await db.prepare(`SELECT id FROM pay_periods WHERE household_id='default' AND status='closed' ORDER BY end_on DESC LIMIT 1`).first<{ id: string }>())?.id;
    if (!periodId) throw new Error('No closed pay period to reopen.');
    const period = await db.prepare(`SELECT id, start_on AS startOn, end_on AS endOn, status FROM pay_periods WHERE id=?`).bind(periodId).first<{ id: string; startOn: string; endOn: string; status: string }>();
    if (!period || period.status !== 'closed') throw new Error('Only a closed pay period can be reopened.');
    const run = await db.prepare(`SELECT id FROM pay_runs WHERE period_id=? ORDER BY closed_at DESC LIMIT 1`).bind(period.id).first<{ id: string }>();
    const statements = [];
    if (run) {
      statements.push(db.prepare(`DELETE FROM pay_run_lines WHERE run_id=?`).bind(run.id));
      statements.push(db.prepare(`DELETE FROM pay_runs WHERE id=?`).bind(run.id));
    }
    statements.push(db.prepare(`UPDATE pay_periods SET status='open' WHERE id=?`).bind(period.id));
    // Drop an auto-created next open period that has no run yet, so only one open period remains.
    const later = await db.prepare(`SELECT id FROM pay_periods WHERE household_id='default' AND start_on > ? AND status IN ('open','review')`).bind(period.endOn).all<{ id: string }>();
    for (const row of later.results) {
      const hasRun = await db.prepare(`SELECT id FROM pay_runs WHERE period_id=? LIMIT 1`).bind(row.id).first();
      if (!hasRun) statements.push(db.prepare(`DELETE FROM pay_periods WHERE id=?`).bind(row.id));
    }
    await db.batch(statements);
    return true;
  }

  if (action === 'closePayRun') {
    if (!manager) throw new Error('Only the household manager can do that.');
    const period = await ensureOpenPayPeriod(settings);
    if (period.status === 'closed') throw new Error('That pay period is already closed.');
    const workers = await db.prepare(`SELECT id, hourly_rate AS hourlyRate FROM members m LEFT JOIN account_lifecycle l ON l.member_id=m.id WHERE m.role='worker' AND COALESCE(l.status,'active')='active'`).all<{ id: string; hourlyRate: number | null }>();
    const entries = await db.prepare(`SELECT id, member_id AS memberId, started_at AS startedAt, ended_at AS endedAt FROM time_entries WHERE started_at >= ? AND started_at <= ?`).bind(`${period.startOn}T00:00:00.000Z`, `${period.endOn}T23:59:59.999Z`).all<{ id: string; memberId: string; startedAt: string; endedAt: string | null }>();
    const runId = crypto.randomUUID();
    const notes = optionalString(payload.notes, 1000);
    const statements = [
      db.prepare(`INSERT INTO pay_runs (id, household_id, period_id, closed_at, closed_by, notes) VALUES (?, 'default', ?, ?, ?, ?)`).bind(runId, period.id, now, actorId, notes),
      db.prepare(`UPDATE pay_periods SET status='closed' WHERE id=?`).bind(period.id),
    ];
    for (const worker of workers.results) {
      const workerEntries = entries.results.filter((entry) => entry.memberId === worker.id);
      const { hours, entryIds } = aggregateWorkerHours(workerEntries, period.startOn, period.endOn, now);
      const gross = grossFor(hours, worker.hourlyRate);
      statements.push(db.prepare(`INSERT INTO pay_run_lines (id, run_id, member_id, hours, hourly_rate, gross_amount, entry_ids_json) VALUES (?, ?, ?, ?, ?, ?, ?)`).bind(crypto.randomUUID(), runId, worker.id, hours, worker.hourlyRate, gross, JSON.stringify(entryIds)));
    }
    const days = settings.payPeriodDays ?? 14;
    const next = nextPeriod({ startOn: period.startOn, endOn: period.endOn }, days);
    statements.push(db.prepare(`INSERT INTO pay_periods (id, household_id, start_on, end_on, status, created_at) VALUES (?, 'default', ?, ?, 'open', ?) ON CONFLICT (household_id, start_on) DO NOTHING`).bind(crypto.randomUUID(), next.startOn, next.endOn, now));
    await db.batch(statements);
    return true;
  }

  return false;
}

export function filterHrForWorker(slice: HrStateSlice, memberId: string): HrStateSlice {
  return {
    leaveBalances: slice.leaveBalances.filter((row) => row.memberId === memberId),
    leaveRequests: slice.leaveRequests.filter((row) => row.memberId === memberId),
    hrDocuments: slice.hrDocuments.filter((doc) => !doc.archivedAt),
    hrDocumentAcks: slice.hrDocumentAcks.filter((ack) => ack.memberId === memberId),
    hireChecklistItems: slice.hireChecklistItems.filter((item) => item.memberId === memberId),
    payPeriods: slice.payPeriods,
    payRuns: slice.payRuns,
    payRunLines: slice.payRunLines.filter((line) => line.memberId === memberId),
  };
}
