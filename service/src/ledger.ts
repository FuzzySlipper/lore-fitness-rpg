// The fitness ledger: activity ingestion, daily check-ins, grants, corrections,
// resources, rerolls, bonus-roll receipts and campaign projection.
//
// Invariants:
//  - Each (source, sourceRecordId) is one activity; resends of a revision are
//    acknowledged, older revisions are ignored, newer ones replace it.
//  - At most one active check-in per local day and category.
//  - XP and resource balances are sums of grant rows (minus spends). Withdrawing
//    a check-in adds reversal grants; nothing is deleted.
//  - Level never goes down (the highest level reached is kept).
//  - Every accepted change writes a journal entry explaining its effect.

import { createHash, randomUUID } from "node:crypto";
import type { Db } from "./db.ts";
import { transaction } from "./db.ts";
import { hostTimeZone, isLocalDate, isValidTimeZone, localDateOf, zonedTimeToInstant } from "./dates.ts";
import {
  aggregateOf,
  CATEGORIES,
  CATEGORY_LABELS,
  CURRENT_RULES,
  RESOURCES,
  evaluateCategory,
  isCategory,
  isResource,
  levelForXp,
  resolveCategory,
  xpForLevel,
} from "./rules.ts";
import type { Category, DayActivity, ResourceName, RuleSet, Settings } from "./rules.ts";

export class LedgerError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export interface LedgerOptions {
  rules?: RuleSet;
  clock?: () => Date;
  defaultTimeZone?: string;
}

export interface ActivityInput {
  source: string;
  sourceRecordId: string;
  revision?: number;
  clientId?: string;
  kind: string;
  category?: string;
  start: string;
  end?: string;
  timeZone?: string;
  quantities?: Record<string, unknown>;
  note?: string;
  deleted?: boolean;
}

export type IngestStatus = "created" | "updated" | "duplicate" | "stale" | "rejected";

export interface IngestResult {
  source: unknown;
  sourceRecordId: unknown;
  status: IngestStatus;
  activityId?: string;
  revision?: number;
  localDate?: string;
  category?: Category | null;
  reason?: string;
  warnings: string[];
  effects: string[];
}

interface NormalizedActivity {
  source: string;
  sourceRecordId: string;
  revision: number;
  clientId: string | null;
  kind: string;
  explicitCategory: Category | null;
  startAt: string;
  endAt: string | null;
  timeZone: string;
  localDate: string;
  quantities: Record<string, number | boolean | string>;
  note: string | null;
  deleted: boolean;
}

interface ActivityRow {
  id: string;
  source: string;
  sourceRecordId: string;
  revision: number;
  clientId: string | null;
  kind: string;
  explicitCategory: string | null;
  category: string | null;
  startAt: string;
  endAt: string | null;
  timeZone: string;
  localDate: string;
  quantities: string;
  note: string | null;
  sourceDeleted: number;
  userDeleted: number;
  contentHash: string;
  receivedAt: string;
  updatedAt: string;
}

interface CheckInRow {
  id: string;
  localDate: string;
  category: Category;
  ruleVersion: number;
  status: "active" | "withdrawn";
  createdAt: string;
  withdrawnAt: string | null;
  withdrawnReason: string | null;
}

interface GrantRow {
  id: string;
  kind: "check-in" | "bonus" | "reversal";
  checkInId: string | null;
  ruleVersion: number;
  xp: number;
  resource: ResourceName | null;
  amount: number;
  reversesGrantId: string | null;
  explanation: string;
  createdAt: string;
}

interface BonusRollRow {
  id: string;
  checkInId: string;
  notation: string;
  status: "pending" | "resolved" | "cancelled";
  result: number | null;
  resolvedBy: string | null;
  detail: string | null;
  createdAt: string;
  resolvedAt: string | null;
}

export interface JournalEntry {
  seq: number;
  at: string;
  localDate: string | null;
  kind: string;
  activityId: string | null;
  checkInId: string | null;
  grantId: string | null;
  message: string;
  data: unknown;
}

const ACTIVITY_COLUMNS = `id, source, source_record_id AS sourceRecordId, revision, client_id AS clientId, kind,
  explicit_category AS explicitCategory, category, start_at AS startAt, end_at AS endAt, time_zone AS timeZone,
  local_date AS localDate, quantities, note, source_deleted AS sourceDeleted, user_deleted AS userDeleted,
  content_hash AS contentHash, received_at AS receivedAt, updated_at AS updatedAt`;
const CHECK_IN_COLUMNS = `id, local_date AS localDate, category, rule_version AS ruleVersion, status,
  created_at AS createdAt, withdrawn_at AS withdrawnAt, withdrawn_reason AS withdrawnReason`;
const GRANT_COLUMNS = `id, kind, check_in_id AS checkInId, rule_version AS ruleVersion, xp, resource, amount,
  reverses_grant_id AS reversesGrantId, explanation, created_at AS createdAt`;
const ROLL_COLUMNS = `id, check_in_id AS checkInId, notation, status, result, resolved_by AS resolvedBy, detail,
  created_at AS createdAt, resolved_at AS resolvedAt`;

const DEFAULT_SETTINGS: Omit<Settings, "timeZone"> = {
  stepGoal: 6000,
  hydrationGoalMl: 2000,
  mealHabit: "A meal that follows the habit you chose",
};

const KNOWN_QUANTITIES = new Set(["steps", "durationMin", "amountMl", "distanceM", "energyKcal", "goalMet"]);

const id = (prefix: string) => `${prefix}_${randomUUID().replace(/-/g, "").slice(0, 20)}`;
const plural = (count: number, word: string) => `${count} ${word}${Math.abs(count) === 1 ? "" : "s"}`;

function hashContent(value: unknown): string {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex").slice(0, 32);
}

