export type DashboardShortcut = {
  id: string;
  keys: string;
  label: string;
  roles: Array<'manager' | 'worker' | 'viewer'>;
};

/** Digit shortcuts follow each role’s sidebar order. Letter shortcuts open common actions. */
export const DASHBOARD_SHORTCUTS: DashboardShortcut[] = [
  { id: 'nav-1', keys: '1', label: 'Go to first sidebar item', roles: ['manager', 'worker', 'viewer'] },
  { id: 'nav-2', keys: '2', label: 'Go to second sidebar item', roles: ['manager', 'worker', 'viewer'] },
  { id: 'nav-3', keys: '3', label: 'Go to third sidebar item', roles: ['manager', 'worker', 'viewer'] },
  { id: 'nav-4', keys: '4', label: 'Go to fourth sidebar item', roles: ['manager', 'worker', 'viewer'] },
  { id: 'nav-5', keys: '5', label: 'Go to fifth sidebar item', roles: ['manager', 'worker'] },
  { id: 'nav-6', keys: '6', label: 'Go to sixth sidebar item', roles: ['manager', 'worker'] },
  { id: 'nav-7', keys: '7', label: 'Go to seventh sidebar item', roles: ['manager', 'worker'] },
  { id: 'nav-8', keys: '8', label: 'Go to eighth sidebar item', roles: ['manager', 'worker'] },
  { id: 'nav-9', keys: '9', label: 'Go to ninth sidebar item', roles: ['manager'] },
  { id: 'notifications', keys: 'b', label: 'Open notifications', roles: ['manager', 'worker', 'viewer'] },
  { id: 'new-task', keys: 'n', label: 'Add a task', roles: ['manager'] },
  { id: 'add-worker', keys: 'w', label: 'Add a care worker', roles: ['manager'] },
  { id: 'tasks', keys: 't', label: 'Open Tasks', roles: ['manager', 'worker', 'viewer'] },
  { id: 'inbox', keys: 'i', label: 'Open Inbox', roles: ['manager', 'worker'] },
  { id: 'schedule', keys: 's', label: 'Open Schedule', roles: ['manager', 'worker', 'viewer'] },
  { id: 'profile', keys: 'p', label: 'Open Profile', roles: ['worker'] },
  { id: 'team', keys: 'm', label: 'Open Team', roles: ['manager'] },
  { id: 'home', keys: 'h', label: 'Open Overview / Today', roles: ['manager', 'worker', 'viewer'] },
  { id: 'help', keys: '?', label: 'Show keyboard shortcuts', roles: ['manager', 'worker', 'viewer'] },
  { id: 'escape', keys: 'Esc', label: 'Close dialogs or skip the welcome guide', roles: ['manager', 'worker', 'viewer'] },
];

export function shortcutsForRole(role: 'manager' | 'worker' | 'viewer') {
  return DASHBOARD_SHORTCUTS.filter((item) => item.roles.includes(role));
}

export function isEditableKeyboardTarget(target: EventTarget | null) {
  if (!target || typeof target !== 'object') return false;
  const el = target as { isContentEditable?: boolean; tagName?: string };
  if (el.isContentEditable) return true;
  const tag = el.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';
}
