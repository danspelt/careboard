import OpenAI from 'openai';
import { authenticatedAccess } from '@/lib/auth-access';
import { localDevMode, trustedMutationOrigin } from '@/lib/auth-config';
import { getHouseholdState } from '@/lib/household-data';
import { assistantContext, assistantInstructions, safeAssistantError, validateAssistantMessages } from '@/lib/assistant';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  const access = await authenticatedAccess();
  if (!access) return Response.json({ error: 'Sign in to use the CareBoard assistant.' }, { status: 401 });
  if (access.mustChangePassword) return Response.json({ error: 'Change your temporary password first.' }, { status: 403 });
  if (access.role === 'viewer') return Response.json({ error: 'The CareBoard assistant is available to managers and care workers.' }, { status: 403 });
  if (!localDevMode() && !trustedMutationOrigin(request.headers.get('origin'))) return Response.json({ error: 'Invalid request origin.' }, { status: 403 });

  try {
    const apiKey = process.env.OPENAI_API_KEY?.trim();
    if (!apiKey) throw new Error('Assistant configuration is missing.');
    const body = await request.json() as { messages?: unknown };
    const messages = validateAssistantMessages(body.messages);
    const context = assistantContext(await getHouseholdState(access.memberId));
    const client = new OpenAI({ apiKey });
    const response = await client.responses.create({
      model: process.env.OPENAI_MODEL?.trim() || 'gpt-5-mini',
      instructions: assistantInstructions(context),
      input: messages,
      max_output_tokens: 800,
      store: false,
    });
    const answer = response.output_text?.trim();
    if (!answer) throw new Error('The model returned an empty response.');
    return Response.json({ answer }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    if (error instanceof SyntaxError || (error instanceof Error && /messages|message|last/i.test(error.message))) {
      return Response.json({ error: error instanceof Error ? error.message : 'Invalid request.' }, { status: 400 });
    }
    console.error('CareBoard assistant request failed.', error instanceof Error ? error.message : error);
    const safe = safeAssistantError(error);
    return Response.json({ error: safe.message }, { status: safe.status });
  }
}