function describeActivity(a: { kind: string; source: string; quantities: Record<string, unknown> }): string {
  const bits: string[] = [];
  if (typeof a.quantities.durationMin === "number") bits.push(`${Math.round(a.quantities.durationMin)} min`);
  if (typeof a.quantities.steps === "number") bits.push(`${a.quantities.steps.toLocaleString("en-US")} steps`);
  if (typeof a.quantities.amountMl === "number") bits.push(`${a.quantities.amountMl} ml`);
  return `${a.kind}${bits.length ? ` ${bits.join(", ")}` : ""} (${a.source})`;
}

export class Ledger {
  readonly db: Db;
  readonly rules: RuleSet;
  readonly clock: () => Date;
  readonly defaultTimeZone: string;

  constructor(db: Db, options: LedgerOptions = {}) {
    this.db = db;
    this.rules = options.rules ?? CURRENT_RULES;
    this.clock = options.clock ?? (() => new Date());
    this.defaultTimeZone = options.defaultTimeZone ?? hostTimeZone();
  }

  private now(): string {
    return this.clock().toISOString();
  }

  // ---------------------------------------------------------------- settings

  settings(): Settings {
    const rows = this.db.prepare("SELECT key, value FROM settings").all() as Array<{ key: string; value: string }>;
    const stored = Object.fromEntries(rows.map((row) => [row.key, JSON.parse(row.value)]));
    return { ...DEFAULT_SETTINGS, timeZone: this.defaultTimeZone, ...stored } as Settings;
  }

  updateSettings(changes: Record<string, unknown>): Settings {
    const accepted: Partial<Settings> = {};
    if (changes.stepGoal !== undefined) {
      if (!Number.isInteger(changes.stepGoal) || (changes.stepGoal as number) < 1 || (changes.stepGoal as number) > 100000)
        throw new LedgerError(400, "stepGoal must be a whole number from 1 to 100000");
      accepted.stepGoal = changes.stepGoal as number;
    }
    if (changes.hydrationGoalMl !== undefined) {
      if (!Number.isInteger(changes.hydrationGoalMl) || (changes.hydrationGoalMl as number) < 1 || (changes.hydrationGoalMl as number) > 10000)
        throw new LedgerError(400, "hydrationGoalMl must be a whole number from 1 to 10000");
      accepted.hydrationGoalMl = changes.hydrationGoalMl as number;
    }
    if (changes.mealHabit !== undefined) {
      if (typeof changes.mealHabit !== "string" || !changes.mealHabit.trim() || changes.mealHabit.length > 200)
        throw new LedgerError(400, "mealHabit must be text of at most 200 characters");
      accepted.mealHabit = changes.mealHabit.trim();
    }
    if (changes.timeZone !== undefined) {
      if (!isValidTimeZone(changes.timeZone)) throw new LedgerError(400, "timeZone must be an IANA time zone");
      accepted.timeZone = changes.timeZone;
    }
    const at = this.now();
    transaction(this.db, () => {
      const upsert = this.db.prepare(
        "INSERT INTO settings (key, value, updated_at) VALUES (?, ?, ?) ON CONFLICT (key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at",
      );
      for (const [key, value] of Object.entries(accepted)) upsert.run(key, JSON.stringify(value), at);
      if (Object.keys(accepted).length) {
        // Goals apply to days evaluated from now on; earned check-ins are never revoked by a goal change.
        this.journal("settings", `Settings changed: ${Object.keys(accepted).join(", ")}. Earlier check-ins are unaffected.`, {
          data: accepted,
        });
      }
    });
    return this.settings();
  }

  // --------------------------------------------------------------- ingestion

  /** Accept a batch of activity records. Each record commits on its own before the result is returned. */
  ingest(records: unknown[], options: { clientId?: string } = {}): IngestResult[] {
    const results = records.map((raw) => this.ingestOne(raw, options.clientId));
    const clientId = options.clientId ?? (records.find((r) => typeof (r as ActivityInput)?.clientId === "string") as ActivityInput | undefined)?.clientId;
    if (clientId) {
      const accepted = results.filter((r) => r.status === "created" || r.status === "updated").length;
      this.db
        .prepare(
          `INSERT INTO client_sync (client_id, last_seen_at, last_batch_size, accepted_total) VALUES (?, ?, ?, ?)
           ON CONFLICT (client_id) DO UPDATE SET last_seen_at = excluded.last_seen_at,
             last_batch_size = excluded.last_batch_size, accepted_total = accepted_total + excluded.accepted_total`,
        )
        .run(clientId, this.now(), records.length, accepted);
    }
    return results;
  }

  private ingestOne(raw: unknown, batchClientId?: string): IngestResult {
    const input = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
    const base: IngestResult = {
      source: input.source,
      sourceRecordId: input.sourceRecordId,
      status: "rejected",
      warnings: [],
      effects: [],
    };
    const normalized = this.normalize(input, batchClientId, base.warnings);
    if (typeof normalized === "string") return { ...base, reason: normalized };

    return transaction(this.db, () => {
      const existing = this.db
        .prepare(`SELECT ${ACTIVITY_COLUMNS} FROM activities WHERE source = ? AND source_record_id = ?`)
        .get(normalized.source, normalized.sourceRecordId) as ActivityRow | undefined;
      const contentHash = hashContent({ ...normalized, clientId: undefined });
      if (!existing) {
        const activityId = id("act");
        const category = resolveCategory(this.rules, normalized.kind, normalized.explicitCategory);
        this.insertActivity(activityId, normalized, category, contentHash);
        this.recordRevision(activityId, normalized, normalized.deleted ? "source deletion" : "received");
        const effects = this.afterChange(activityId, normalized, category, null, normalized.deleted ? "deleted at source" : "received");
        return { ...base, status: "created", activityId, revision: normalized.revision, localDate: normalized.localDate, category, effects };
      }
      const summary = { activityId: existing.id, revision: existing.revision, localDate: existing.localDate, category: existing.category as Category | null };
      if (normalized.revision < existing.revision) {
        return { ...base, ...summary, status: "stale", reason: `revision ${normalized.revision} is older than stored revision ${existing.revision}` };
      }
      if (normalized.revision === existing.revision) {
        if (contentHash !== existing.contentHash)
          base.warnings.push("same revision with different content; the stored copy was kept (send a higher revision to change it)");
        return { ...base, ...summary, status: "duplicate" };
      }
      const effects = this.applyRevision(existing, normalized, contentHash, normalized.deleted ? "deleted at source" : "updated at source");
      return {
        ...base,
        status: "updated",
        activityId: existing.id,
        revision: normalized.revision,
        localDate: normalized.localDate,
        category: resolveCategory(this.rules, normalized.kind, normalized.explicitCategory),
        effects,
      };
    });
  }

