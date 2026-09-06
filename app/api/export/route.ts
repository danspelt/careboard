import { authenticatedAccess } from '@/lib/auth-access';
import { getHouseholdState } from '@/lib/household-data';
import { toCsv } from '@/lib/operations';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const access = await authenticatedAccess();
  if (!access || access.mustChangePassword) return new Response(null, { status: 403 });
  const state = await getHouseholdState(access.memberId);
  if (state.viewer.role !== 'manager') return new Response(null, { status: 403 });

  const { searchParams } = new URL(request.url);
  const today = new Date().toISOString().slice(0, 10);
  const firstOfMonth = `${today.slice(0, 7)}-01`;
  const from = /^\d{4}-\d{2}-\d{2}$/.test(searchParams.get('from') ?? '') ? searchParams.get('from')! : firstOfMonth;
  const to = /^\d{4}-\d{2}-\d{2}$/.test(searchParams.get('to') ?? '') ? searchParams.get('to')! : today;

  const assigneeMap = new Map(state.members.map((m) => [m.id, m.name]));
  const taskRows = state.chores
    .filter((task) => {
      const date = task.dueDate || task.completedAt?.slice(0, 10) || task.createdAt.slice(0, 10);
      return date >= from && date <= to;
    })
    .map((task) => [
      task.title,
      task.area,
      task.priority,
      task.status,
      task.dueDate,
      task.dueTime,
      assigneeMap.get(task.assignedTo ?? '') || '',
      task.completedAt ? task.completedAt.slice(0, 10) : '',
      task.completedAt ? task.completedAt.slice(11, 16) : '',
      task.issueReport,
      task.issueOpen ? 'yes' : 'no',
      task.instructions,
      task.recurrence ?? '',
      task.reminderLeadDays ?? '',
      task.expectedCompletionAt ?? '',
      task.createdAt,
      assigneeMap.get(task.createdBy) ?? '',
      task.notes?.map((note) => `${note.kind}:${note.body}`).join('; ') ?? '',
      task.photos?.length ?? 0,
    ]);

  const memberRows = state.members.map((member) => [
    'MEMBER',
    member.name,
    member.role,
    member.email ?? '',
    member.phone ?? '',
    member.availability,
    member.skillsNotes,
    member.certifications,
    member.languages,
    member.emergencyContact ?? '',
    member.status,
    member.createdAt,
    member.profilePhotoId ? 'yes' : 'no',
  ]);

  const rows: unknown[][] = [
    ['Type', 'Title/Name', 'Area/Role', 'Priority/Status', 'Status', 'Due date', 'Due time', 'Assigned to/Email', 'Completed date', 'Completed time', 'Issue report', 'Issue open', 'Instructions/Phone', 'Recurrence/Availability', 'Reminder lead/Certifications', 'Expected completion/Languages', 'Created at/Emergency contact', 'Created by/Account status', 'Notes/Profile photo'],
    ...taskRows.map((row) => ['TASK', ...row]),
    ...memberRows.map((row) => row),
  ];

  return new Response(`\uFEFF${toCsv(rows)}\r\n`, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="careboard-report-${from}-to-${to}.csv"`,
      'Cache-Control': 'no-store',
    },
  });
}
