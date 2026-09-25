import 'server-only';
import nodemailer from 'nodemailer';

export type CoverageEmail = { recipients: string[]; date: string; startTime: string; endTime: string };
type MailSender = (message: { from: string; to: string; bcc: string[]; subject: string; text: string }) => Promise<unknown>;
type PayrollMailSender = (message: { from: string; to: string; subject: string; text: string; attachments: { filename: string; content: string }[] }) => Promise<unknown>;

export function coverageEmailMessage(input: CoverageEmail, from: string) {
  return {
    from,
    to: from,
    bcc: input.recipients,
    subject: `CareBoard shift coverage needed — ${input.date}`,
    text: `A care shift on ${input.date} from ${input.startTime} to ${input.endTime} may need coverage. Sign in to CareBoard and use the in-app Inbox to coordinate with the manager. The schedule has not changed yet.`,
  };
}

export async function sendCoverageEmail(input: CoverageEmail, sender?: MailSender) {
  const from = process.env.EMAIL_FROM?.trim();
  if (!input.recipients.length) return { status: 'skipped' as const };
  if (sender && from) { await sender(coverageEmailMessage(input, from)); return { status: 'sent' as const }; }
  const host = process.env.SMTP_HOST?.trim();
  const user = process.env.SMTP_USER?.trim();
  const pass = process.env.SMTP_PASSWORD;
  if (!from || !host || !user || !pass) return { status: 'skipped' as const };
  const port = Number(process.env.SMTP_PORT || 587);
  if (!Number.isInteger(port) || port < 1 || port > 65535) return { status: 'skipped' as const };
  const transport = nodemailer.createTransport({ host, port, secure: process.env.SMTP_SECURE === 'true', auth: { user, pass } });
  await transport.sendMail(coverageEmailMessage(input, from));
  return { status: 'sent' as const };
}

export async function sendManagerCoverageEmail(input: CoverageEmail, sender?: MailSender) {
  const from = process.env.EMAIL_FROM?.trim();
  if (!input.recipients.length) return { status: 'skipped' as const };
  const message = { ...coverageEmailMessage(input, from || ''), subject: `CareBoard coverage accepted — ${input.date}`, text: `Coverage was accepted for the ${input.date} shift from ${input.startTime} to ${input.endTime}. Sign in to CareBoard to review the resolved schedule change.` };
  if (sender && from) { await sender(message); return { status: 'sent' as const }; }
  const host = process.env.SMTP_HOST?.trim(); const user = process.env.SMTP_USER?.trim(); const pass = process.env.SMTP_PASSWORD;
  if (!from || !host || !user || !pass) return { status: 'skipped' as const };
  const port = Number(process.env.SMTP_PORT || 587);
  if (!Number.isInteger(port) || port < 1 || port > 65535) return { status: 'skipped' as const };
  const transport = nodemailer.createTransport({ host, port, secure: process.env.SMTP_SECURE === 'true', auth: { user, pass } });
  await transport.sendMail(message);
  return { status: 'sent' as const };
}

export type InviteEmail = { recipient: string; name: string; role: 'worker' | 'viewer'; inviteUrl: string };

export function inviteEmailMessage(input: InviteEmail, from: string) {
  const roleLabel = input.role === 'viewer' ? 'family viewer' : 'care worker';
  return {
    from,
    to: input.recipient,
    subject: `You're invited to CareBoard`,
    text: `Hi ${input.name},\n\nYou've been invited to join CareBoard as a ${roleLabel}. Open this link within 7 days to set your password and sign in:\n\n${input.inviteUrl}\n\nIf you weren't expecting this invitation, you can ignore this email.`,
  };
}

export async function sendInviteEmail(input: InviteEmail, sender?: (message: { from: string; to: string; subject: string; text: string }) => Promise<unknown>) {
  const from = process.env.EMAIL_FROM?.trim();
  const message = inviteEmailMessage(input, from || '');
  if (sender && from) { await sender(message); return { status: 'sent' as const }; }
  const host = process.env.SMTP_HOST?.trim(); const user = process.env.SMTP_USER?.trim(); const pass = process.env.SMTP_PASSWORD;
  if (!from || !host || !user || !pass) return { status: 'skipped' as const };
  const port = Number(process.env.SMTP_PORT || 587);
  if (!Number.isInteger(port) || port < 1 || port > 65535) return { status: 'skipped' as const };
  const transport = nodemailer.createTransport({ host, port, secure: process.env.SMTP_SECURE === 'true', auth: { user, pass } });
  await transport.sendMail(message);
  return { status: 'sent' as const };
}

export type PayrollReportEmail = { recipient: string; from: string; to: string; csv: string; filename: string };

export function payrollReportMessage(input: PayrollReportEmail, from: string) {
  return {
    from,
    to: input.recipient,
    subject: `CareBoard payroll report — ${input.from} to ${input.to}`,
    text: `Attached is the CareBoard payroll report for ${input.from} to ${input.to}: each care worker's clock-in and clock-out times, daily hours, hourly rate, gross pay, and period totals.`,
    attachments: [{ filename: input.filename, content: input.csv }],
  };
}

export async function sendPayrollReportEmail(input: PayrollReportEmail, sender?: PayrollMailSender) {
  const from = process.env.EMAIL_FROM?.trim();
  const message = payrollReportMessage(input, from || '');
  if (sender && from) { await sender(message); return { status: 'sent' as const }; }
  const host = process.env.SMTP_HOST?.trim(); const user = process.env.SMTP_USER?.trim(); const pass = process.env.SMTP_PASSWORD;
  if (!from || !host || !user || !pass) return { status: 'skipped' as const };
  const port = Number(process.env.SMTP_PORT || 587);
  if (!Number.isInteger(port) || port < 1 || port > 65535) return { status: 'skipped' as const };
  const transport = nodemailer.createTransport({ host, port, secure: process.env.SMTP_SECURE === 'true', auth: { user, pass } });
  await transport.sendMail(message);
  return { status: 'sent' as const };
}