  private normalize(input: Record<string, unknown>, batchClientId: string | undefined, warnings: string[]): NormalizedActivity | string {
    const text = (value: unknown, max: number) => typeof value === "string" && value.trim().length > 0 && value.length <= max;
    if (!text(input.source, 64)) return "source is required (text, at most 64 characters)";
    if (!text(input.sourceRecordId, 200)) return "sourceRecordId is required (text, at most 200 characters)";
    if (!text(input.kind, 64)) return "kind is required (text, at most 64 characters)";
    const revision = input.revision === undefined ? 1 : input.revision;
    if (!Number.isSafeInteger(revision) || (revision as number) < 0) return "revision must be a non-negative whole number";
    let explicitCategory: Category | null = null;
    if (input.category !== undefined && input.category !== null) {
      if (!isCategory(input.category)) return `category must be one of ${CATEGORIES.join(", ")}`;
      explicitCategory = input.category;
    }
    const timeZone = input.timeZone ?? this.settings().timeZone;
    if (!isValidTimeZone(timeZone)) return "timeZone must be an IANA time zone such as Europe/London";

    let startAt: string;
    let localDate: string;
    if (isLocalDate(input.start)) {
      // A day-level entry (manual backdating): it belongs to that local date.
      localDate = input.start;
      startAt = zonedTimeToInstant(localDate, "12:00", timeZone).toISOString();
    } else {
      const start = typeof input.start === "string" ? new Date(input.start) : new Date(Number.NaN);
      if (Number.isNaN(start.getTime())) return "start must be an ISO 8601 time or a YYYY-MM-DD date";
      startAt = start.toISOString();
      localDate = localDateOf(start, timeZone);
    }
    let endAt: string | null = null;
    if (input.end !== undefined && input.end !== null) {
      const end = typeof input.end === "string" ? new Date(input.end) : new Date(Number.NaN);
      if (Number.isNaN(end.getTime()) || end.getTime() < new Date(startAt).getTime()) warnings.push("end was invalid or before start and was ignored");
      else endAt = end.toISOString();
    }

    const quantities: Record<string, number | boolean | string> = {};
    if (input.quantities !== undefined && (typeof input.quantities !== "object" || input.quantities === null || Array.isArray(input.quantities)))
      warnings.push("quantities must be an object and was ignored");
    else
      for (const [key, value] of Object.entries((input.quantities ?? {}) as Record<string, unknown>)) {
        if (typeof value === "number" && Number.isFinite(value) && value >= 0) quantities[key] = value;
        else if (typeof value === "boolean") quantities[key] = value;
        else if (typeof value === "string" && value.length <= 200 && !KNOWN_QUANTITIES.has(key)) quantities[key] = value;
        else warnings.push(`quantity ${key} was not a usable value and was ignored`);
      }
    const kindName = (input.kind as string).trim().toLowerCase();
    // Daily totals (steps, water) span the whole day; a duration would be meaningless.
    if (quantities.durationMin === undefined && endAt && !aggregateOf(this.rules, kindName, explicitCategory))
      quantities.durationMin = Math.round((new Date(endAt).getTime() - new Date(startAt).getTime()) / 60000);

    if (input.note !== undefined && input.note !== null && typeof input.note !== "string") warnings.push("note must be text and was ignored");
    const note = typeof input.note === "string" ? input.note.slice(0, 500) : null;
    const clientId = typeof input.clientId === "string" ? input.clientId.slice(0, 64) : (batchClientId ?? null);
    const kind = kindName;
    if (!this.rules.kinds[kind] && !explicitCategory)
      warnings.push(`kind "${kind}" has no category; it is kept in the journal but earns nothing until a category is set`);

    return {
      source: (input.source as string).trim(),
      sourceRecordId: (input.sourceRecordId as string).trim(),
      revision: revision as number,
      clientId,
      kind,
      explicitCategory,
      startAt,
      endAt,
      timeZone,
      localDate,
      quantities,
      note,
      deleted: input.deleted === true,
    };
  }

  private insertActivity(activityId: string, a: NormalizedActivity, category: Category | null, contentHash: string): void {
    const at = this.now();
    this.db
      .prepare(
        `INSERT INTO activities (id, source, source_record_id, revision, client_id, kind, explicit_category, category,
           start_at, end_at, time_zone, local_date, quantities, note, source_deleted, user_deleted, content_hash, received_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?)`,
      )
      .run(
        activityId,
        a.source,
        a.sourceRecordId,
        a.revision,
        a.clientId,
        a.kind,
        a.explicitCategory,
        category,
        a.startAt,
        a.endAt,
        a.timeZone,
        a.localDate,
        JSON.stringify(a.quantities),
        a.note,
        a.deleted ? 1 : 0,
        contentHash,
        at,
        at,
      );
  }

  private recordRevision(activityId: string, a: NormalizedActivity, reason: string): void {
    this.db
      .prepare("INSERT INTO activity_revisions (activity_id, revision, payload, reason, recorded_at) VALUES (?, ?, ?, ?, ?)")
      .run(activityId, a.revision, JSON.stringify(a), reason, this.now());
  }

