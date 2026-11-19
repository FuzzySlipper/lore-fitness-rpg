// SQLite ledger storage (node:sqlite, no native build). The schema version is
// PRAGMA user_version; migrations run in order inside a transaction each.

import { DatabaseSync } from "node:sqlite";

export type Db = DatabaseSync;

export interface Migration {
  version: number;
  name: string;
  up: (db: Db) => void;
}

export const MIGRATIONS: Migration[] = [
  {
    version: 1,
    name: "initial ledger",
    up: (db) =>
      db.exec(`
        CREATE TABLE meta (key TEXT PRIMARY KEY, value TEXT NOT NULL);
        CREATE TABLE settings (key TEXT PRIMARY KEY, value TEXT NOT NULL, updated_at TEXT NOT NULL);

        -- One row per source record. Revisions replace the row; every accepted
        -- revision is kept in activity_revisions.
        CREATE TABLE activities (
          id TEXT PRIMARY KEY,
          source TEXT NOT NULL,
          source_record_id TEXT NOT NULL,
          revision INTEGER NOT NULL,
          client_id TEXT,
          kind TEXT NOT NULL,
          explicit_category TEXT,
          category TEXT,
          start_at TEXT NOT NULL,
          end_at TEXT,
          time_zone TEXT NOT NULL,
          local_date TEXT NOT NULL,
          quantities TEXT NOT NULL,
          note TEXT,
          source_deleted INTEGER NOT NULL DEFAULT 0,
          user_deleted INTEGER NOT NULL DEFAULT 0,
          content_hash TEXT NOT NULL,
          received_at TEXT NOT NULL,
          updated_at TEXT NOT NULL,
          UNIQUE (source, source_record_id)
        );
        CREATE INDEX activities_by_day ON activities (local_date, category);

        CREATE TABLE activity_revisions (
          activity_id TEXT NOT NULL REFERENCES activities (id),
          revision INTEGER NOT NULL,
          payload TEXT NOT NULL,
          reason TEXT NOT NULL,
          recorded_at TEXT NOT NULL
        );
        CREATE INDEX activity_revisions_by_activity ON activity_revisions (activity_id);

        CREATE TABLE check_ins (
          id TEXT PRIMARY KEY,
          local_date TEXT NOT NULL,
          category TEXT NOT NULL,
          rule_version INTEGER NOT NULL,
          status TEXT NOT NULL CHECK (status IN ('active', 'withdrawn')),
          created_at TEXT NOT NULL,
          withdrawn_at TEXT,
          withdrawn_reason TEXT
        );
        CREATE UNIQUE INDEX one_active_check_in ON check_ins (local_date, category) WHERE status = 'active';

        -- Every XP or resource change is a grant row; balances are sums.
        CREATE TABLE grants (
          id TEXT PRIMARY KEY,
          kind TEXT NOT NULL CHECK (kind IN ('check-in', 'bonus', 'reversal')),
          check_in_id TEXT REFERENCES check_ins (id),
          rule_version INTEGER NOT NULL,
          xp INTEGER NOT NULL,
          resource TEXT,
          amount INTEGER NOT NULL,
          reverses_grant_id TEXT REFERENCES grants (id),
          explanation TEXT NOT NULL,
          created_at TEXT NOT NULL
        );
        CREATE INDEX grants_by_check_in ON grants (check_in_id);

        CREATE TABLE bonus_rolls (
          id TEXT PRIMARY KEY,
          check_in_id TEXT NOT NULL REFERENCES check_ins (id),
          notation TEXT NOT NULL,
          status TEXT NOT NULL CHECK (status IN ('pending', 'resolved', 'cancelled')),
          result INTEGER,
          resolved_by TEXT,
          detail TEXT,
          created_at TEXT NOT NULL,
          resolved_at TEXT
        );

        CREATE TABLE spends (
          id TEXT PRIMARY KEY,
          idempotency_key TEXT NOT NULL UNIQUE,
          resource TEXT NOT NULL,
          amount INTEGER NOT NULL,
          purpose TEXT NOT NULL,
          chat_id TEXT,
          detail TEXT,
          created_at TEXT NOT NULL
        );

        CREATE TABLE projection_receipts (
          chat_id TEXT NOT NULL,
          grant_id TEXT NOT NULL REFERENCES grants (id),
          note TEXT,
          applied_at TEXT NOT NULL,
          PRIMARY KEY (chat_id, grant_id)
        );

        -- Append-only, player-readable history of what happened and why.
        CREATE TABLE journal (
          seq INTEGER PRIMARY KEY AUTOINCREMENT,
          at TEXT NOT NULL,
          local_date TEXT,
          kind TEXT NOT NULL,
          activity_id TEXT,
          check_in_id TEXT,
          grant_id TEXT,
          message TEXT NOT NULL,
          data TEXT
        );
        CREATE INDEX journal_by_day ON journal (local_date);
      `),
  },
  {
    version: 2,
    name: "per-client sync status",
    up: (db) =>
      db.exec(`
        CREATE TABLE client_sync (
          client_id TEXT PRIMARY KEY,
          last_seen_at TEXT NOT NULL,
          last_batch_size INTEGER NOT NULL DEFAULT 0,
          accepted_total INTEGER NOT NULL DEFAULT 0
        );
        INSERT INTO client_sync (client_id, last_seen_at, last_batch_size, accepted_total)
          SELECT client_id, MAX(received_at), 0, COUNT(*) FROM activities
          WHERE client_id IS NOT NULL GROUP BY client_id;
      `),
  },
];

export const LATEST_SCHEMA_VERSION = MIGRATIONS[MIGRATIONS.length - 1].version;

export function schemaVersion(db: Db): number {
  return (db.prepare("PRAGMA user_version").get() as { user_version: number }).user_version;
}

export function migrate(db: Db, targetVersion = LATEST_SCHEMA_VERSION): number[] {
  const applied: number[] = [];
  for (const migration of MIGRATIONS) {
    if (migration.version <= schemaVersion(db) || migration.version > targetVersion) continue;
    transaction(db, () => {
      migration.up(db);
      db.exec(`PRAGMA user_version = ${migration.version}`);
    });
    applied.push(migration.version);
  }
  return applied;
}

export function openLedgerDb(path: string, options: { targetVersion?: number } = {}): Db {
  const db = new DatabaseSync(path);
  db.exec("PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 5000;");
  const current = schemaVersion(db);
  if (current > LATEST_SCHEMA_VERSION) {
    db.close();
    // Running older code against a newer ledger could misread or overwrite its data.
    throw new Error(`ledger schema ${current} is newer than this service (${LATEST_SCHEMA_VERSION}); update the service`);
  }
  migrate(db, options.targetVersion);
  return db;
}

export function transaction<T>(db: Db, work: () => T): T {
  db.exec("BEGIN IMMEDIATE");
  try {
    const result = work();
    db.exec("COMMIT");
    return result;
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
}

/** A consistent copy of the ledger, safe while the service is running. */
export function backupTo(db: Db, destination: string): void {
  db.prepare("VACUUM INTO ?").run(destination);
}
