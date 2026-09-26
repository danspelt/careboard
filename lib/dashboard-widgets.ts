// Widget catalog, layout helpers, and theme presets for the customizable dashboard.
// Pure module — safe to import from server code (layout validation) and client code (grid UI).

export type DashboardRole = 'manager' | 'worker' | 'viewer';
export type WidgetSize = 'half' | 'full';
export type WidgetItem = { id: string; size: WidgetSize };
export type WidgetDef = {
  id: string;
  title: string;
  description: string;
  category: 'At a glance' | 'Care plan' | 'Tasks' | 'Team' | 'Safety' | 'Time & pay' | 'Activity';
  roles: DashboardRole[];
  defaultSize: WidgetSize;
};

export const WIDGETS: WidgetDef[] = [
  // Manager widgets
  { id: 'hero', title: 'Household at a glance', description: 'Today’s headline banner with team and task counts.', category: 'At a glance', roles: ['manager'], defaultSize: 'full' },
  { id: 'metrics', title: 'Key numbers', description: 'On duty, due today, attention items, and funded-hours usage.', category: 'At a glance', roles: ['manager'], defaultSize: 'full' },
  { id: 'decisions', title: 'Needs your decision', description: 'Requests, alerts, and reviews only a manager can resolve.', category: 'At a glance', roles: ['manager'], defaultSize: 'full' },
  { id: 'hralerts', title: 'HR alerts', description: 'Leave, documents, hire checklists, certs, and pay periods needing attention.', category: 'Team', roles: ['manager'], defaultSize: 'full' },
  { id: 'priorities', title: 'Operational priorities', description: 'Ranked task list by urgency, overdue date, and assignment.', category: 'Tasks', roles: ['manager'], defaultSize: 'half' },
  { id: 'attendance', title: 'Today’s attendance', description: 'Who is on duty, late, or covering — plus team broadcast.', category: 'Team', roles: ['manager'], defaultSize: 'half' },
  { id: 'safety', title: 'Safety reports', description: 'Triage incident and near-miss reports from the care team.', category: 'Safety', roles: ['manager'], defaultSize: 'half' },
  { id: 'workload', title: 'Workload signals', description: 'Fatigue and overload warnings across the care team.', category: 'Safety', roles: ['manager'], defaultSize: 'half' },
  { id: 'handofflog', title: 'Shift handoff log', description: 'Structured end-of-shift handoffs recorded by workers.', category: 'Team', roles: ['manager'], defaultSize: 'half' },
  { id: 'funding', title: 'CSIL funding', description: 'Monthly funded-hours usage and projection.', category: 'Time & pay', roles: ['manager'], defaultSize: 'half' },
  { id: 'review', title: 'Awaiting your review', description: 'Completed work waiting for manager approval.', category: 'Tasks', roles: ['manager'], defaultSize: 'half' },
  { id: 'certs', title: 'Certification alerts', description: 'Expired or expiring care worker certifications.', category: 'Team', roles: ['manager'], defaultSize: 'half' },
  { id: 'payroll', title: 'Payroll & bookkeeper', description: 'Download the payroll CSV or jump to HR payroll.', category: 'Time & pay', roles: ['manager'], defaultSize: 'half' },
  { id: 'hrexpanding', title: 'Open HR', description: 'Jump to the HR people, time off, documents, and payroll hub.', category: 'Team', roles: ['manager'], defaultSize: 'half' },
  { id: 'handoffs', title: 'Recent handoffs', description: 'Latest progress, completion, and issue notes.', category: 'Activity', roles: ['manager'], defaultSize: 'half' },
  { id: 'pulse', title: 'Seven-day pulse', description: 'Completed household tasks per day, with unresolved issues.', category: 'Activity', roles: ['manager'], defaultSize: 'half' },
  { id: 'photos', title: 'Proof photos', description: 'Latest task photo uploads from the care team.', category: 'Activity', roles: ['manager'], defaultSize: 'full' },
  { id: 'activity', title: 'Recent activity', description: 'Latest household actions across tasks, team, and settings.', category: 'Activity', roles: ['manager'], defaultSize: 'half' },
  { id: 'quickactions', title: 'Quick actions', description: 'Jump straight to common manager tasks.', category: 'At a glance', roles: ['manager'], defaultSize: 'half' },
  { id: 'team', title: 'Care team', description: 'Roster status at a glance — open a profile to manage.', category: 'Team', roles: ['manager'], defaultSize: 'half' },
  { id: 'inboxpreview', title: 'Latest inbox items', description: 'Newest care-team messages and note updates.', category: 'Activity', roles: ['manager'], defaultSize: 'half' },
  { id: 'schedulepreview', title: 'Next few days', description: 'Who is scheduled today, tomorrow, and the day after.', category: 'Team', roles: ['manager'], defaultSize: 'half' },

  // Worker widgets
  { id: 'hero', title: 'Your shift today', description: 'Welcome banner with today’s date and shift readiness.', category: 'At a glance', roles: ['worker'], defaultSize: 'full' },
  { id: 'announcements', title: 'Announcements', description: 'Broadcasts from the household manager.', category: 'At a glance', roles: ['worker', 'viewer'], defaultSize: 'full' },
  { id: 'coverage', title: 'Shift cover asks', description: 'Teammates looking for cover, your own asks, and one-tap yes.', category: 'Team', roles: ['worker'], defaultSize: 'full' },
  { id: 'timeclock', title: 'Time clock', description: 'Clock in and out, today’s tracked time, and your shift.', category: 'Time & pay', roles: ['worker'], defaultSize: 'full' },
  { id: 'shiftbrief', title: 'Shift briefing', description: 'Attention count and today’s completion numbers.', category: 'At a glance', roles: ['worker'], defaultSize: 'full' },
  { id: 'workload', title: 'Your workload', description: 'Warnings when your schedule or task load runs hot.', category: 'Safety', roles: ['worker'], defaultSize: 'full' },
  { id: 'priorities', title: 'Priority briefing', description: 'Urgent, overdue, and issue-flagged assignments first.', category: 'Tasks', roles: ['worker'], defaultSize: 'half' },
  { id: 'mytasks', title: 'Today’s assignments', description: 'Your open tasks due today.', category: 'Tasks', roles: ['worker'], defaultSize: 'half' },
  { id: 'notes', title: 'Handoff notes', description: 'Recent updates on your assigned work.', category: 'Activity', roles: ['worker'], defaultSize: 'half' },
  { id: 'snapshot', title: 'Shift snapshot', description: 'Completed, in progress, and still due counts.', category: 'At a glance', roles: ['worker'], defaultSize: 'half' },
  { id: 'handoffform', title: 'Record a handoff', description: 'Structured end-of-shift note for the next caregiver.', category: 'Tasks', roles: ['worker'], defaultSize: 'half' },
  { id: 'handofflog', title: 'Your handoff log', description: 'Handoffs you have recorded, visible to you and the manager.', category: 'Activity', roles: ['worker'], defaultSize: 'half' },
  { id: 'safetyform', title: 'Report a safety issue', description: 'Incident or near-miss report, shared only with the manager.', category: 'Safety', roles: ['worker'], defaultSize: 'half' },
  { id: 'safetylog', title: 'Your safety reports', description: 'Status of incidents and near-misses you reported.', category: 'Safety', roles: ['worker'], defaultSize: 'half' },
  { id: 'schedule', title: 'Your shifts', description: 'Your two-week recurring schedule and availability.', category: 'Time & pay', roles: ['worker'], defaultSize: 'half' },
  { id: 'weektime', title: 'Your hours this week', description: 'Clocked time so far this week, with today’s total.', category: 'Time & pay', roles: ['worker'], defaultSize: 'half' },
  { id: 'certs', title: 'Your certifications', description: 'Expiry status for your recorded certifications.', category: 'Safety', roles: ['worker'], defaultSize: 'half' },
  { id: 'inboxpreview', title: 'Latest inbox items', description: 'Newest direct messages and note updates for you.', category: 'Activity', roles: ['worker'], defaultSize: 'half' },
  { id: 'quicklinks', title: 'Quick links', description: 'Jump to tasks, schedule, client notes, or your profile.', category: 'At a glance', roles: ['worker'], defaultSize: 'half' },

  // Viewer widgets
  { id: 'metrics', title: 'Today’s numbers', description: 'Due today, completed today, and who is on shift.', category: 'At a glance', roles: ['viewer'], defaultSize: 'full' },
  { id: 'onshift', title: 'On shift today', description: 'Care workers scheduled for today.', category: 'Team', roles: ['viewer'], defaultSize: 'half' },
  { id: 'duetoday', title: 'Due today', description: 'Open tasks due today.', category: 'Tasks', roles: ['viewer'], defaultSize: 'half' },

  // Care plan widgets (shared across roles)
  { id: 'medsround', title: 'Medication round', description: 'Today’s scheduled doses — given, due, overdue, or refused.', category: 'Care plan', roles: ['manager', 'worker', 'viewer'], defaultSize: 'full' },
  { id: 'aboutme', title: 'About the person', description: 'One-page profile: what matters, how to support, and key contacts.', category: 'Care plan', roles: ['worker', 'viewer'], defaultSize: 'half' },
  { id: 'appointments', title: 'Upcoming appointments', description: 'Medical and personal appointments, and who is going along.', category: 'Care plan', roles: ['manager', 'worker', 'viewer'], defaultSize: 'half' },
  { id: 'supplies', title: 'Supplies list', description: 'Household items running low — add one or mark it bought.', category: 'Care plan', roles: ['manager', 'worker', 'viewer'], defaultSize: 'half' },
  { id: 'kudos', title: 'Team shout-outs', description: 'Recognize a teammate and see recent appreciation.', category: 'Team', roles: ['manager', 'worker'], defaultSize: 'half' },
];

