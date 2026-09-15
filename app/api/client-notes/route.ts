import { mkdir, unlink, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { authenticatedAccess } from '@/lib/auth-access';
import { trustedMutationOrigin } from '@/lib/auth-config';
import { canSubmitClientNote } from '@/lib/client-notes';
import { getD1 } from '@/db';
import { extractClientNoteText } from '@/lib/ocr';
import { safeStoredName, validateUpload } from '@/lib/operations';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  const access = await authenticatedAccess();
  if (!access || access.mustChangePassword || !canSubmitClientNote(access.role)) {
    return Response.json({ error: 'Only an active care worker can submit a client note.' }, { status: 403 });
  }
  if (!trustedMutationOrigin(request.headers.get('origin'))) {
    return Response.json({ error: 'Invalid request origin.' }, { status: 403 });
  }

  const form = await request.formData();
  const clientValue = form.get('clientMemberId');
  const clientMemberId = typeof clientValue === 'string' ? clientValue : '';
  const file = form.get('photo');
  if (!(file instanceof File)) return Response.json({ error: 'Choose a photo of the note.' }, { status: 400 });
  const bytes = new Uint8Array(await file.arrayBuffer());
  const problem = validateUpload(file.type, file.size, bytes);
  if (problem) return Response.json({ error: problem }, { status: 400 });

  const db = getD1();
  const client = await db
    .prepare(`SELECT m.id FROM members m LEFT JOIN account_lifecycle l ON l.member_id=m.id WHERE m.id=? AND m.role='manager' AND COALESCE(l.status,'active')='active'`)
    .bind(clientMemberId)
    .first<{ id: string }>();
  if (!client) return Response.json({ error: 'Choose the active client record.' }, { status: 400 });

  let ocrText: string;
  try {
    ocrText = await extractClientNoteText(Buffer.from(bytes));
  } catch {
    return Response.json({ error: 'The note could not be read. Try a clearer, well-lit photo.' }, { status: 422 });
  }
  if (!ocrText) return Response.json({ error: 'No readable text was found. Try a clearer photo.' }, { status: 422 });

  const submissionId = crypto.randomUUID();
  const photoId = crypto.randomUUID();
  const storedName = safeStoredName(photoId, file.type);
  const root = resolve(/* turbopackIgnore: true */ process.env.UPLOAD_PATH || '/data/uploads');
  const destination = resolve(root, storedName);
  if (!destination.startsWith(`${root}\\`) && !destination.startsWith(`${root}/`)) {
    return Response.json({ error: 'Invalid upload path.' }, { status: 400 });
  }
  const now = new Date().toISOString();
  await mkdir(root, { recursive: true });
  await writeFile(destination, Buffer.from(bytes), { flag: 'wx', mode: 0o600 });

  try {
    await db.batch([
      db.prepare(`INSERT INTO proof_photos(id,chore_id,profile_member_id,uploaded_by,stored_name,original_name,mime_type,byte_size,created_at) VALUES(?,NULL,NULL,?,?,?,?,?,?)`)
        .bind(photoId, access.memberId, storedName, file.name.slice(0, 255), file.type, file.size, now),
      db.prepare(`INSERT INTO client_note_submissions(id,household_id,client_member_id,submitted_by,source_photo_id,ocr_text,status,created_at) VALUES(?,'default',?,?,?,?, 'pending',?)`)
        .bind(submissionId, clientMemberId, access.memberId, photoId, ocrText, now),
      db.prepare(`INSERT INTO worker_inbox_items(id,household_id,worker_id,kind,body,submission_id,created_by,created_at) VALUES(?,'default',?,'client_note_pending',?,?,?,?)`)
        .bind(crypto.randomUUID(), access.memberId, 'Your client note is pending manager review.', submissionId, access.memberId, now),
      db.prepare(`INSERT INTO activity(id,chore_id,member_id,action,detail,created_at) VALUES(?,NULL,?,'submitted_client_note','submitted a client note for review',?)`)
        .bind(crypto.randomUUID(), access.memberId, now),
    ]);
    return Response.json({ id: submissionId, text: ocrText }, { status: 201 });
  } catch {
    try { await unlink(destination); } catch { /* best-effort rollback */ }
    return Response.json({ error: 'The note could not be saved.' }, { status: 500 });
  }
}
