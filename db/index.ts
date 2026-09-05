import Database from 'better-sqlite3';
import { existsSync, mkdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

type RunResult = { meta: { changes: number } };

class BoundStatement {
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

class SqliteAdapter {
  constructor(private readonly database: Database.Database) {}

  prepare(sql: string) {
    return new BoundStatement(this.database.prepare(sql));
  }

  async batch(statements: BoundStatement[]) {
    const execute = this.database.transaction(() => statements.map((statement) => statement.runSync()));
    return execute();
  }
}

let adapter: SqliteAdapter | undefined;

function runMigrations(database: Database.Database) {
  database.exec(`
    CREATE TABLE IF NOT EXISTS _careboard_migrations (
      id TEXT PRIMARY KEY NOT NULL,
      applied_at TEXT NOT NULL
    )
  `);
  const migrationIds = ['0000_narrow_madrox', '0001_role_lifecycle'];
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

export function getD1() {
  if (adapter) return adapter;
  const databasePath = process.env.DATABASE_PATH || join(process.cwd(), 'data', 'careboard.db');
  mkdirSync(dirname(databasePath), { recursive: true });
  const database = new Database(databasePath);
  database.pragma('journal_mode = WAL');
  database.pragma('foreign_keys = ON');
  database.pragma('busy_timeout = 5000');
  runMigrations(database);
  adapter = new SqliteAdapter(database);
  return adapter;
}
