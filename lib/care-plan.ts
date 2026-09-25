// Care-plan features: medication round, one-page "About me" profile, appointments,
// team shout-outs, and the household supplies list. Pure module — validation and
// derivation only, so the database backend and the local-dev preview share rules.
import type { Role } from '@/lib/access-policy';

const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;
const DATE = /^\d{4}-\d{2}-\d{2}$/;

function clean(value: unknown, maxLength: number) {
  return (typeof value === 'string' ? value.trim() : '').slice(0, maxLength);
}

function validDate(value: unknown, message: string) {
  const text = clean(value, 10);
  if (!DATE.test(text) || Number.isNaN(Date.parse(`${text}T12:00:00Z`))) throw new Error(message);
  return text;
}

function minutesOf(time: string) {
  const [hours, minutes] = time.split(':').map(Number);
  return hours * 60 + minutes;
}

// ---- Medication round ----

export const DOSE_OUTCOMES = ['given', 'refused', 'missed', 'held'] as const;
export type DoseOutcome = (typeof DOSE_OUTCOMES)[number];
export type DoseStatus = DoseOutcome | 'upcoming' | 'due' | 'overdue';

export const doseOutcomeLabels: Record<DoseOutcome, string> = {
  given: 'Given',
  refused: 'Refused',
  missed: 'Missed',
  held: 'Held (not given on purpose)',
};

export type Medication = { id: string; name: string; dose: string; instructions: string; times: string[]; prn: boolean; active: boolean; createdAt: string; updatedAt: string };
export type MedicationLog = { id: string; medicationId: string; doseDate: string; scheduledTime: string | null; outcome: DoseOutcome; note: string; loggedBy: string; loggedAt: string };
export type DoseSlot = { medication: Medication; scheduledTime: string; status: DoseStatus; log: MedicationLog | null };

/** Minutes after the scheduled time before an unlogged dose counts as overdue. */
export const DOSE_GRACE_MINUTES = 60;

export function parseDoseTimes(value: unknown): string[] {
  const raw = Array.isArray(value) ? value : typeof value === 'string' ? value.split(/[\s,]+/) : [];
  const times = raw.map((item) => clean(item, 5)).filter(Boolean);
  for (const time of times) if (!TIME.test(time)) throw new Error(`"${time}" is not a valid time — use 24-hour HH:MM, like 08:00.`);
  return [...new Set(times)].sort().slice(0, 8);
}

export function validateMedication(input: Record<string, unknown>) {
  const name = clean(input.name, 120);
  if (!name) throw new Error('Enter the medication name.');
  const prn = input.prn === true || input.prn === 'on' || input.prn === 'true';
  const times = parseDoseTimes(input.times);
  if (!prn && times.length === 0) throw new Error('Add at least one scheduled time, or mark the medication as "as needed".');
  return { name, dose: clean(input.dose, 120), instructions: clean(input.instructions, 1000), times: prn ? [] : times, prn };
}

/**
 * Dose times are local wall-clock times, so the dose date comes from the caregiver's
 * device. The server only accepts dates within a day of its own UTC date, which covers
 * every real timezone offset without allowing back- or forward-dated records.
 */
export function resolveDoseDate(value: unknown, serverToday: string) {
  const date = validDate(value ?? serverToday, 'Choose a valid dose date.');
  const days = Math.abs(Date.parse(`${date}T12:00:00Z`) - Date.parse(`${serverToday}T12:00:00Z`)) / 86_400_000;
  if (days > 1) throw new Error('Doses can only be logged for today.');
  return date;
}

export function validateDoseLog(input: Record<string, unknown>, medication: Pick<Medication, 'times' | 'prn' | 'active'> | null, serverToday: string, logs: Array<Pick<MedicationLog, 'doseDate' | 'scheduledTime'>>) {
  if (!medication || !medication.active) throw new Error('That medication is no longer on the care plan.');
  const doseDate = resolveDoseDate(input.doseDate, serverToday);
  const outcome = DOSE_OUTCOMES.includes(input.outcome as DoseOutcome) ? (input.outcome as DoseOutcome) : null;
  if (!outcome) throw new Error('Choose whether the dose was given, refused, missed, or held.');
  const note = clean(input.note, 500);
  if (outcome !== 'given' && !note) throw new Error('Add a short note explaining why the dose was not given.');
  if (medication.prn) {
    if (outcome !== 'given' && outcome !== 'refused') throw new Error('As-needed doses are logged as given or refused.');
    if (outcome === 'given' && !note) throw new Error('Add a short note on why the as-needed dose was given.');
    return { doseDate, scheduledTime: null, outcome, note };
  }
  const scheduledTime = clean(input.scheduledTime, 5);
  if (!medication.times.includes(scheduledTime)) throw new Error('Choose one of the scheduled dose times.');
  if (logs.some((log) => log.doseDate === doseDate && log.scheduledTime === scheduledTime)) throw new Error('That dose is already logged. Ask the manager if it needs correcting.');
  return { doseDate, scheduledTime, outcome, note };
}

