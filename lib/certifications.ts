export type Certification = { id: string; memberId: string; name: string; expiresOn: string; createdAt: string };

export type CertStatus = 'expired' | 'expiring' | 'valid';

const DAY_MS = 86_400_000;
const EXPIRING_WITHIN_DAYS = 30;

export function certStatus(expiresOn: string, now: string): CertStatus {
  const today = now.slice(0, 10);
  if (expiresOn < today) return 'expired';
  const cutoff = new Date(new Date(`${today}T00:00:00Z`).getTime() + EXPIRING_WITHIN_DAYS * DAY_MS).toISOString().slice(0, 10);
  return expiresOn <= cutoff ? 'expiring' : 'valid';
}

export function certDaysLeft(expiresOn: string, now: string) {
  return Math.round((new Date(`${expiresOn}T00:00:00Z`).getTime() - new Date(`${now.slice(0, 10)}T00:00:00Z`).getTime()) / DAY_MS);
}

export type CertAlert = { certification: Certification; memberName: string; status: CertStatus; daysLeft: number };

export function certificationAlerts(certifications: Certification[], members: { id: string; name: string }[], now: string): CertAlert[] {
  const names = new Map(members.map((member) => [member.id, member.name]));
  return certifications
    .filter((cert) => names.has(cert.memberId))
    .map((cert) => ({ certification: cert, memberName: names.get(cert.memberId)!, status: certStatus(cert.expiresOn, now), daysLeft: certDaysLeft(cert.expiresOn, now) }))
    .filter((alert) => alert.status !== 'valid')
    .sort((a, b) => a.daysLeft - b.daysLeft);
}
