import NextAuth from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import Google from 'next-auth/providers/google';
import { resolveAccountMember } from '@/lib/account-store';
import { credentialForEmail } from '@/lib/credential-store';
import { ensureHouseholdData } from '@/lib/household-data';
import { normalizeEmail, verifyPassword } from '@/lib/auth-security';

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    Google({ checks: ['pkce', 'state', 'nonce'] }),
    Credentials({
      credentials: { email: {}, password: {} },
      async authorize(credentials) {
        await ensureHouseholdData();
        const email = normalizeEmail(credentials.email);
        const password = typeof credentials.password === 'string' ? credentials.password : '';
        const credential = email ? await credentialForEmail(email) : null;
        if (!email || !credential || !await verifyPassword(password, credential.hash) || !await resolveAccountMember(email)) return null;
        return { id: email, email };
      },
    }),
  ],
  pages: { signIn: '/sign-in', error: '/sign-in' },
  session: { strategy: 'jwt', maxAge: 8 * 60 * 60 },
  callbacks: {
    async signIn({ account, profile, user }) {
      await ensureHouseholdData();
      if (account?.provider === 'google') return profile?.email_verified === true && Boolean(await resolveAccountMember(profile.email));
      return account?.provider === 'credentials' && Boolean(await resolveAccountMember(user.email));
    },
    async jwt({ token, account }) {
      if (account) token.loginProvider = account.provider;
      return token;
    },
    async session({ session, token }) {
      (session as typeof session & { loginProvider?: string }).loginProvider = typeof token.loginProvider === 'string' ? token.loginProvider : undefined;
      return session;
    },
  },
});