  private applyRevision(existing: ActivityRow, a: NormalizedActivity, contentHash: string, reason: string): string[] {
    const category = resolveCategory(this.rules, a.kind, a.explicitCategory);
    this.db
      .prepare(
        `UPDATE activities SET revision = ?, client_id = COALESCE(?, client_id), kind = ?, explicit_category = ?, category = ?,
           start_at = ?, end_at = ?, time_zone = ?, local_date = ?, quantities = ?, note = ?, source_deleted = ?,
           content_hash = ?, updated_at = ? WHERE id = ?`,
      )
      .run(
        a.revision,
        a.clientId,
        a.kind,
        a.explicitCategory,
        category,
        a.startAt,
        a.endAt,
        a.timeZone,
        a.localDate,
        JSON.stringify(a.quantities),
        a.note,
        a.deleted ? 1 : 0,
        contentHash,
        this.now(),
        existing.id,
      );
    this.recordRevision(existing.id, a, reason);
    const previous = { localDate: existing.localDate, category: existing.category as Category | null };
    return this.afterChange(existing.id, a, category, previous, reason);
  }

  /** Journal the activity change and re-evaluate every (day, category) it touched. */
  private afterChange(
    activityId: string,
    a: { kind: string; source: string; quantities: Record<string, unknown>; localDate: string },
    category: Category | null,
    previous: { localDate: string; category: Category | null } | null,
    reason: string,
  ): string[] {
    const row = this.activityRow(activityId);
    const live = row.sourceDeleted === 0 && row.userDeleted === 0;
    const description = describeActivity(a);
    const headline =
      reason === "received"
        ? `Logged ${description} for ${a.localDate}.`
        : `${description[0].toUpperCase()}${description.slice(1)} for ${a.localDate} ${reason}${live ? "" : " (not counted)"}.`;
    const effects = [headline];
    this.journal("activity", headline, { localDate: a.localDate, activityId });
    if (!category && live) {
      const note = `It has no category, so it earns nothing until one is set.`;
      effects.push(note);
    }
    const touched = new Map<string, { localDate: string; category: Category }>();
    if (previous?.category) touched.set(`${previous.localDate}|${previous.category}`, { localDate: previous.localDate, category: previous.category });
    if (category) touched.set(`${a.localDate}|${category}`, { localDate: a.localDate, category });
    for (const day of touched.values()) effects.push(...this.reevaluate(day.localDate, day.category, activityId, reason));
    return effects;
  }

  // ---------------------------------------------------------------- check-ins

  private dayActivities(localDate: string, category: Category): DayActivity[] {
    const rows = this.db
      .prepare(
        `SELECT ${ACTIVITY_COLUMNS} FROM activities WHERE local_date = ? AND category = ? AND source_deleted = 0 AND user_deleted = 0
         ORDER BY received_at, rowid`,
      )
      .all(localDate, category) as unknown as ActivityRow[];
    return rows.map((row) => ({
      id: row.id,
      source: row.source,
      kind: row.kind,
      explicitCategory: row.explicitCategory as Category | null,
      quantities: JSON.parse(row.quantities),
    }));
  }

  private activeCheckIn(localDate: string, category: Category): CheckInRow | undefined {
    return this.db
      .prepare(`SELECT ${CHECK_IN_COLUMNS} FROM check_ins WHERE local_date = ? AND category = ? AND status = 'active'`)
      .get(localDate, category) as CheckInRow | undefined;
  }

  private reevaluate(localDate: string, category: Category, causeActivityId: string, reason: string): string[] {
    const evaluation = evaluateCategory(this.rules, this.settings(), category, this.dayActivities(localDate, category));
    const active = this.activeCheckIn(localDate, category);
    const label = CATEGORY_LABELS[category];
    if (evaluation.qualifies && !active) return [this.createCheckIn(localDate, category, causeActivityId, evaluation.detail)];
    if (!evaluation.qualifies && active)
      return [this.withdrawCheckIn(active, `its evidence changed (${reason}; now ${evaluation.detail})`, causeActivityId)];
    if (evaluation.qualifies && active && evaluation.supporting.includes(causeActivityId) && reason === "received") {
      const message = `This also supports the ${label} check-in for ${localDate}; one check-in per category per day, so no additional reward.`;
      this.journal("check-in", message, { localDate, activityId: causeActivityId, checkInId: active.id });
      return [message];
    }
    if (!evaluation.qualifies) {
      const message = `${label} for ${localDate} not earned yet (${evaluation.detail}).`;
      return [message];
    }
    return [];
  }

  private createCheckIn(localDate: string, category: Category, causeActivityId: string, detail: string): string {
    const at = this.now();
    const checkInId = id("ci");
    this.db
      .prepare("INSERT INTO check_ins (id, local_date, category, rule_version, status, created_at) VALUES (?, ?, ?, ?, 'active', ?)")
      .run(checkInId, localDate, category, this.rules.version, at);

    const xpToday = (
      this.db
        .prepare(
          `SELECT COALESCE(SUM(g.xp), 0) AS xp FROM grants g JOIN check_ins c ON c.id = g.check_in_id
           WHERE c.local_date = ? AND c.status = 'active' AND g.kind = 'check-in'`,
        )
        .get(localDate) as { xp: number }
    ).xp;
    const xp = Math.min(this.rules.baseXp, Math.max(0, this.rules.dailyXpCap - xpToday));
    const resource = this.rules.categoryResource[category];
    const balance = this.balance(resource);
    const cap = this.rules.resourceSoftCap[resource];
    const amount = balance >= cap ? 0 : 1;

    const parts = [`+${xp} XP${xp < this.rules.baseXp ? " (daily XP cap reached)" : ""}`];
    parts.push(amount ? `+1 ${resource}` : `no ${resource} (already holding ${balance}; spend some to earn more)`);
    const label = CATEGORY_LABELS[category];
    const explanation = `${label} check-in for ${localDate} (${detail}): ${parts.join(", ")}.`;
    const grantId = this.insertGrant({ kind: "check-in", checkInId, xp, resource, amount, explanation });

    const rollId = id("roll");
    this.db
      .prepare("INSERT INTO bonus_rolls (id, check_in_id, notation, status, created_at) VALUES (?, ?, ?, 'pending', ?)")
      .run(rollId, checkInId, this.rules.bonusRoll.notation, at);
    const message = `${explanation} Bonus roll ${this.rules.bonusRoll.notation} pending.`;
    this.journal("check-in", message, { localDate, activityId: causeActivityId, checkInId, grantId, data: { rollId } });
    return message;
  }