export function widgetsForRole(role: DashboardRole): WidgetDef[] {
  return WIDGETS.filter((widget) => widget.roles.includes(role));
}

export function widgetDef(id: string): WidgetDef | undefined {
  return WIDGETS.find((widget) => widget.id === id);
}

/** Curated first-paint layouts — enough to run a shift, not every widget at once. */
const DEFAULT_LAYOUTS: Record<DashboardRole, Array<[string, WidgetSize]>> = {
  manager: [
    ['hero', 'full'],
    ['metrics', 'full'],
    ['decisions', 'full'],
    ['hralerts', 'full'],
    ['priorities', 'half'],
    ['attendance', 'half'],
    ['medsround', 'full'],
    ['appointments', 'half'],
    ['supplies', 'half'],
    ['kudos', 'half'],
    ['schedulepreview', 'half'],
    ['inboxpreview', 'half'],
    ['payroll', 'half'],
    ['quickactions', 'half'],
  ],
  worker: [
    ['hero', 'full'],
    ['announcements', 'full'],
    ['timeclock', 'full'],
    ['coverage', 'full'],
    ['shiftbrief', 'full'],
    ['priorities', 'half'],
    ['mytasks', 'half'],
    ['notes', 'half'],
    ['snapshot', 'half'],
    ['handoffform', 'half'],
    ['safetyform', 'half'],
    ['aboutme', 'half'],
    ['medsround', 'full'],
    ['appointments', 'half'],
    ['supplies', 'half'],
    ['kudos', 'half'],
    ['quicklinks', 'half'],
  ],
  viewer: [
    ['metrics', 'full'],
    ['onshift', 'half'],
    ['duetoday', 'half'],
    ['aboutme', 'half'],
    ['appointments', 'half'],
    ['supplies', 'half'],
    ['medsround', 'full'],
  ],
};

