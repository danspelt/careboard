'use server';

import { redirect } from 'next/navigation';
import { acceptInvite } from '@/lib/household-data';

function text(form: FormData, key: string) {
  const value = form.get(key);
  return typeof value === 'string' ? value : '';
}

export async function acceptInviteAction(form: FormData) {
  const token = text(form, 'token');
  const password = text(form, 'password');
  const confirmation = text(form, 'confirmation');
  let failed = false;
  try {
    if (password !== confirmation) throw new Error('Passwords must match.');
    await acceptInvite(token, password);
  } catch {
    failed = true;
  }
  redirect(failed ? `/accept-invite?token=${encodeURIComponent(token)}&error=1` : '/sign-in?joined=1');
}
