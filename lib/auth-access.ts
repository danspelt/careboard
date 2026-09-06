import 'server-only';
import { accountForEmail, resolveAccountMember } from '@/lib/account-store';
import { auth } from '@/auth';
import { authenticationConfigured } from '@/lib/auth-config';
import { credentialMustChange } from '@/lib/credential-store';
import type { Role } from '@/lib/access-policy';

export type AuthenticatedAccess = { memberId: string; email: string; role: Role; credentialLogin: boolean; mustChangePassword: boolean };

export async function authenticatedAccess(): Promise<AuthenticatedAccess | null> {
  if (!authenticationConfigured()) return null;
  const session = await auth();
  const email = session?.user?.email?.trim().toLowerCase();
  const memberId = await resolveAccountMember(email);
  if (!email || !memberId) return null;
  const account = await accountForEmail(email);
  if (!account) return null;
  const role = (account.role === 'manager' ? 'manager' : 'worker') as Role;
  const credentialLogin = (session as typeof session & { loginProvider?: string }).loginProvider === 'credentials';
  return { memberId, email, role, credentialLogin, mustChangePassword: credentialLogin && await credentialMustChange(email) };
}

export async function authenticatedMemberId(): Promise<string | null> {
  return (await authenticatedAccess())?.memberId ?? null;
}