export function defaultLayout(role: DashboardRole): WidgetItem[] {
  const allowed = new Map(widgetsForRole(role).map((widget) => [widget.id, widget]));
  return DEFAULT_LAYOUTS[role]
    .map(([id, size]) => {
      const def = allowed.get(id);
      return def ? { id: def.id, size } : null;
    })
    .filter((item): item is WidgetItem => item !== null);
}

/** Validate a stored layout: drop unknown/forbidden ids, dedupe, coerce sizes. Returns the cleaned list (possibly empty — empty means "user removed everything"). */
export function normalizeLayout(role: DashboardRole, raw: unknown): WidgetItem[] {
  const allowed = new Map(widgetsForRole(role).map((widget) => [widget.id, widget]));
  const items: WidgetItem[] = [];
  if (!Array.isArray(raw)) return items;
  for (const entry of raw) {
    if (!entry || typeof entry !== 'object') continue;
    const candidate = entry as { id?: unknown; size?: unknown };
    const def = typeof candidate.id === 'string' ? allowed.get(candidate.id) : undefined;
    if (!def || items.some((item) => item.id === def.id)) continue;
    items.push({ id: def.id, size: candidate.size === 'half' || candidate.size === 'full' ? candidate.size : def.defaultSize });
  }
  return items;
}

/** Effective layout: stored layout when present (even empty), otherwise the role default. */
export function layoutFor(role: DashboardRole, stored: unknown): WidgetItem[] {
  if (stored === null || stored === undefined) return defaultLayout(role);
  return normalizeLayout(role, stored);
}

