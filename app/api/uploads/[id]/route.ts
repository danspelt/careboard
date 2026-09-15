import { readFile, unlink } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { authenticatedAccess } from '@/lib/auth-access';
import { trustedMutationOrigin } from '@/lib/auth-config';
import { getD1 } from '@/db';
import { canViewClientNoteImage, type ClientNoteStatus } from '@/lib/client-notes';

export const runtime = 'nodejs';

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const access = await authenticatedAccess();
  if (!access || access.mustChangePassword) return new Response(null, { status: 403 });
  const { id } = await params;
  const photo = await getD1()
    .prepare(
      `SELECT p.stored_name AS storedName, p.mime_type AS mimeType, p.uploaded_by AS uploadedBy,
              p.chore_id AS choreId, p.profile_member_id AS profileMemberId, c.assigned_to AS assignedTo,
              n.submitted_by AS noteSubmittedBy, n.status AS noteStatus
        FROM proof_photos p
        LEFT JOIN chores c ON c.id=p.chore_id
        LEFT JOIN client_note_submissions n ON n.source_photo_id=p.id
        WHERE p.id=?`,
    )
    .bind(id)
    .first<{ storedName: string; mimeType: string; uploadedBy: string; choreId: string | null; profileMemberId: string | null; assignedTo: string | null; noteSubmittedBy: string | null; noteStatus: ClientNoteStatus | null }>();

  if (!photo) return new Response(null, { status: 404 });

  const isManager = access.role === 'manager';
  const isOwner = photo.uploadedBy === access.memberId;
  const isTaskOwner = photo.choreId && photo.assignedTo === access.memberId;
  const isProfileOwner = photo.profileMemberId === access.memberId;
  // Family viewers can see task photos (part of the care plan) but not profile photos.
  const isViewerTaskPhoto = access.role === 'viewer' && Boolean(photo.choreId);
  const isVisibleClientNote = photo.noteSubmittedBy && photo.noteStatus
    ? canViewClientNoteImage(access.role, access.memberId, photo.noteSubmittedBy, photo.noteStatus)
    : false;

  if (!isManager && !isOwner && !isTaskOwner && !isProfileOwner && !isViewerTaskPhoto && !isVisibleClientNote) {
    return new Response(null, { status: 404 });
  }

  const root = resolve(/* turbopackIgnore: true */ process.env.UPLOAD_PATH || '/data/uploads');
  const path = resolve(root, photo.storedName);
  if (!path.startsWith(`${root}\\`) && !path.startsWith(`${root}/`)) {
    return new Response(null, { status: 404 });
  }
  if (!/^[a-f0-9-]{36}\.(jpg|png|webp)$/i.test(photo.storedName)) {
    return new Response(null, { status: 404 });
  }

  try {
    const file = await readFile(/* turbopackIgnore: true */ path);
    return new Response(file, {
      headers: {
        'Content-Type': photo.mimeType,
        'Cache-Control': 'private, max-age=3600',
        'X-Content-Type-Options': 'nosniff',
      },
    });
  } catch {
    return new Response(null, { status: 404 });
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const access = await authenticatedAccess();
  if (!access || access.mustChangePassword) return new Response(null, { status: 403 });
  if (!trustedMutationOrigin(request.headers.get('origin'))) return new Response(null, { status: 403 });
  const { id } = await params;
  const db = getD1();
  const photo = await db
    .prepare(
      `SELECT p.stored_name AS storedName, p.uploaded_by AS uploadedBy, p.chore_id AS choreId, c.assigned_to AS assignedTo,
              n.id AS clientNoteId
        FROM proof_photos p
        LEFT JOIN chores c ON c.id=p.chore_id
        LEFT JOIN client_note_submissions n ON n.source_photo_id=p.id
        WHERE p.id=?`,
    )
    .bind(id)
    .first<{ storedName: string; uploadedBy: string; choreId: string | null; assignedTo: string | null; clientNoteId: string | null }>();

  if (!photo) return new Response(null, { status: 404 });
  if (photo.clientNoteId) return new Response(null, { status: 409 });
  const isManager = access.role === 'manager';
  const isOwner = photo.uploadedBy === access.memberId;
  const isTaskOwner = photo.choreId && photo.assignedTo === access.memberId;
  if (!isManager && !isOwner && !isTaskOwner) {
    return new Response(null, { status: 403 });
  }

  const root = resolve(/* turbopackIgnore: true */ process.env.UPLOAD_PATH || '/data/uploads');
  const path = resolve(root, photo.storedName);
  if ((path.startsWith(`${root}\\`) || path.startsWith(`${root}/`)) && existsSync(/* turbopackIgnore: true */ path)) {
    await unlink(path);
  }

  const now = new Date().toISOString();
  await db.batch([
    db.prepare(`DELETE FROM proof_photos WHERE id=?`).bind(id),
    db.prepare(`UPDATE members SET profile_photo_id=NULL WHERE profile_photo_id=?`).bind(id),
    db.prepare(`INSERT INTO activity(id,chore_id,member_id,action,detail,created_at) VALUES(?,?,?,?,?,?)`).bind(crypto.randomUUID(), photo.choreId, access.memberId, 'deleted_upload', `deleted upload ${id}`, now),
  ]);

  return new Response(null, { status: 204 });
}