/** Today's scheduled doses with live status, plus the as-needed doses already logged today. */
export function medicationRound(medications: Medication[], logs: MedicationLog[], date: string, nowTime: string, graceMinutes = DOSE_GRACE_MINUTES) {
  const todayLogs = logs.filter((log) => log.doseDate === date);
  const slots: DoseSlot[] = [];
  for (const medication of medications) {
    if (!medication.active || medication.prn) continue;
    for (const scheduledTime of medication.times) {
      const log = todayLogs.find((item) => item.medicationId === medication.id && item.scheduledTime === scheduledTime) ?? null;
      const late = minutesOf(nowTime) - minutesOf(scheduledTime);
      const status: DoseStatus = log ? log.outcome : late < 0 ? 'upcoming' : late > graceMinutes ? 'overdue' : 'due';
      slots.push({ medication, scheduledTime, status, log });
    }
  }
  slots.sort((a, b) => a.scheduledTime.localeCompare(b.scheduledTime) || a.medication.name.localeCompare(b.medication.name));
  const prnLogs = todayLogs.filter((log) => log.scheduledTime === null);
  const count = (...statuses: DoseStatus[]) => slots.filter((slot) => statuses.includes(slot.status)).length;
  return {
    slots,
    prnMedications: medications.filter((medication) => medication.active && medication.prn),
    prnLogs,
    counts: { total: slots.length, given: count('given'), pending: count('upcoming', 'due'), overdue: count('overdue'), exceptions: count('refused', 'missed', 'held') },
  };
}

export function doseAlertMessage(actorName: string, medicationName: string, scheduledTime: string | null, outcome: DoseOutcome, note: string) {
  const when = scheduledTime ? `the ${scheduledTime} dose of` : 'an as-needed dose of';
  return `Medication ${outcome}: ${actorName} logged ${when} ${medicationName} as ${outcome}. Note: ${note.slice(0, 300)}`;
}

// ---- One-page "About me" profile ----

export const CARE_PROFILE_FIELDS = [
  { key: 'preferredName', column: 'preferred_name', label: 'Preferred name', max: 100, hint: 'What they like to be called' },
  { key: 'importantToMe', column: 'important_to_me', label: 'What is important to me', max: 2000, hint: 'People, routines, and things that matter most' },
  { key: 'howToSupport', column: 'how_to_support', label: 'How best to support me', max: 2000, hint: 'What good support looks like — and what to avoid' },
  { key: 'communication', column: 'communication', label: 'How I communicate', max: 1000, hint: 'Words, signs, or cues and what they mean' },
  { key: 'dailyRoutine', column: 'daily_routine', label: 'My daily routine', max: 2000, hint: 'Morning to bedtime, in order' },
  { key: 'likes', column: 'likes', label: 'Things I enjoy', max: 1000, hint: 'Food, music, activities, conversation topics' },
  { key: 'dislikes', column: 'dislikes', label: 'Things that upset me', max: 1000, hint: 'Triggers, dislikes, and how to help' },
  { key: 'importantToKnow', column: 'important_to_know', label: 'Important to know', max: 2000, hint: 'Allergies, mobility, safety notes' },
  { key: 'emergencyContacts', column: 'emergency_contacts', label: 'Key contacts', max: 1000, hint: 'Family, doctor, pharmacy — name and number' },
] as const;

export type CareProfileKey = (typeof CARE_PROFILE_FIELDS)[number]['key'];
export type CareProfile = Record<CareProfileKey, string> & { updatedBy: string | null; updatedAt: string | null };

export function emptyCareProfile(): CareProfile {
  return { ...Object.fromEntries(CARE_PROFILE_FIELDS.map((field) => [field.key, ''])), updatedBy: null, updatedAt: null } as CareProfile;
}

export function validateCareProfile(input: Record<string, unknown>) {
  const profile = Object.fromEntries(CARE_PROFILE_FIELDS.map((field) => [field.key, clean(input[field.key], field.max)])) as Record<CareProfileKey, string>;
  if (!Object.values(profile).some(Boolean)) throw new Error('Fill in at least one section of the profile.');
  return profile;
}

export function careProfileCompleteness(profile: Partial<Record<CareProfileKey, string>> | null | undefined) {
  const filled = CARE_PROFILE_FIELDS.filter((field) => (profile?.[field.key] ?? '').trim()).length;
  return { filled, total: CARE_PROFILE_FIELDS.length };
}

// ---- Appointments ----

export type AppointmentStatus = 'scheduled' | 'done' | 'cancelled';
export type Appointment = { id: string; title: string; date: string; time: string | null; location: string; notes: string; accompanyingId: string | null; status: AppointmentStatus; outcome: string; createdAt: string; updatedAt: string };

