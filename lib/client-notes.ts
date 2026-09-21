import type { Role } from '@/lib/access-policy';

export type ClientNoteStatus = 'pending' | 'approved' | 'rejected';
export type ClientNoteDecision = 'approve' | 'reject';
export type InboxItem = {
  id: string;
  workerId: string;
  kind: 'manager_message' | 'direct_message' | 'client_note_pending' | 'client_note_approved' | 'client_note_rejected';
  body: string;
  submissionId: string | null;
  createdBy: string;
  createdAt: string;
  safetyCategory?: SafetyCategory | null;
  safetyReason?: string | null;
  safetyReviewedBy?: string | null;
  safetyReviewedAt?: string | null;
};

export type SafetyCategory = 'abuse' | 'threat' | 'medication' | 'emergency';
export type SafetyTriage = { category: SafetyCategory; reason: string } | null;

export function canSubmitClientNote(role: Role): boolean {
  return role === 'worker';
}

export function canReviewClientNote(role: Role): boolean {
  return role === 'manager';
}

export function normalizeClientNoteText(value: unknown, maxLength = 12_000): string {
  if (typeof value !== 'string') return '';
  return value
    .replaceAll('\r', '')
    .split('\n')
    .map((line) => line.trimEnd())
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
    .slice(0, maxLength);
}

export function reviewClientNote(status: ClientNoteStatus, decision: ClientNoteDecision, reviewedText: unknown) {
  if (status !== 'pending') throw new Error('That client note has already been reviewed.');
  if (decision === 'reject') return { status: 'rejected' as const, approvedText: null };
  if (decision !== 'approve') throw new Error('Choose approve or reject.');
  const approvedText = normalizeClientNoteText(reviewedText);
  if (!approvedText) throw new Error('Approved client notes require reviewed text.');
  return { status: 'approved' as const, approvedText };
}

export function visibleInbox<T extends { workerId: string; createdBy: string }>(role: Role, memberId: string, items: T[]): T[] {
  if (role === 'manager') return items;
  if (role === 'worker') return items.filter((item) => item.workerId === memberId || item.createdBy === memberId);
  return [];
}

export function visibleSafetyAlerts<T extends { safetyCategory?: SafetyCategory | null; safetyReason?: string | null }>(role: Role, items: T[]): T[] {
  if (role !== 'manager') return [];
  return items.filter((item) => Boolean(item.safetyCategory && item.safetyReason));
}

export function canSendInboxMessage(role: Role, senderId: string, recipient: { id: string; role: Role; status: string }): boolean {
  if (role !== 'manager' && role !== 'worker') return false;
  if (recipient.status !== 'active' || recipient.id === senderId) return false;
  return recipient.role === 'worker' || (role === 'worker' && recipient.role === 'manager');
}

export function scheduleChangeRequest(date: unknown, reason: unknown, shift: { id: string; weekday: number; startTime: string; endTime: string } | null) {
  if (typeof date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(Date.parse(`${date}T12:00:00Z`))) throw new Error('Choose a valid date for the schedule request.');
  if (!shift || new Date(`${date}T12:00:00Z`).getUTCDay() !== shift.weekday) throw new Error('Choose one of your shifts for that date.');
  const detail = typeof reason === 'string' ? reason.trim().slice(0, 500) : '';
  if (!detail) throw new Error('Explain what schedule change you need.');
  return { date, reason: detail, shift, body: `Schedule change request for ${date} (${shift.startTime}-${shift.endTime}): ${detail}` };
}

/** Friendly inbox copy for the coverage loop — coworkers see the ask until someone says yes. */
export function coverageAskMessage(name: string, date: string, startTime: string, endTime: string, reason: string) {
  return `${name} is looking for cover on ${date}, ${startTime}–${endTime} — “${reason}”. If you can take it, say yes from your dashboard and the schedule updates itself.`;
}

export function coverageAcceptedMessage(name: string, date: string, startTime: string, endTime: string) {
  return `${name} said yes — your ${date} shift, ${startTime}–${endTime}, is covered.`;
}

const SAFETY_RULES: Array<{ category: SafetyCategory; reason: string; patterns: RegExp[] }> = [
  {
    category: 'emergency',
    reason: 'The message may describe an immediate client emergency.',
    patterns: [/\b(?:not breathing|unresponsive|won't wake|will not wake|chest pain|severe bleeding|call(?:ed)? 911|ambulance)\b/i],
  },
  {
    category: 'abuse',
    reason: 'The message may describe abuse, neglect, or unsafe treatment.',
    patterns: [/\b(?:hit|hitting|slapped|abused|abuse|neglect(?:ed)?|locked (?:him|her|them) in)\b/i],
  },
  {
    category: 'threat',
    reason: 'The message may contain a credible threat of harm.',
    patterns: [/\b(?:threatened to (?:kill|hurt)|going to (?:kill|hurt)|kill (?:him|her|them|myself)|hurt (?:him|her|them|myself))\b/i],
  },
  {
    category: 'medication',
    reason: 'The message may describe a medication error or missed critical dose.',
    patterns: [/\b(?:wrong (?:medication|medicine|dose)|double dose|overdose|missed (?:a |the )?(?:critical |important )?(?:dose|medication)|medication error)\b/i],
  },
];

export function triageInboxMessage(value: unknown): SafetyTriage {
  const body = typeof value === 'string' ? value.trim().slice(0, 1000) : '';
  if (!body) return null;
  for (const rule of SAFETY_RULES) {
    if (rule.patterns.some((pattern) => pattern.test(body))) return { category: rule.category, reason: rule.reason };
  }
  return null;
}

export function canViewClientNoteImage(role: Role, memberId: string, submittedBy: string, status: ClientNoteStatus): boolean {
  return role === 'manager' || (role === 'worker' && (submittedBy === memberId || status === 'approved'));
}