export function moveWidget(items: WidgetItem[], id: string, direction: 'up' | 'down'): WidgetItem[] {
  const index = items.findIndex((item) => item.id === id);
  const target = direction === 'up' ? index - 1 : index + 1;
  if (index < 0 || target < 0 || target >= items.length) return items;
  const next = items.slice();
  [next[index], next[target]] = [next[target], next[index]];
  return next;
}

export function setWidgetSize(items: WidgetItem[], id: string, size?: WidgetSize): WidgetItem[] {
  return items.map((item) => (item.id === id ? { ...item, size: size ?? (item.size === 'full' ? 'half' : 'full') } : item));
}

export function removeWidget(items: WidgetItem[], id: string): WidgetItem[] {
  return items.filter((item) => item.id !== id);
}

export function addWidget(items: WidgetItem[], role: DashboardRole, id: string): WidgetItem[] {
  const def = widgetsForRole(role).find((widget) => widget.id === id);
  if (!def || items.some((item) => item.id === id)) return items;
  return [...items, { id, size: def.defaultSize }];
}

// ---- Themes & appearance (color + density + corner sizing) ----

export type DashboardTheme = {
  id: string;
  name: string;
  swatch: string;
  vars: Record<string, string>;
};

export type DashboardDensity = 'compact' | 'comfortable' | 'spacious';
export type DashboardRadius = 'sharp' | 'soft' | 'round';

export type AppearancePrefs = {
  colorId: string;
  density: DashboardDensity;
  radius: DashboardRadius;
};

export const DASHBOARD_DENSITIES: Array<{ id: DashboardDensity; label: string; hint: string }> = [
  { id: 'compact', label: 'Compact', hint: 'Tighter gaps — more on screen' },
  { id: 'comfortable', label: 'Comfortable', hint: 'Balanced spacing (default)' },
  { id: 'spacious', label: 'Spacious', hint: 'Larger type and breathing room' },
];

export const DASHBOARD_RADII: Array<{ id: DashboardRadius; label: string; hint: string }> = [
  { id: 'sharp', label: 'Sharp', hint: 'Squared corners' },
  { id: 'soft', label: 'Soft', hint: 'Gentle rounding (default)' },
  { id: 'round', label: 'Round', hint: 'Pillowy cards' },
];

const SHARED_WARNINGS = { '--role-amber': '#8a6a31', '--role-amber-bg': '#faf3e5' };

const DENSITY_VARS: Record<DashboardDensity, Record<string, string>> = {
  compact: {
    '--dash-gap': '0.75rem',
    '--dash-pad': '0.9rem',
    '--dash-title': '1.125rem',
    '--dash-body': '0.875rem',
    '--dash-hero-pad': '1rem',
  },
  comfortable: {
    '--dash-gap': '1.15rem',
    '--dash-pad': '1.25rem',
    '--dash-title': '1.25rem',
    '--dash-body': '0.9375rem',
    '--dash-hero-pad': '1.35rem',
  },
  spacious: {
    '--dash-gap': '1.5rem',
    '--dash-pad': '1.6rem',
    '--dash-title': '1.5rem',
    '--dash-body': '1.0625rem',
    '--dash-hero-pad': '1.75rem',
  },
};

const RADIUS_VARS: Record<DashboardRadius, Record<string, string>> = {
  sharp: { '--dash-radius': '0.45rem', '--dash-radius-lg': '0.65rem' },
  soft: { '--dash-radius': '1rem', '--dash-radius-lg': '1.5rem' },
  round: { '--dash-radius': '1.35rem', '--dash-radius-lg': '2rem' },
};

function makeTheme(id: string, name: string, primary: string, hover: string, dark: string, light: string, soft: string, surface: string, warm: string): DashboardTheme {
  return {
    id,
    name,
    swatch: primary,
    vars: {
      '--role-primary': primary,
      '--role-primary-hover': hover,
      '--role-primary-dark': dark,
      '--role-primary-light': light,
      '--role-primary-soft': soft,
      '--role-surface': surface,
      '--role-warm': warm,
      '--role-success': primary,
      '--role-success-bg': light,
      ...SHARED_WARNINGS,
    },
  };
}

