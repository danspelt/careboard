import type { Role } from '@/lib/access-policy';

export const INCIDENT_CATEGORIES = ['hazard', 'injury', 'violence_threat', 'unsafe_home', 'near_miss'] as const;
export const INCIDENT_SEVERITIES = ['low', 'medium', 'high', 'urgent'] as const;
export const INCIDENT_STATUSES = ['submitted', 'reviewing', 'resolved'] as const;

export type IncidentCategory = (typeof INCIDENT_CATEGORIES)[number];
export type IncidentSeverity = (typeof INCIDENT_SEVERITIES)[number];
export type IncidentStatus = (typeof INCIDENT_STATUSES)[number];

export const incidentCategoryLabels: Record<IncidentCategory, string> = {
  hazard: 'Environmental hazard',
  injury: 'Injury',
  violence_threat: 'Violence or threat',
  unsafe_home: 'Unsafe home conditions',
  near_miss: 'Near miss',
};

export const incidentSeverityLabels: Record<IncidentSeverity, string> = {
  low: 'Low',
  medium: 'Medium',
  high: 'High',
  urgent: 'Urgent',
};

function clean(value: unknown, maxLength: number) {
  return (typeof value === 'string' ? value.trim() : '').slice(0, maxLength);
}

function requiredDate(value: unknown, label: string) {
  const text = clean(value, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text) || Number.isNaN(Date.parse(`${text}T12:00:00Z`))) throw new Error(`Choose a valid ${label.toLowerCase()}.`);
  return text;
}

export function validateShiftHandoff(input: Record<string, unknown>, today: string) {
  const shiftDate = requiredDate(input.shiftDate, 'shift date');
  if (shiftDate > today) throw new Error('A handoff can only be recorded for a shift that already happened.');
  const completedCare = clean(input.completedCare, 2000);
  if (!completedCare) throw new Error('Describe the care you completed during the shift.');
  const outstandingTasks = clean(input.outstandingTasks, 2000);
  const observations = clean(input.observations, 2000);
  const rawChecklist = Array.isArray(input.checklist) ? input.checklist : typeof input.checklist === 'string' ? input.checklist.split('\n') : [];
  const checklist = rawChecklist.map((item) => clean(item, 200)).filter(Boolean).slice(0, 20);
  return { shiftDate, completedCare, outstandingTasks, observations, checklist };
}

export function validateSafetyIncident(input: Record<string, unknown>, now: string) {
  const category = INCIDENT_CATEGORIES.includes(input.category as IncidentCategory) ? (input.category as IncidentCategory) : null;
  if (!category) throw new Error('Choose the kind of safety concern.');
  const severity = INCIDENT_SEVERITIES.includes(input.severity as IncidentSeverity) ? (input.severity as IncidentSeverity) : null;
  if (!severity) throw new Error('Choose how serious the concern is.');
  const occurredAt = clean(input.occurredAt, 16);
  if (!/^\d{4}-\d{2}-\d{2}T([01]\d|2[0-3]):[0-5]\d$/.test(occurredAt)) throw new Error('Choose when the incident happened.');
  if (occurredAt > now.slice(0, 16)) throw new Error('The incident time cannot be in the future.');
  const location = clean(input.location, 200);
  if (!location) throw new Error('Describe where it happened.');
  const description = clean(input.description, 4000);
  if (!description) throw new Error('Describe what happened.');
  const immediateAction = clean(input.immediateAction, 1000);
  return { category, severity, occurredAt, location, description, immediateAction };
}

export function triageSafetyIncident(current: { status: IncidentStatus }, input: Record<string, unknown>) {
  if (current.status === 'resolved') throw new Error('That safety report is already resolved.');
  const status: IncidentStatus = input.status === 'resolved' ? 'resolved' : input.status === 'reviewing' ? 'reviewing' : current.status;
  const followUp = clean(input.followUp, 2000);
  const assignedTo = clean(input.assignedTo, 100) || null;
  return { status, followUp, assignedTo, resolved: status === 'resolved' };
}

// Handoffs stay private: managers see all of them, workers see their own plus
// handoffs from workers whose shift date they accepted coverage for.
export function visibleShiftHandoffs<T extends { authorId: string; shiftDate: string }>(
  role: Role,
  memberId: string,
  handoffs: T[],
  coverage: Array<{ requesterId: string; requestedDate: string; acceptedBy: string | null }>,
): T[] {
  if (role === 'manager') return handoffs;
  if (role !== 'worker') return [];
  const covered = new Set(coverage.filter((request) => request.acceptedBy === memberId).map((request) => `${request.requesterId}:${request.requestedDate}`));
  return handoffs.filter((handoff) => handoff.authorId === memberId || covered.has(`${handoff.authorId}:${handoff.shiftDate}`));
}

// Safety reports are restricted to the reporter and the manager so workers
// cannot see each other's incident history.
export function visibleSafetyIncidents<T extends { reporterId: string }>(role: Role, memberId: string, incidents: T[]): T[] {
  if (role === 'manager') return incidents;
  if (role === 'worker') return incidents.filter((incident) => incident.reporterId === memberId);
  return [];
}
