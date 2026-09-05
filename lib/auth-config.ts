/** Server-side account mapping: Google identity never chooses its own household role. */
export function memberIdForEmail(email: string | null | undefined): string | null {
  if (!email) return null;
  try {
    const entries: unknown = JSON.parse(process.env.CAREBOARD_MEMBER_EMAILS || '{}');
    if (!entries || typeof entries !== 'object' || Array.isArray(entries)) return null;
    const normalized = email.trim().toLowerCase();
    const matches = Object.entries(entries).filter(([key]) => key.trim().toLowerCase() === normalized);
    if (matches.length !== 1) return null;
    const id: unknown = matches[0][1];
    return typeof id === 'string' && id.trim() ? id.trim() : null;
  } catch {
    return null;
  }
}

export function authenticationConfigured(): boolean {
  try {
    const url = new URL(process.env.AUTH_URL || '');
    const localHttp = url.protocol === 'http:' && ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
    return Boolean((process.env.AUTH_SECRET?.length ?? 0) >= 32 &&
      /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(ownerEmail()) &&
      (url.protocol === 'https:' || localHttp));
  } catch {
    return false;
  }
}

export function googleAuthenticationConfigured(): boolean {
  return authenticationConfigured() && Boolean(process.env.AUTH_GOOGLE_ID && process.env.AUTH_GOOGLE_SECRET);
}

export function trustedMutationOrigin(origin: string | null): boolean {
  if (!origin || !process.env.AUTH_URL) return false;
  try {
    return origin === new URL(process.env.AUTH_URL).origin;
  } catch {
    return false;
  }
}
export function ownerEmail(): string {
  return (process.env.CAREBOARD_OWNER_EMAIL || '').trim().toLowerCase();
}

export function ownerMemberId(): string {
  return process.env.CAREBOARD_OWNER_MEMBER_ID?.trim() || 'member-manager';
}

export function accountRoleAllowed(email: string, memberId: string, role: string): boolean {
  if (!ownerEmail()) return false;
  if (email.trim().toLowerCase() === ownerEmail()) return memberId === ownerMemberId() && role === 'manager';
  return memberId !== ownerMemberId() && role === 'worker';
}