export const DASHBOARD_THEMES: DashboardTheme[] = [
  makeTheme('teal', 'CareBoard teal', '#287b6f', '#216b61', '#203f36', '#e8f1ec', '#bcd9ca', '#f7f6f1', '#f9faf4'),
  makeTheme('ocean', 'Ocean blue', '#2b6cb0', '#245a94', '#1e3a5c', '#e4eef8', '#b8d2ec', '#f4f7fb', '#f8fafc'),
  makeTheme('forest', 'Forest green', '#3f7a4e', '#336340', '#1f4028', '#e6f1e5', '#bcd8bc', '#f5f8f3', '#f9faf3'),
  makeTheme('plum', 'Plum', '#7a4e8a', '#633f70', '#3a2545', '#f1e8f5', '#d8bcd8', '#f9f5fa', '#faf6fa'),
  makeTheme('terracotta', 'Terracotta', '#b45a3c', '#97492f', '#5c2e1e', '#f8ece6', '#ecc8b8', '#faf6f3', '#faf8f5'),
  makeTheme('slate', 'Slate', '#4b6478', '#3d5365', '#28394a', '#e8eef3', '#c2d0dc', '#f5f7f9', '#f8f9fa'),
  makeTheme('rose', 'Rose', '#b04e6a', '#94405a', '#5c2438', '#f8e8ee', '#ecb8c8', '#faf5f7', '#faf8f8'),
  makeTheme('honey', 'Honey', '#9a6a24', '#7f5720', '#4a3410', '#f6efdf', '#e6d2a8', '#faf7f0', '#fbf8f2'),
];

export function themeById(id: string | null | undefined): DashboardTheme | undefined {
  return DASHBOARD_THEMES.find((theme) => theme.id === id);
}

function isDensity(value: string): value is DashboardDensity {
  return value === 'compact' || value === 'comfortable' || value === 'spacious';
}

function isRadius(value: string): value is DashboardRadius {
  return value === 'sharp' || value === 'soft' || value === 'round';
}

/** Saved theme tokens: `teal` or `teal:comfortable:soft` (color:density:radius). */
export function parseAppearance(saved: string | null | undefined): AppearancePrefs | null {
  if (!saved || typeof saved !== 'string') return null;
  const [colorRaw, densityRaw, radiusRaw] = saved.split(':');
  const color = themeById(colorRaw);
  if (!color) return null;
  return {
    colorId: color.id,
    density: densityRaw && isDensity(densityRaw) ? densityRaw : 'comfortable',
    radius: radiusRaw && isRadius(radiusRaw) ? radiusRaw : 'soft',
  };
}

export function serializeAppearance(prefs: AppearancePrefs): string {
  const color = themeById(prefs.colorId)?.id ?? 'teal';
  const density = isDensity(prefs.density) ? prefs.density : 'comfortable';
  const radius = isRadius(prefs.radius) ? prefs.radius : 'soft';
  if (density === 'comfortable' && radius === 'soft') return color;
  return `${color}:${density}:${radius}`;
}

/** True when a saveDashboard theme value is an allowed color or appearance token. */
export function isValidAppearanceToken(token: string | null | undefined): boolean {
  if (token === null || token === undefined || token === '') return true;
  return parseAppearance(token) !== null;
}

function stableThemePick(memberId: string): DashboardTheme {
  let hash = 0;
  for (const char of memberId) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return DASHBOARD_THEMES[hash % DASHBOARD_THEMES.length]!;
}

/** A member's theme: their saved choice, or a stable pseudo-random pick so every new user gets a distinct scheme. */
export function themeFor(memberId: string, saved: string | null | undefined): DashboardTheme {
  const parsed = parseAppearance(saved);
  if (parsed) return themeById(parsed.colorId) ?? stableThemePick(memberId);
  const legacy = themeById(saved);
  if (legacy) return legacy;
  return stableThemePick(memberId);
}

export function appearanceFor(memberId: string, saved: string | null | undefined): AppearancePrefs & { theme: DashboardTheme; vars: Record<string, string> } {
  const parsed = parseAppearance(saved);
  const theme = themeFor(memberId, saved);
  const density = parsed?.density ?? 'comfortable';
  const radius = parsed?.radius ?? 'soft';
  return {
    colorId: theme.id,
    density,
    radius,
    theme,
    vars: {
      ...theme.vars,
      ...DENSITY_VARS[density],
      ...RADIUS_VARS[radius],
    },
  };
}

export function randomThemeId(random: () => number = Math.random): string {
  return DASHBOARD_THEMES[Math.floor(random() * DASHBOARD_THEMES.length) % DASHBOARD_THEMES.length]!.id;
}
