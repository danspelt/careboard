'use server';

import { AuthError } from 'next-auth';
import { redirect } from 'next/navigation';
import { signIn, signOut } from '@/auth';
import { authenticatedAccess } from '@/lib/auth-access';
import { authenticationConfigured, googleAuthenticationConfigured } from '@/lib/auth-config';
import { setCredential } from '@/lib/credential-store';
import { hashPassword, passwordError } from '@/lib/auth-security';

export async function googleSignIn() {
  if (!googleAuthenticationConfigured()) redirect('/sign-in?error=Configuration');
  try { await signIn('google', { redirectTo: '/dashboard' }); }
  catch (error) { if (error instanceof AuthError) redirect('/sign-in?error=SignInFailed'); throw error; }
}

export async function passwordSignIn(form: FormData) {
  if (!authenticationConfigured()) redirect('/sign-in?error=Configuration');
  try { await signIn('credentials', { email: form.get('email'), password: form.get('password'), redirectTo: '/dashboard' }); }
  catch (error) { if (error instanceof AuthError) redirect('/sign-in?error=CredentialsSignin'); throw error; }
}

export async function changePassword(form: FormData) {
  const access = await authenticatedAccess();
  if (!access?.credentialLogin) redirect('/sign-in');
  const password = form.get('password');
  const confirmation = form.get('confirmation');
  if (passwordError(password) || password !== confirmation) redirect('/change-password?error=Password');
  await setCredential(access.email, await hashPassword(password as string), false);
  redirect('/dashboard');
}

export async function logOut() { await signOut({ redirectTo: '/' }); }
