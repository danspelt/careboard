import 'server-only';
import twilio from 'twilio';

export function isE164(value: unknown): value is string {
  return typeof value === 'string' && /^\+[1-9]\d{7,14}$/.test(value);
}

type SmsSender = (message: { to: string; from: string; body: string }) => Promise<unknown>;

export async function sendCareBoardSms(recipients: string[], body: string, sender?: SmsSender) {
  const from = process.env.TWILIO_FROM_NUMBER?.trim();
  const eligible = [...new Set(recipients.filter(isE164))];
  if (!eligible.length) return { sent: 0, failed: 0, skipped: true };
  if (!from || !isE164(from)) return { sent: 0, failed: 0, skipped: true };
  const accountSid = process.env.TWILIO_ACCOUNT_SID?.trim();
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const send = sender ?? (accountSid && authToken ? async (message) => twilio(accountSid, authToken).messages.create(message) : null);
  if (!send) return { sent: 0, failed: 0, skipped: true };
  const results = await Promise.allSettled(eligible.map((to) => send({ to, from, body: body.slice(0, 320) })));
  return { sent: results.filter((result) => result.status === 'fulfilled').length, failed: results.filter((result) => result.status === 'rejected').length, skipped: false };
}