  private withdrawCheckIn(checkIn: CheckInRow, reason: string, causeActivityId: string | null): string {
    const at = this.now();
    this.db
      .prepare("UPDATE check_ins SET status = 'withdrawn', withdrawn_at = ?, withdrawn_reason = ? WHERE id = ?")
      .run(at, reason, checkIn.id);
    const grants = this.db
      .prepare(
        `SELECT ${GRANT_COLUMNS} FROM grants g WHERE check_in_id = ? AND kind IN ('check-in', 'bonus')
         AND NOT EXISTS (SELECT 1 FROM grants r WHERE r.reverses_grant_id = g.id)`,
      )
      .all(checkIn.id) as unknown as GrantRow[];
    const label = CATEGORY_LABELS[checkIn.category];
    const lines: string[] = [];
    for (const grant of grants) {
      const parts: string[] = [];
      if (grant.xp) parts.push(`-${grant.xp} XP`);
      if (grant.resource && grant.amount) parts.push(`-${grant.amount} ${grant.resource}`);
      if (!parts.length) continue;
      this.insertGrant({
        kind: "reversal",
        checkInId: checkIn.id,
        xp: -grant.xp,
        resource: grant.resource,
        amount: -grant.amount,
        reversesGrantId: grant.id,
        explanation: `Reverses ${label} ${grant.kind === "bonus" ? "bonus find" : "check-in"} for ${checkIn.localDate}: ${parts.join(", ")}.`,
      });
      lines.push(parts.join(", "));
    }
    const cancelled = this.db
      .prepare("UPDATE bonus_rolls SET status = 'cancelled', resolved_at = ? WHERE check_in_id = ? AND status = 'pending'")
      .run(at, checkIn.id);
    const notes: string[] = [];
    if (lines.length) notes.push(lines.join("; "));
    if (lines.some((line) => line.includes("XP"))) notes.push(`level stays ${this.character().level}`);
    for (const resource of RESOURCES) {
      const balance = this.balance(resource);
      if (balance < 0) notes.push(`${resource} balance ${balance}; later check-ins fill it first`);
    }
    if (Number(cancelled.changes) > 0) notes.push("its pending bonus roll was cancelled");
    const message = `${label} check-in for ${checkIn.localDate} withdrawn: ${reason}. ${notes.join("; ")}.`;
    this.journal("withdrawal", message, { localDate: checkIn.localDate, activityId: causeActivityId, checkInId: checkIn.id });
    return message;
  }

