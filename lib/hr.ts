/** Shared HR types and Overview alert aggregation (pure, testable). */

export type LeaveKind = 'vacation' | 'sick' | 'other';
export type LeaveStatus = 'pending' | 'approved' | 'denied' | 'cancelled';

export type LeaveBalance = {
  memberId: string;
  kind: LeaveKind;
  hoursEntitled: number;
  hoursUsed: number;
};

export type LeaveRequest = {
  id: string;
  memberId: string;
  kind: LeaveKind;
  startOn: string;
  endOn: string;
  hours: number;
  note: string;
  status: LeaveStatus;
  decidedBy: string | null;
  decidedAt: string | null;
  createdAt: string;
};

export type HrDocumentCategory = 'policy' | 'contract' | 'handbook' | 'other';

export type HrDocument = {
  id: string;
  title: string;
  category: HrDocumentCategory;
  body: string;
  required: boolean;
  createdBy: string;
  createdAt: string;
  archivedAt: string | null;
};

export type HrDocumentAck = {
  documentId: string;
  memberId: string;
  acknowledgedAt: string;
};

export type HireChecklistItem = {
  id: string;
  memberId: string;
  title: string;
  done: boolean;
  doneAt: string | null;
  doneBy: string | null;
  sortOrder: number;
};

export type PayPeriodStatus = 'open' | 'review' | 'closed';

export type PayPeriod = {
  id: string;
  startOn: string;
  endOn: string;
  status: PayPeriodStatus;
  createdAt: string;
};

export type PayRun = {
  id: string;
  periodId: string;
  closedAt: string;
  closedBy: string;
  notes: string;
};

export type PayRunLine = {
  id: string;
  runId: string;
  memberId: string;
  hours: number;
  hourlyRate: number | null;
  grossAmount: number;
  entryIds: string[];
};

export type HrAlert = {
  id: string;
  kind: 'leave' | 'docs' | 'hire' | 'certs' | 'payroll';
  title: string;
  detail: string;
};

export const DEFAULT_HIRE_CHECKLIST = [
  'Complete employment profile',
  'Set hourly pay rate',
  'Set weekly shifts',
  'Add certifications',
  'Acknowledge required policies',
  'Complete first clock-in',
] as const;

export function remainingLeaveHours(balance: LeaveBalance) {
  return Math.max(0, balance.hoursEntitled - balance.hoursUsed);
}

export function buildHrAlerts(input: {
  pendingLeave: number;
  unsignedRequiredDocs: number;
  incompleteHireChecklists: number;
  certAlerts: number;
  payPeriodReady: boolean;
  payPeriodLabel?: string;
}): HrAlert[] {
  const alerts: HrAlert[] = [];
  if (input.pendingLeave > 0) {
    alerts.push({
      id: 'leave',
      kind: 'leave',
      title: `${input.pendingLeave} leave request${input.pendingLeave === 1 ? '' : 's'} awaiting decision`,
      detail: 'Review vacation and sick time in HR → Time off.',
    });
  }
  if (input.unsignedRequiredDocs > 0) {
    alerts.push({
      id: 'docs',
      kind: 'docs',
      title: `${input.unsignedRequiredDocs} required document acknowledgment${input.unsignedRequiredDocs === 1 ? '' : 's'} outstanding`,
      detail: 'See who still needs to sign in HR → Documents.',
    });
  }
  if (input.incompleteHireChecklists > 0) {
    alerts.push({
      id: 'hire',
      kind: 'hire',
      title: `${input.incompleteHireChecklists} hire checklist${input.incompleteHireChecklists === 1 ? '' : 's'} incomplete`,
      detail: 'Finish onboarding steps in HR → Onboarding.',
    });
  }
  if (input.certAlerts > 0) {
    alerts.push({
      id: 'certs',
      kind: 'certs',
      title: `${input.certAlerts} certification alert${input.certAlerts === 1 ? '' : 's'}`,
      detail: 'Expired or expiring certifications need attention.',
    });
  }
  if (input.payPeriodReady) {
    alerts.push({
      id: 'payroll',
      kind: 'payroll',
      title: 'Pay period ready to close',
      detail: input.payPeriodLabel ? `Close ${input.payPeriodLabel} in HR → Payroll.` : 'Review hours and close the pay run in HR → Payroll.',
    });
  }
  return alerts;
}

/** Count workers (hired in last 90 days) with any incomplete hire checklist item. */
export function incompleteHireWorkerCount(
  items: HireChecklistItem[],
  workers: Array<{ id: string; employmentStartedOn?: string | null; createdAt?: string }>,
  today: string,
) {
  const cutoff = addDays(today, -90);
  const recent = new Set(
    workers
      .filter((worker) => {
        const start = worker.employmentStartedOn || (worker.createdAt ? worker.createdAt.slice(0, 10) : today);
        return start >= cutoff;
      })
      .map((worker) => worker.id),
  );
  const incomplete = new Set<string>();
  for (const item of items) {
    if (!item.done && recent.has(item.memberId)) incomplete.add(item.memberId);
  }
  return incomplete.size;
}

/** Required active docs × active workers missing an ack. */
export function unsignedRequiredDocCount(
  documents: HrDocument[],
  acks: HrDocumentAck[],
  workerIds: string[],
) {
  const required = documents.filter((doc) => doc.required && !doc.archivedAt);
  if (!required.length || !workerIds.length) return 0;
  const ackSet = new Set(acks.map((ack) => `${ack.documentId}:${ack.memberId}`));
  let count = 0;
  for (const doc of required) {
    for (const workerId of workerIds) {
      if (!ackSet.has(`${doc.id}:${workerId}`)) count += 1;
    }
  }
  return count;
}

function addDays(isoDate: string, days: number) {
  const date = new Date(`${isoDate}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

export function memberOnApprovedLeave(
  requests: LeaveRequest[],
  memberId: string,
  date: string,
) {
  return requests.some(
    (request) =>
      request.memberId === memberId &&
      request.status === 'approved' &&
      request.startOn <= date &&
      request.endOn >= date,
  );
}
