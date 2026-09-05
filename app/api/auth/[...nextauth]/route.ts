import { handlers } from '@/auth';
import { authenticationConfigured } from '@/lib/auth-config';
import type { NextRequest } from 'next/server';

function unavailable() {
  return Response.json({ error: 'Google sign-in is not configured.' }, { status: 503 });
}
export async function GET(request: NextRequest) {
  return authenticationConfigured() ? handlers.GET(request) : unavailable();
}
export async function POST(request: NextRequest) {
  return authenticationConfigured() ? handlers.POST(request) : unavailable();
}
