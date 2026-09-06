import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { authenticatedAccess } from '@/lib/auth-access';
import { trustedMutationOrigin } from '@/lib/auth-config';
import { getD1 } from '@/db';
import { safeStoredName, validateUpload } from '@/lib/operations';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  const access = await authenticatedAccess();
  if (!access || access.mustChangePassword) return Response.json({ error: 'Access denied.' }, { status: 403 });
  if (!trustedMutationOrigin(request.headers.get('origin'))) return Response.json({ error: 'Invalid request origin.' }, { status: 403 });

  const form = await request.formData();
  const choreValue = form.get('choreId');
  const choreId = typeof choreValue === 'string' ? choreValue : '';
  const profileValue = form.get('profileMemberId');
  const profileMemberId = typeof profileValue === 'string' ? profileValue : '';
  const file = form.get('photo');

  if (!(file instanceof File)) return Response.json({ error: 'Choose a photo.' }, { status: 400 });
  const buffer = new Uint8Array(await file.arrayBuffer());
  const problem = validateUpload(file.type, file.size, buffer);
  if (problem) return Response.json({ error: problem }, { status: 400 });

  const db = getD1();

  if (choreId && profileMemberId) {
    return Response.json({ error: 'Upload a photo for either a task or a profile, not both.' }, { status: 400 });
  }

  if (choreId) {
    const task = await db
      .prepare(`SELECT c.id, c.assigned_to AS assignedTo, m.role FROM chores c JOIN members m ON m.id=? WHERE c.id=?`)
      .bind(access.memberId, choreId)
      .first<{ id: string; assignedTo: string | null; role: string }>();
    if (!task || (task.role !== 'manager' && task.assignedTo !== access.memberId)) {
      return Response.json({ error: 'You can only upload proof for your own task.' }, { status: 403 });
    }
  } else if (profileMemberId) {
    if (access.role !== 'manager' && access.memberId !== profileMemberId) {
      return Response.json({ error: 'You can only upload your own profile photo.' }, { status: 403 });
    }
    const member = await db.prepare(`SELECT id FROM members WHERE id=?`).bind(profileMemberId).first<{ id: string }>();
    if (!member) return Response.json({ error: 'Profile not found.' }, { status: 404 });
  } else {
    return Response.json({ error: 'Choose a task or profile for the photo.' }, { status: 400 });
  }

  const id = crypto.randomUUID();
  const storedName = safeStoredName(id, file.type);
  const root = resolve(process.env.UPLOAD_PATH || '/data/uploads');
  const destination = resolve(root, storedName);
  if (!destination.startsWith(`${root}\\`) && !destination.startsWith(`${root}/`)) {
    return Response.json({ error: 'Invalid upload path.' }, { status: 400 });
  }

  await mkdir(root, { recursive: true });
  await writeFile(destination, Buffer.from(buffer), { flag: 'wx', mode: 0o600 });

  try {
    await db
      .prepare(
        `INSERT INTO proof_photos(id, chore_id, profile_member_id, uploaded_by, stored_name, original_name, mime_type, byte_size, created_at)
        VALUES(?,?,?,?,?,?,?,?,?)`,
      )
      .bind(id, choreId || null, profileMemberId || null, access.memberId, storedName, file.name.slice(0, 255), file.type, file.size, new Date().toISOString())
      .run();

    if (profileMemberId) {
      await db.prepare(`UPDATE members SET profile_photo_id=? WHERE id=?`).bind(id, profileMemberId).run();
    }

    return Response.json({ id }, { status: 201 });
  } catch (error) {
    // Roll back the file if the database insert failed to keep DB/file consistency.
    try {
      const { unlink } = await import('node:fs/promises');
      await unlink(destination);
    } catch {
      // ignore cleanup failure
    }
    return Response.json({ error: error instanceof Error ? error.message : 'Upload could not be saved.' }, { status: 500 });
  }
}
