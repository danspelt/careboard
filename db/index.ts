import Database from 'better-sqlite3';
import { existsSync, mkdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { Pool, type PoolClient } from 'pg';

type RunResult = { meta: { changes: number } };
type AllResult<T> = { results: T[] };

export interface DatabaseBoundStatement {
  bind(...parameters: unknown[]): DatabaseBoundStatement;
  first<T>(): Promise<T | undefined>;
  all<T>(): Promise<AllResult<T>>;
  run(): Promise<RunResult>;
  runSync(): RunResult;
}

export interface DatabaseAdapter {
  readonly dialect: 'sqlite' | 'postgres';
  prepare(sql: string): DatabaseBoundStatement;
  batch(statements: DatabaseBoundStatement[]): Promise<RunResult[]>;
}

class BoundStatement implements DatabaseBoundStatement {
  private parameters: unknown[] = [];

  constructor(private readonly statement: Database.Statement) {}

  bind(...parameters: unknown[]) {
    this.parameters = parameters;
    return this;
  }

  async first<T>() {
    return this.statement.get(...this.parameters) as T | undefined;
  }

  async all<T>() {
    return { results: this.statement.all(...this.parameters) as T[] };
  }

  async run(): Promise<RunResult> {
    return this.runSync();
  }

  runSync(): RunResult {
    const result = this.statement.run(...this.parameters);
    return { meta: { changes: result.changes } };
  }
}

class SqliteAdapter implements DatabaseAdapter {
  readonly dialect = 'sqlite' as const;

  constructor(private readonly database: Database.Database) {}

  prepare(sql: string) {
    return new BoundStatement(this.database.prepare(sql));
  }

  async batch(statements: DatabaseBoundStatement[]) {
    const execute = this.database.transaction(() => statements.map((statement) => statement.runSync()));
    return execute();
  }
}

class PgBoundStatement implements DatabaseBoundStatement {
  private parameters: unknown[] = [];
  private readonly sql: string;

  constructor(
    sql: string,
    private readonly pool: Pool,
    private readonly ready: Promise<void>,
  ) {
    let parameterIndex = 0;
    this.sql = sql
      .replace(/\bAS\s+([a-z][A-Za-z0-9]*[A-Z][A-Za-z0-9]*)\b/gi, 'AS "$1"')
      .replace(/\?/g, () => `$${++parameterIndex}`);
  }

  bind(...parameters: unknown[]) {
    this.parameters = parameters;
    return this;
  }

  async first<T>() {
    await this.ready;
    const { rows } = await this.pool.query<T & Record<string, unknown>>(this.sql, this.parameters);
    return rows[0] as T | undefined;
  }

  async all<T>() {
    await this.ready;
    const { rows } = await this.pool.query<T & Record<string, unknown>>(this.sql, this.parameters);
    return { results: rows as T[] };
  }

  async run(): Promise<RunResult> {
    await this.ready;
    const result = await this.pool.query(this.sql, this.parameters);
    return { meta: { changes: result.rowCount ?? 0 } };
  }

  runSync(): RunResult {
    throw new Error('PostgreSQL does not support synchronous queries');
  }

  async runWithClient(client: PoolClient): Promise<RunResult> {
    const result = await client.query(this.sql, this.parameters);
    return { meta: { changes: result.rowCount ?? 0 } };
  }
}

class PostgresAdapter implements DatabaseAdapter {
  readonly dialect = 'postgres' as const;

  constructor(
    private readonly pool: Pool,
    private readonly ready: Promise<void>,
  ) {}

  prepare(sql: string) {
    return new PgBoundStatement(sql, this.pool, this.ready);
  }

  async batch(statements: DatabaseBoundStatement[]) {
    await this.ready;
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const results: RunResult[] = [];
      for (const statement of statements) {
        if (!(statement instanceof PgBoundStatement)) throw new Error('PostgreSQL batch received an incompatible statement');
        results.push(await statement.runWithClient(client));
      }
      await client.query('COMMIT');
      return results;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }
}

let adapter: DatabaseAdapter | undefined;
let pgReady: Promise<void> | null = null;

function runMigrations(database: Database.Database) {
  database.exec(`
    CREATE TABLE IF NOT EXISTS _careboard_migrations (
      id TEXT PRIMARY KEY NOT NULL,
      applied_at TEXT NOT NULL
    )
  `);
  const migrationIds = ['0000_narrow_madrox', '0001_role_lifecycle', '0002_operations_pwa', '0003_enhancements', '0004_shifts', '0005_availability', '0006_review', '0007_invites', '0008_time_entries', '0009_funding', '0010_certifications', '0011_messages', '0012_client_notes', '0013_inbox_safety', '0014_inbox_direct_message', '0015_schedule_coverage', '0016_sms_consent', '0017_care_safety', '0018_employee_records', '0019_biweekly_shifts', '0020_bookkeeper_payroll', '0021_dashboard_prefs', '0022_care_plan', '0023_first_login_guide', '0024_hr_leave', '0025_hr_documents', '0026_hire_checklists', '0027_hr_payroll', '0029_hours_of_operation', '0030_csil_accountability', '0031_csil_operations'];
  for (const migrationId of migrationIds) {
    const applied = database.prepare('SELECT id FROM _careboard_migrations WHERE id = ?').get(migrationId);
    if (applied) continue;
    const migrationPath = join(process.cwd(), 'drizzle', `${migrationId}.sql`);
    if (!existsSync(migrationPath)) throw new Error(`Database migration is missing: ${migrationPath}`);
    const statements = readFileSync(migrationPath, 'utf8')
      .split('--> statement-breakpoint')
      .map((statement) => statement.trim())
      .filter(Boolean);
    const migrate = database.transaction(() => {
      for (const statement of statements) database.exec(statement);
      database.prepare('INSERT INTO _careboard_migrations (id, applied_at) VALUES (?, ?)').run(migrationId, new Date().toISOString());
    });
    migrate();
  }
  database.pragma('optimize');
}

async function runPostgresMigrations(pool: Pool) {
  await pool.query('CREATE TABLE IF NOT EXISTS _careboard_migrations (id TEXT PRIMARY KEY NOT NULL, applied_at TEXT NOT NULL)');
  const migrationId = '0000_full_schema';
  const { rows } = await pool.query('SELECT id FROM _careboard_migrations WHERE id = $1', [migrationId]);
  if (rows.length === 0) {
    const migrationPath = join(process.cwd(), 'drizzle', 'pg', `${migrationId}.sql`);
    if (!existsSync(migrationPath)) throw new Error(`PostgreSQL migration missing: ${migrationPath}`);
    const sql = readFileSync(migrationPath, 'utf8');
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      for (const statement of sql.split('--> statement-breakpoint').map((value) => value.trim()).filter(Boolean)) await client.query(statement);
      await client.query('INSERT INTO _careboard_migrations (id, applied_at) VALUES ($1, $2)', [migrationId, new Date().toISOString()]);
      await client.query('COMMIT');
    } catch (error) { await client.query('ROLLBACK'); throw error; }
    finally { client.release(); }
  }
  const upgrades = [
    { id: '0015_schedule_coverage', sql: `CREATE TABLE IF NOT EXISTS schedule_change_requests (id TEXT PRIMARY KEY NOT NULL, household_id TEXT NOT NULL DEFAULT 'default', requester_id TEXT NOT NULL REFERENCES members(id), shift_id TEXT NOT NULL REFERENCES shifts(id), requested_date TEXT NOT NULL, start_time TEXT NOT NULL, end_time TEXT NOT NULL, reason TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','covered')), accepted_by TEXT REFERENCES members(id), accepted_at TEXT, created_at TEXT NOT NULL, UNIQUE(requester_id, requested_date)); CREATE INDEX IF NOT EXISTS idx_schedule_change_requests_status_date ON schedule_change_requests(household_id, status, requested_date);` },
    { id: '0016_sms_consent', sql: 'ALTER TABLE members ADD COLUMN IF NOT EXISTS sms_opt_in INTEGER NOT NULL DEFAULT 0' },
    {
      id: '0017_care_safety',
      sql: `CREATE TABLE IF NOT EXISTS shift_handoffs (id TEXT PRIMARY KEY NOT NULL, household_id TEXT NOT NULL DEFAULT 'default', author_id TEXT NOT NULL REFERENCES members(id), shift_date TEXT NOT NULL, completed_care TEXT NOT NULL, outstanding_tasks TEXT NOT NULL, observations TEXT NOT NULL, checklist_json TEXT NOT NULL DEFAULT '[]', created_at TEXT NOT NULL); CREATE INDEX IF NOT EXISTS idx_shift_handoffs_date ON shift_handoffs(household_id, shift_date, created_at); CREATE TABLE IF NOT EXISTS safety_incidents (id TEXT PRIMARY KEY NOT NULL, household_id TEXT NOT NULL DEFAULT 'default', reporter_id TEXT NOT NULL REFERENCES members(id), category TEXT NOT NULL CHECK(category IN ('hazard','injury','violence_threat','unsafe_home','near_miss')), severity TEXT NOT NULL CHECK(severity IN ('low','medium','high','urgent')), occurred_at TEXT NOT NULL, location TEXT NOT NULL, description TEXT NOT NULL, immediate_action TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'submitted' CHECK(status IN ('submitted','reviewing','resolved')), assigned_to TEXT REFERENCES members(id), follow_up TEXT NOT NULL DEFAULT '', resolved_at TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL); CREATE INDEX IF NOT EXISTS idx_safety_incidents_triage ON safety_incidents(household_id, status, severity, created_at);`,
    },
    {
      id: '0018_employee_records',
      sql: `ALTER TABLE members ADD COLUMN IF NOT EXISTS date_of_birth TEXT; ALTER TABLE members ADD COLUMN IF NOT EXISTS address TEXT NOT NULL DEFAULT ''; ALTER TABLE members ADD COLUMN IF NOT EXISTS job_title TEXT NOT NULL DEFAULT 'Care worker'; ALTER TABLE members ADD COLUMN IF NOT EXISTS employment_started_on TEXT;`,
    },
    {
      id: '0019_biweekly_shifts',
      sql: 'ALTER TABLE shifts ADD COLUMN IF NOT EXISTS cycle_week INTEGER NOT NULL DEFAULT 0',
    },
    {
      id: '0020_bookkeeper_payroll',
      sql: `ALTER TABLE household_settings ADD COLUMN IF NOT EXISTS bookkeeper_email TEXT NOT NULL DEFAULT ''; ALTER TABLE household_settings ADD COLUMN IF NOT EXISTS payroll_last_sent TEXT NOT NULL DEFAULT '';`,
    },
    {
      id: '0021_dashboard_prefs',
      sql: `ALTER TABLE members ADD COLUMN IF NOT EXISTS theme TEXT; ALTER TABLE members ADD COLUMN IF NOT EXISTS dashboard_layout TEXT;`,
    },
    {
      id: '0022_care_plan',
      sql: readFileSync(join(process.cwd(), 'drizzle', '0022_care_plan.sql'), 'utf8').replaceAll('--> statement-breakpoint', ''),
    },
    {
      id: '0023_first_login_guide',
      sql: 'ALTER TABLE members ADD COLUMN IF NOT EXISTS guide_seen_at TEXT',
    },
    {
      id: '0024_hr_leave',
      sql: readFileSync(join(process.cwd(), 'drizzle', '0024_hr_leave.sql'), 'utf8').replaceAll('--> statement-breakpoint', '').replaceAll('ADD COLUMN ', 'ADD COLUMN IF NOT EXISTS '),
    },
    {
      id: '0025_hr_documents',
      sql: readFileSync(join(process.cwd(), 'drizzle', '0025_hr_documents.sql'), 'utf8').replaceAll('--> statement-breakpoint', ''),
    },
    {
      id: '0026_hire_checklists',
      sql: readFileSync(join(process.cwd(), 'drizzle', '0026_hire_checklists.sql'), 'utf8').replaceAll('--> statement-breakpoint', ''),
    },
    {
      id: '0027_hr_payroll',
      sql: readFileSync(join(process.cwd(), 'drizzle', '0027_hr_payroll.sql'), 'utf8').replaceAll('--> statement-breakpoint', '').replaceAll('ADD COLUMN ', 'ADD COLUMN IF NOT EXISTS '),
    },
    {
      id: '0029_hours_of_operation',
      sql: `ALTER TABLE household_settings ADD COLUMN IF NOT EXISTS operating_hours_start TEXT NOT NULL DEFAULT '08:00'; ALTER TABLE household_settings ADD COLUMN IF NOT EXISTS operating_hours_end TEXT NOT NULL DEFAULT '14:00'; ALTER TABLE household_settings ADD COLUMN IF NOT EXISTS operating_weekdays TEXT NOT NULL DEFAULT '1,2,3,4,5';`,
    },
    {
      id: '0030_csil_accountability',
      sql: readFileSync(join(process.cwd(), 'drizzle', '0030_csil_accountability.sql'), 'utf8').replaceAll('--> statement-breakpoint', '').replaceAll('ADD COLUMN ', 'ADD COLUMN IF NOT EXISTS '),
    },
    { id: '0031_csil_operations', sql: readFileSync(join(process.cwd(), 'drizzle', '0031_csil_operations.sql'), 'utf8').replaceAll('--> statement-breakpoint', '').replaceAll('ADD COLUMN ', 'ADD COLUMN IF NOT EXISTS ') },
  ];
  for (const upgrade of upgrades) {
    const applied = await pool.query('SELECT id FROM _careboard_migrations WHERE id=$1', [upgrade.id]);
    if (applied.rows.length) continue;
    const client = await pool.connect();
    try { await client.query('BEGIN'); await client.query(upgrade.sql); await client.query('INSERT INTO _careboard_migrations(id,applied_at) VALUES($1,$2)', [upgrade.id, new Date().toISOString()]); await client.query('COMMIT'); }
    catch (error) { await client.query('ROLLBACK'); throw error; }
    finally { client.release(); }
  }
}

export function getD1(): DatabaseAdapter {
  if (adapter) return adapter;
  const databaseUrl = process.env.DATABASE_URL;
  if (databaseUrl && (databaseUrl.startsWith('postgres://') || databaseUrl.startsWith('postgresql://'))) {
    const pool = new Pool({ connectionString: databaseUrl });
    pgReady = runPostgresMigrations(pool);
    adapter = new PostgresAdapter(pool, pgReady);
  } else {
    const databasePath = process.env.DATABASE_PATH || join(process.cwd(), 'data', 'careboard.db');
    mkdirSync(dirname(databasePath), { recursive: true });
    const database = new Database(databasePath);
    database.pragma('journal_mode = WAL');
    database.pragma('foreign_keys = ON');
    database.pragma('busy_timeout = 5000');
    runMigrations(database);
    adapter = new SqliteAdapter(database);
  }
  return adapter;
}