  private insertGrant(g: {
    kind: GrantRow["kind"];
    checkInId: string | null;
    xp: number;
    resource: ResourceName | null;
    amount: number;
    reversesGrantId?: string;
    explanation: string;
  }): string {
    const grantId = id("grant");
    this.db
      .prepare(
        `INSERT INTO grants (id, kind, check_in_id, rule_version, xp, resource, amount, reverses_grant_id, explanation, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(grantId, g.kind, g.checkInId, this.rules.version, g.xp, g.resource, g.amount, g.reversesGrantId ?? null, g.explanation, this.now());
    this.updateLevelPeak();
    return grantId;
  }

  // ------------------------------------------------------ player corrections

  activityRow(activityId: string): ActivityRow {
    const row = this.db.prepare(`SELECT ${ACTIVITY_COLUMNS} FROM activities WHERE id = ?`).get(activityId) as ActivityRow | undefined;
    if (!row) throw new LedgerError(404, `activity ${activityId} not found`);
    return row;
  }

  /** Edit a manual entry. Imported records are corrected by deleting them and logging a manual entry. */
  editActivity(activityId: string, changes: Record<string, unknown>, reason: string): IngestResult {
    return transaction(this.db, () => {
      const existing = this.activityRow(activityId);
      if (existing.source !== "manual")
        throw new LedgerError(409, "only manual entries can be edited; delete the imported record and log a manual entry instead");
      const allowed = ["kind", "category", "start", "end", "timeZone", "quantities", "note"];
      const unknown = Object.keys(changes).filter((key) => !allowed.includes(key));
      if (unknown.length) throw new LedgerError(400, `cannot edit ${unknown.join(", ")}`);
      const merged: Record<string, unknown> = {
        source: existing.source,
        sourceRecordId: existing.sourceRecordId,
        revision: existing.revision + 1,
        clientId: existing.clientId ?? undefined,
        kind: existing.kind,
        category: existing.explicitCategory ?? undefined,
        start: existing.startAt,
        end: existing.endAt ?? undefined,
        timeZone: existing.timeZone,
        quantities: JSON.parse(existing.quantities),
        note: existing.note ?? undefined,
        ...changes,
      };
      // A date-only edit keeps its day-level meaning.
      if (changes.start === undefined && this.wasDayLevel(existing)) merged.start = existing.localDate;
      const warnings: string[] = [];
      const normalized = this.normalize(merged, undefined, warnings);
      if (typeof normalized === "string") throw new LedgerError(400, normalized);
      normalized.deleted = existing.sourceDeleted === 1;
      const effects = this.applyRevision(existing, normalized, hashContent({ ...normalized, clientId: undefined }), `edited (${reason || "no reason given"})`);
      return {
        source: existing.source,
        sourceRecordId: existing.sourceRecordId,
        status: "updated",
        activityId,
        revision: normalized.revision,
        localDate: normalized.localDate,
        category: resolveCategory(this.rules, normalized.kind, normalized.explicitCategory),
        warnings,
        effects,
      };
    });
  }

  private wasDayLevel(row: ActivityRow): boolean {
    return zonedTimeToInstant(row.localDate, "12:00", row.timeZone).toISOString() === row.startAt;
  }

  /** Remove an activity from counting (any source). Re-imports of it stay removed. */
  deleteActivity(activityId: string, reason: string): string[] {
    return this.setUserDeleted(activityId, true, reason || "removed by the player");
  }

  restoreActivity(activityId: string, reason: string): string[] {
    return this.setUserDeleted(activityId, false, reason || "restored by the player");
  }

  private setUserDeleted(activityId: string, deleted: boolean, reason: string): string[] {
    return transaction(this.db, () => {
      const row = this.activityRow(activityId);
      if ((row.userDeleted === 1) === deleted) return [`No change: the activity is already ${deleted ? "removed" : "counted"}.`];
      this.db.prepare("UPDATE activities SET user_deleted = ?, updated_at = ? WHERE id = ?").run(deleted ? 1 : 0, this.now(), activityId);
      this.db
        .prepare("INSERT INTO activity_revisions (activity_id, revision, payload, reason, recorded_at) VALUES (?, ?, ?, ?, ?)")
        .run(activityId, row.revision, JSON.stringify({ userDeleted: deleted }), reason, this.now());
      const a = { kind: row.kind, source: row.source, quantities: JSON.parse(row.quantities), localDate: row.localDate };
      return this.afterChange(activityId, a, row.category as Category | null, null, deleted ? `removed (${reason})` : `restored (${reason})`);
    });
  }

  // ------------------------------------------------------------- bonus rolls

  bonusRolls(status?: string): Array<BonusRollRow & { localDate: string; category: Category }> {
    const where = status ? "WHERE r.status = ?" : "";
    const params = status ? [status] : [];
    return this.db
      .prepare(
        `SELECT r.id, r.check_in_id AS checkInId, r.notation, r.status, r.result, r.resolved_by AS resolvedBy, r.detail,
           r.created_at AS createdAt, r.resolved_at AS resolvedAt, c.local_date AS localDate, c.category
         FROM bonus_rolls r JOIN check_ins c ON c.id = r.check_in_id ${where} ORDER BY r.rowid`,
      )
      .all(...params) as unknown as Array<BonusRollRow & { localDate: string; category: Category }>;
  }

  /**
   * Record the dice result for a bonus roll. Resolution happens once: a repeat
   * (retry, reconnect, swipe) gets the stored result back, never a new roll.
   */
  resolveBonusRoll(rollId: string, input: { result?: unknown; resolvedBy?: unknown; detail?: unknown }) {
    return transaction(this.db, () => {
      const roll = this.db.prepare(`SELECT ${ROLL_COLUMNS} FROM bonus_rolls WHERE id = ?`).get(rollId) as BonusRollRow | undefined;
      if (!roll) throw new LedgerError(404, `bonus roll ${rollId} not found`);
      if (roll.status === "resolved") return { roll, alreadyResolved: true, effects: [] as string[] };
      if (roll.status === "cancelled") return { roll, cancelled: true, effects: ["This bonus roll was cancelled because its check-in was withdrawn."] };
      const sides = this.rules.bonusRoll.sides;
      if (!Number.isInteger(input.result) || (input.result as number) < 1 || (input.result as number) > sides)
        throw new LedgerError(400, `result must be a whole number from 1 to ${sides} for ${roll.notation}`);
      if (typeof input.resolvedBy !== "string" || !input.resolvedBy.trim()) throw new LedgerError(400, "resolvedBy is required (who rolled the dice)");
      const result = input.result as number;
      const detail = typeof input.detail === "string" ? input.detail.slice(0, 500) : null;
      const at = this.now();
      this.db
        .prepare("UPDATE bonus_rolls SET status = 'resolved', result = ?, resolved_by = ?, detail = ?, resolved_at = ? WHERE id = ?")
        .run(result, input.resolvedBy.slice(0, 64), detail, at, rollId);
      const checkIn = this.db.prepare(`SELECT ${CHECK_IN_COLUMNS} FROM check_ins WHERE id = ?`).get(roll.checkInId) as unknown as CheckInRow;
      const label = CATEGORY_LABELS[checkIn.category];
      let message: string;
      let grantId: string | null = null;
      const resource = this.rules.categoryResource[checkIn.category];
      const held = this.balance(resource);
      if (result >= this.rules.bonusRoll.luckyAtLeast && held >= this.rules.resourceSoftCap[resource]) {
        message = `Bonus roll ${result} on ${roll.notation} for ${label} ${checkIn.localDate}: a lucky find, but ${resource} is full (${held} held); spend some to make room.`;
      } else if (result >= this.rules.bonusRoll.luckyAtLeast) {
        const amount = this.rules.bonusRoll.luckyAmount;
        message = `Bonus roll ${result} on ${roll.notation} for ${label} ${checkIn.localDate}: a lucky find, +${amount} ${resource}.`;
        grantId = this.insertGrant({ kind: "bonus", checkInId: checkIn.id, xp: 0, resource, amount, explanation: message });
      } else {
        message = `Bonus roll ${result} on ${roll.notation} for ${label} ${checkIn.localDate}: no extra find.`;
      }
      this.journal("bonus-roll", message, { localDate: checkIn.localDate, checkInId: checkIn.id, grantId, data: { rollId, result } });
      const updated = this.db.prepare(`SELECT ${ROLL_COLUMNS} FROM bonus_rolls WHERE id = ?`).get(rollId) as unknown as BonusRollRow;
      return { roll: updated, alreadyResolved: false, effects: [message] };
    });
  }

  // ------------------------------------------------------------------ spends

  /** Spend a resource for a committed UI action. Idempotent by key. */
  spend(input: Record<string, unknown>) {
    const key = input.idempotencyKey;
    if (typeof key !== "string" || !key.trim() || key.length > 200) throw new LedgerError(400, "idempotencyKey is required");
    if (!isResource(input.resource)) throw new LedgerError(400, `resource must be one of ${RESOURCES.join(", ")}`);
    if (!Number.isInteger(input.amount) || (input.amount as number) < 1 || (input.amount as number) > 1000)
      throw new LedgerError(400, "amount must be a whole number from 1 to 1000");
    if (typeof input.purpose !== "string" || !input.purpose.trim() || input.purpose.length > 200)
      throw new LedgerError(400, "purpose is required (at most 200 characters)");
    const resource = input.resource;
    const amount = input.amount as number;
    return transaction(this.db, () => {
      const existing = this.db.prepare("SELECT * FROM spends WHERE idempotency_key = ?").get(key) as Record<string, unknown> | undefined;
      if (existing) return { spend: existing, replayed: true, balance: this.balance(existing.resource as ResourceName) };
      const balance = this.balance(resource);
      // Refusing here prevents a committed war-table action from silently overdrawing.
      if (balance < amount) throw new LedgerError(409, `not enough ${resource}: ${balance} available, ${amount} needed`);
      const spendId = id("spend");
      this.db
        .prepare("INSERT INTO spends (id, idempotency_key, resource, amount, purpose, chat_id, detail, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)")
        .run(
          spendId,
          key,
          resource,
          amount,
          input.purpose as string,
          typeof input.chatId === "string" ? input.chatId : null,
          typeof input.detail === "string" ? input.detail.slice(0, 1000) : null,
          this.now(),
        );
      const after = this.balance(resource);
      const what = resource === "reroll" ? plural(amount, "second chance") : `${amount} ${resource}`;
      this.journal("spend", `Spent ${what}: ${input.purpose} (${resource} now ${after}).`, {
        localDate: localDateOf(this.clock(), this.settings().timeZone),
        data: { spendId, resource, amount },
      });
      return { spend: this.db.prepare("SELECT * FROM spends WHERE id = ?").get(spendId), replayed: false, balance: after };
    });
  }

  spends(): unknown[] {
    return this.db.prepare("SELECT * FROM spends ORDER BY rowid").all();
  }

  // ------------------------------------------------------- balances and level

  balance(resource: ResourceName): number {
    const granted = (this.db.prepare("SELECT COALESCE(SUM(amount), 0) AS v FROM grants WHERE resource = ?").get(resource) as { v: number }).v;
    const spent = (this.db.prepare("SELECT COALESCE(SUM(amount), 0) AS v FROM spends WHERE resource = ?").get(resource) as { v: number }).v;
    return granted - spent;
  }

  totalXp(): number {
    return (this.db.prepare("SELECT COALESCE(SUM(xp), 0) AS v FROM grants").get() as { v: number }).v;
  }

  private levelPeak(): number {
    const row = this.db.prepare("SELECT value FROM meta WHERE key = 'level_peak'").get() as { value: string } | undefined;
    return row ? Number(row.value) : 1;
  }

  private updateLevelPeak(): void {
    const level = levelForXp(this.rules, this.totalXp());
    if (level > this.levelPeak())
      this.db
        .prepare("INSERT INTO meta (key, value) VALUES ('level_peak', ?) ON CONFLICT (key) DO UPDATE SET value = excluded.value")
        .run(String(level));
  }

  character() {
    const xp = this.totalXp();
    const level = Math.max(levelForXp(this.rules, xp), this.levelPeak());
    const nextLevelXp = level >= this.rules.maxLevel ? null : xpForLevel(this.rules, level + 1);
    return {
      xp,
      level,
      nextLevelXp,
      resources: { supplies: this.balance("supplies"), training: this.balance("training") },
      rerolls: this.balance("reroll"),
      ruleVersion: this.rules.version,
    };
  }

  // -------------------------------------------------------------- projection

  /** What the Marinara fitness module should show on the game build for a chat. */
  projection(chatId: string) {
    if (!chatId) throw new LedgerError(400, "chatId is required");
    const grants = this.db
      .prepare(
        `SELECT ${GRANT_COLUMNS} FROM grants g WHERE NOT EXISTS
           (SELECT 1 FROM projection_receipts p WHERE p.chat_id = ? AND p.grant_id = g.id) ORDER BY g.rowid`,
      )
      .all(chatId) as unknown as GrantRow[];
    const applied = (this.db.prepare("SELECT COUNT(*) AS n FROM projection_receipts WHERE chat_id = ?").get(chatId) as { n: number }).n;
    return {
      chatId,
      character: this.character(),
      unappliedGrants: grants,
      appliedGrantCount: applied,
      pendingBonusRolls: this.bonusRolls("pending"),
    };
  }

  acknowledgeProjection(chatId: unknown, grantIds: unknown, note?: unknown) {
    if (typeof chatId !== "string" || !chatId) throw new LedgerError(400, "chatId is required");
    if (!Array.isArray(grantIds) || grantIds.some((g) => typeof g !== "string")) throw new LedgerError(400, "grantIds must be a list of grant ids");
    return transaction(this.db, () => {
      const known: string[] = [];
      const unknown: string[] = [];
      const exists = this.db.prepare("SELECT 1 FROM grants WHERE id = ?");
      const insert = this.db.prepare("INSERT OR IGNORE INTO projection_receipts (chat_id, grant_id, note, applied_at) VALUES (?, ?, ?, ?)");
      for (const grantId of grantIds as string[]) {
        if (!exists.get(grantId)) {
          unknown.push(grantId);
          continue;
        }
        insert.run(chatId, grantId, typeof note === "string" ? note.slice(0, 500) : null, this.now());
        known.push(grantId);
      }
      return { acknowledged: known, unknown };
    });
  }

  // ---------------------------------------------------------- reads/journal

  private journal(
    kind: string,
    message: string,
    refs: { localDate?: string; activityId?: string | null; checkInId?: string; grantId?: string | null; data?: unknown } = {},
  ): void {
    this.db
      .prepare("INSERT INTO journal (at, local_date, kind, activity_id, check_in_id, grant_id, message, data) VALUES (?, ?, ?, ?, ?, ?, ?, ?)")
      .run(
        this.now(),
        refs.localDate ?? null,
        kind,
        refs.activityId ?? null,
        refs.checkInId ?? null,
        refs.grantId ?? null,
        message,
        refs.data === undefined ? null : JSON.stringify(refs.data),
      );
  }

  journalEntries(query: { from?: string; to?: string; after?: number; limit?: number } = {}): JournalEntry[] {
    const clauses: string[] = [];
    const params: Array<string | number> = [];
    if (query.from) {
      clauses.push("local_date >= ?");
      params.push(query.from);
    }
    if (query.to) {
      clauses.push("local_date <= ?");
      params.push(query.to);
    }
    if (query.after !== undefined) {
      clauses.push("seq > ?");
      params.push(query.after);
    }
    const limit = Math.min(Math.max(query.limit ?? 200, 1), 2000);
    const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
    const order = query.after !== undefined ? "ASC" : "DESC";
    return this.db
      .prepare(
        `SELECT seq, at, local_date AS localDate, kind, activity_id AS activityId, check_in_id AS checkInId, grant_id AS grantId, message, data
         FROM journal ${where} ORDER BY seq ${order} LIMIT ${limit}`,
      )
      .all(...params)
      .map((row) => ({ ...(row as unknown as JournalEntry), data: row.data ? JSON.parse(row.data as string) : null }));
  }

  activities(query: { from?: string; to?: string } = {}) {
    const rows = this.db
      .prepare(`SELECT ${ACTIVITY_COLUMNS} FROM activities WHERE local_date >= ? AND local_date <= ? ORDER BY start_at, rowid`)
      .all(query.from ?? "0000-01-01", query.to ?? "9999-12-31") as unknown as ActivityRow[];
    return rows.map((row) => this.presentActivity(row));
  }

  activity(activityId: string) {
    const row = this.activityRow(activityId);
    const revisions = this.db
      .prepare("SELECT revision, payload, reason, recorded_at AS recordedAt FROM activity_revisions WHERE activity_id = ? ORDER BY rowid")
      .all(activityId)
      .map((r) => ({ ...r, payload: JSON.parse(r.payload as string) }));
    return { ...this.presentActivity(row), revisions };
  }

  private presentActivity(row: ActivityRow) {
    return {
      id: row.id,
      source: row.source,
      sourceRecordId: row.sourceRecordId,
      revision: row.revision,
      clientId: row.clientId,
      kind: row.kind,
      category: row.category,
      explicitCategory: row.explicitCategory,
      start: row.startAt,
      end: row.endAt,
      timeZone: row.timeZone,
      localDate: row.localDate,
      quantities: JSON.parse(row.quantities),
      note: row.note,
      counted: row.sourceDeleted === 0 && row.userDeleted === 0,
      deletedAtSource: row.sourceDeleted === 1,
      removedByPlayer: row.userDeleted === 1,
      receivedAt: row.receivedAt,
      updatedAt: row.updatedAt,
    };
  }

  /** Every category's state for one local day, with sources and grants. */
  day(localDate: string) {
    if (!isLocalDate(localDate)) throw new LedgerError(400, "date must be YYYY-MM-DD");
    const settings = this.settings();
    const categories = CATEGORIES.map((category) => {
      const evaluation = evaluateCategory(this.rules, settings, category, this.dayActivities(localDate, category));
      const checkIns = this.db
        .prepare(`SELECT ${CHECK_IN_COLUMNS} FROM check_ins WHERE local_date = ? AND category = ? ORDER BY rowid`)
        .all(localDate, category) as unknown as CheckInRow[];
      const active = checkIns.find((c) => c.status === "active") ?? null;
      const grants = active
        ? (this.db.prepare(`SELECT ${GRANT_COLUMNS} FROM grants WHERE check_in_id = ? ORDER BY rowid`).all(active.id) as unknown as GrantRow[])
        : [];
      const roll = active ? this.bonusRolls().find((r) => r.checkInId === active.id) ?? null : null;
      return {
        category,
        label: CATEGORY_LABELS[category],
        earned: Boolean(active),
        detail: evaluation.detail,
        supportingActivityIds: evaluation.supporting,
        checkIn: active,
        withdrawnCheckIns: checkIns.filter((c) => c.status === "withdrawn"),
        grants,
        bonusRoll: roll,
      };
    });
    return { localDate, categories, activities: this.activities({ from: localDate, to: localDate }) };
  }

  today() {
    return localDateOf(this.clock(), this.settings().timeZone);
  }

  summary() {
    const today = this.today();
    return {
      today,
      character: this.character(),
      day: this.day(today),
      pendingBonusRolls: this.bonusRolls("pending").length,
      settings: this.settings(),
    };
  }

  status() {
    const count = (sql: string) => (this.db.prepare(sql).get() as { n: number }).n;
    return {
      service: "lore-fitness-ledger",
      ruleVersion: this.rules.version,
      schemaVersion: (this.db.prepare("PRAGMA user_version").get() as { user_version: number }).user_version,
      activities: count("SELECT COUNT(*) AS n FROM activities"),
      activeCheckIns: count("SELECT COUNT(*) AS n FROM check_ins WHERE status = 'active'"),
      pendingBonusRolls: count("SELECT COUNT(*) AS n FROM bonus_rolls WHERE status = 'pending'"),
      lastReceivedAt: (this.db.prepare("SELECT MAX(received_at) AS v FROM activities").get() as { v: string | null }).v,
      sources: this.db
        .prepare("SELECT source, COUNT(*) AS records, MAX(updated_at) AS lastUpdatedAt FROM activities GROUP BY source ORDER BY source")
        .all(),
      clients: this.db
        .prepare(
          "SELECT client_id AS clientId, last_seen_at AS lastSeenAt, last_batch_size AS lastBatchSize, accepted_total AS acceptedTotal FROM client_sync ORDER BY client_id",
        )
        .all(),
      projections: this.db
        .prepare("SELECT chat_id AS chatId, COUNT(*) AS appliedGrants, MAX(applied_at) AS lastAppliedAt FROM projection_receipts GROUP BY chat_id")
        .all(),
    };
  }
}
