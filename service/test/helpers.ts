import { openLedgerDb } from "../src/db.ts";
import { Ledger } from "../src/ledger.ts";
import type { LedgerOptions } from "../src/ledger.ts";

export const TZ = "America/Chicago";

export function makeLedger(options: LedgerOptions & { path?: string } = {}) {
  const clock = { now: new Date("2026-11-16T18:00:00Z") };
  const db = openLedgerDb(options.path ?? ":memory:");
  const ledger = new Ledger(db, { defaultTimeZone: TZ, clock: () => clock.now, ...options });
  return { ledger, db, clock };
}

let counter = 0;
export function walk(overrides: Record<string, unknown> = {}) {
  counter += 1;
  return {
    source: "ohealth",
    sourceRecordId: `walk-${counter}`,
    kind: "walk",
    start: "2026-11-16T14:00:00Z",
    end: "2026-11-16T14:30:00Z",
    timeZone: TZ,
    ...overrides,
  };
}

export function manual(category: string, overrides: Record<string, unknown> = {}) {
  counter += 1;
  return { source: "manual", sourceRecordId: `manual-${counter}`, kind: "manual", category, start: "2026-11-16", timeZone: TZ, ...overrides };
}

export function grants(ledger: Ledger) {
  return ledger.db.prepare("SELECT kind, xp, resource, amount, rule_version AS ruleVersion FROM grants ORDER BY rowid").all().map((row) => ({ ...row }));
}

export function activeCheckIns(ledger: Ledger) {
  return ledger.db
    .prepare("SELECT local_date AS localDate, category FROM check_ins WHERE status = 'active' ORDER BY local_date, category")
    .all()
    .map((row) => ({ ...row })) as Array<{ localDate: string; category: string }>;
}