export function validateAppointment(input: Record<string, unknown>, today: string) {
  const title = clean(input.title, 160);
  if (!title) throw new Error('Enter what the appointment is for.');
  const date = validDate(input.date, 'Choose a valid appointment date.');
  if (date < today) throw new Error('Appointments are scheduled for today or later.');
  const time = clean(input.time, 5);
  if (time && !TIME.test(time)) throw new Error('Enter a valid appointment time.');
  return { title, date, time: time || null, location: clean(input.location, 200), notes: clean(input.notes, 1000), accompanyingId: clean(input.accompanyingId, 100) || null };
}

export function canCompleteAppointment(role: Role, memberId: string, appointment: Pick<Appointment, 'status' | 'accompanyingId'>) {
  if (appointment.status !== 'scheduled') return false;
  return role === 'manager' || (role === 'worker' && appointment.accompanyingId === memberId);
}

export function upcomingAppointments<T extends Pick<Appointment, 'date' | 'time' | 'status'>>(appointments: T[], today: string, days = 30) {
  const horizon = new Date(`${today}T12:00:00Z`);
  horizon.setUTCDate(horizon.getUTCDate() + days);
  const end = horizon.toISOString().slice(0, 10);
  return appointments
    .filter((item) => item.status === 'scheduled' && item.date >= today && item.date <= end)
    .sort((a, b) => a.date.localeCompare(b.date) || (a.time ?? '99:99').localeCompare(b.time ?? '99:99'));
}

// ---- Team shout-outs ----

export const KUDOS_BADGES = {
  teamwork: 'Great teamwork',
  above_and_beyond: 'Above and beyond',
  calm: 'Calm under pressure',
  communication: 'Clear communication',
  reliability: 'Reliable and on time',
  compassion: 'Compassionate care',
} as const;
export type KudosBadge = keyof typeof KUDOS_BADGES;
export type Kudos = { id: string; senderId: string; recipientId: string; badge: KudosBadge; message: string; createdAt: string };

export function validateKudos(input: Record<string, unknown>, senderId: string, recipient: { id: string; role: Role; status: string } | null) {
  if (!recipient || recipient.status !== 'active' || (recipient.role !== 'worker' && recipient.role !== 'manager')) throw new Error('Choose an active care team member.');
  if (recipient.id === senderId) throw new Error('Shout-outs are for teammates — pick someone else.');
  const badge = Object.hasOwn(KUDOS_BADGES, String(input.badge)) ? (input.badge as KudosBadge) : null;
  if (!badge) throw new Error('Choose what you are recognizing.');
  return { recipientId: recipient.id, badge, message: clean(input.message, 280) };
}

// Shout-outs are team-internal: the care team sees them, family viewers do not.
export function visibleKudos<T>(role: Role, items: T[]): T[] {
  return role === 'manager' || role === 'worker' ? items : [];
}

export function kudosCounts(items: Array<Pick<Kudos, 'recipientId' | 'createdAt'>>, since: string) {
  const counts = new Map<string, number>();
  for (const item of items) if (item.createdAt >= since) counts.set(item.recipientId, (counts.get(item.recipientId) ?? 0) + 1);
  return counts;
}

// ---- Supplies list ----

export const SUPPLY_URGENCIES = ['out', 'soon', 'normal'] as const;
export type SupplyUrgency = (typeof SUPPLY_URGENCIES)[number];
export const supplyUrgencyLabels: Record<SupplyUrgency, string> = { out: 'Out now', soon: 'Running low', normal: 'Next shop' };
export type SupplyItem = { id: string; name: string; quantity: string; urgency: SupplyUrgency; addedBy: string; purchasedBy: string | null; purchasedAt: string | null; createdAt: string };

export function validateSupplyItem(input: Record<string, unknown>) {
  const name = clean(input.name, 120);
  if (!name) throw new Error('Enter the item that is needed.');
  const urgency = SUPPLY_URGENCIES.includes(input.urgency as SupplyUrgency) ? (input.urgency as SupplyUrgency) : 'normal';
  return { name, quantity: clean(input.quantity, 60), urgency };
}

/** Needed items first (most urgent, then oldest), followed by items bought in the last week. */
export function supplyList<T extends Pick<SupplyItem, 'urgency' | 'purchasedAt' | 'createdAt'>>(items: T[], now: string) {
  const weekAgo = new Date(new Date(now).getTime() - 7 * 86_400_000).toISOString();
  const rank = (urgency: SupplyUrgency) => SUPPLY_URGENCIES.indexOf(urgency);
  return {
    needed: items.filter((item) => !item.purchasedAt).sort((a, b) => rank(a.urgency) - rank(b.urgency) || a.createdAt.localeCompare(b.createdAt)),
    recentlyBought: items.filter((item) => item.purchasedAt && item.purchasedAt >= weekAgo).sort((a, b) => (b.purchasedAt ?? '').localeCompare(a.purchasedAt ?? '')),
  };
}
