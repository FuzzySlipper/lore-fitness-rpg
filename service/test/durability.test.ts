import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, test } from "node:test";
import { DatabaseSync } from "node:sqlite";
import { backupTo, LATEST_SCHEMA_VERSION, openLedgerDb, schemaVersion } from "../src/db.ts";
import { createLedgerServer } from "../src/http.ts";
import { Ledger } from "../src/ledger.ts";
import { generateHistory } from "../src/synthetic.ts";
import type { Persona } from "../src/synthetic.ts";
import { activeCheckIns, grants, makeLedger, manual, TZ, walk } from "./helpers.ts";

const dir = mkdtempSync(join(tmpdir(), "lfr-test-"));
after(() => rmSync(dir, { recursive: true, force: true }));

const personas = JSON.parse(readFileSync(new URL("../../harness/personas.json", import.meta.url), "utf8")).personas as Persona[];

test("replaying the same accepted input and stored rolls yields the same grants", () => {
  const history = generateHistory(personas[0], { start: "2026-09-07", timeZone: TZ, seed: 5, noise: true });
  const run = () => {
    let now = new Date();
    const { ledger } = makeLedger({ clock: () => now });
    let roll = 0;
    for (const record of history.records) {
      now = new Date(record.deliveredAt);
      const { deliveredAt: _d, synthetic: _s, ...input } = record;
      ledger.ingest([input]);
      for (const pending of ledger.bonusRolls("pending")) ledger.resolveBonusRoll(pending.id, { result: (roll++ % 20) + 1, resolvedBy: "test" });
    }
    return { grants: grants(ledger), checkIns: activeCheckIns(ledger), character: ledger.character() };
  };
  assert.deepEqual(run(), run());
});

test("every persona history earns exactly its scheduled check-ins despite duplicates, revisions and late entries", () => {
  for (const persona of personas) {
    const history = generateHistory(persona, { start: "2026-09-07", timeZone: TZ, seed: 11, noise: true });
    let now = new Date();
    const { ledger } = makeLedger({ clock: () => now });
    for (const record of history.records) {
      now = new Date(record.deliveredAt);
      const { deliveredAt: _d, synthetic: _s, ...input } = record;
      const [result] = ledger.ingest([input]);
      assert.notEqual(result.status, "rejected", `${persona.id}: ${result.reason}`);
    }
    const earned = activeCheckIns(ledger).map((c) => `${c.localDate}|${c.category}`).sort();
    const expected = history.scheduled.map((s) => `${s.localDate}|${s.category}`).sort();
    assert.deepEqual(earned, expected, persona.id);
  }
});

test("the generator is deterministic for a seed and covers several weeks", () => {
  const steady = personas.find((p) => p.id === "steady")!;
  const a = generateHistory(steady, { start: "2026-09-07", timeZone: TZ, seed: 2 });
  const b = generateHistory(steady, { start: "2026-09-07", timeZone: TZ, seed: 2 });
  assert.deepEqual(a, b);
  assert.equal(a.end, "2026-10-04");
  assert.ok(a.records.length > 100);
  const illness = generateHistory(personas.find((p) => p.id === "illness")!, { start: "2026-09-07", timeZone: TZ });
  const sick = illness.scheduled.filter((s) => s.localDate >= "2026-09-14" && s.localDate <= "2026-09-23");
  assert.ok(sick.every((s) => s.category === "rest" || s.category === "hydration"));
});

test("a backup copy and a reopened ledger keep the journal, grants and receipts", () => {
  const path = join(dir, "ledger.sqlite");
  const { ledger, db } = makeLedger({ path });
  ledger.ingest([walk(), manual("rest")]);
  const ids = ledger.projection("chat-9").unappliedGrants.map((g) => g.id);
  ledger.acknowledgeProjection("chat-9", ids);
  ledger.spend({ idempotencyKey: "s", resource: "supplies", amount: 1, purpose: "war table" });
  const copy = join(dir, "backup.sqlite");
  backupTo(db, copy);
  db.close();
  for (const file of [path, copy]) {
    const reopened = new Ledger(openLedgerDb(file), { defaultTimeZone: TZ });
    assert.equal(reopened.journalEntries().length, 5, file);
    assert.equal(reopened.projection("chat-9").appliedGrantCount, 2);
    assert.equal(reopened.spends().length, 1);
    assert.deepEqual(reopened.character().resources, { supplies: 0, training: 0 });
    reopened.db.close();
  }
});

test("migrating a version 1 ledger to the latest schema keeps its data and backfills client sync status", () => {
  const path = join(dir, "v1.sqlite");
  const v1 = openLedgerDb(path, { targetVersion: 1 });
  assert.equal(schemaVersion(v1), 1);
  // Write directly at schema 1 (the Ledger class targets the latest schema).
  v1.prepare(
    `INSERT INTO activities (id, source, source_record_id, revision, client_id, kind, category, start_at, time_zone, local_date,
       quantities, content_hash, received_at, updated_at)
     VALUES ('act_1', 'ohealth', 'w', 1, 'razr', 'walk', 'moved', '2026-11-16T14:00:00.000Z', ?, '2026-11-16', '{}', 'h', 'r', 'u')`,
  ).run(TZ);
  v1.prepare("INSERT INTO journal (at, local_date, kind, message) VALUES ('t', '2026-11-16', 'activity', 'Logged walk')").run();
  v1.close();
  const migrated = openLedgerDb(path);
  assert.equal(schemaVersion(migrated), LATEST_SCHEMA_VERSION);
  assert.equal((migrated.prepare("SELECT COUNT(*) AS n FROM activities").get() as { n: number }).n, 1);
  assert.equal((migrated.prepare("SELECT COUNT(*) AS n FROM journal").get() as { n: number }).n, 1);
  assert.deepEqual(migrated.prepare("SELECT client_id AS c, accepted_total AS n FROM client_sync").all().map((row) => ({ ...row })), [{ c: "razr", n: 1 }]);
  migrated.close();
});

test("a ledger newer than the service is refused rather than misread", () => {
  const path = join(dir, "future.sqlite");
  const db = new DatabaseSync(path);
  db.exec(`PRAGMA user_version = ${LATEST_SCHEMA_VERSION + 1}`);
  db.close();
  assert.throws(() => openLedgerDb(path), /newer than this service/);
});

test("HTTP: ingest, retry after restart, resolve a roll and read status", async () => {
  const path = join(dir, "http.sqlite");
  const start = () => {
    const ledger = new Ledger(openLedgerDb(path), { defaultTimeZone: TZ });
    const server = createLedgerServer(ledger);
    return new Promise<{ base: string; stop: () => Promise<void> }>((resolve) =>
      server.listen(0, "127.0.0.1", () => {
        const address = server.address() as { port: number };
        resolve({
          base: `http://127.0.0.1:${address.port}`,
          stop: () => new Promise((done) => server.close(() => (ledger.db.close(), done()))),
        });
      }),
    );
  };
  const call = async (base: string, method: string, path: string, body?: unknown) => {
    const response = await fetch(`${base}${path}`, {
      method,
      headers: body ? { "content-type": "application/json" } : {},
      body: body ? JSON.stringify(body) : undefined,
    });
    return { status: response.status, body: await response.json() };
  };
  const batch = { clientId: "razr", records: [walk({ sourceRecordId: "http-walk" })] };

  let server = await start();
  const first = await call(server.base, "POST", "/v1/activities", batch);
  assert.equal(first.status, 200);
  assert.equal(first.body.results[0].status, "created");
  await server.stop();

  // The phone never saw the acknowledgment and resends after the service restarts.
  server = await start();
  const resend = await call(server.base, "POST", "/v1/activities", batch);
  assert.equal(resend.body.results[0].status, "duplicate");
  const rolls = await call(server.base, "GET", "/v1/bonus-rolls?status=pending");
  assert.equal(rolls.body.bonusRolls.length, 1);
  const resolved = await call(server.base, "POST", `/v1/bonus-rolls/${rolls.body.bonusRolls[0].id}/resolve`, { result: 4, resolvedBy: "marinara-dice" });
  assert.equal(resolved.body.roll.result, 4);
  const status = await call(server.base, "GET", "/v1/status");
  assert.equal(status.body.activeCheckIns, 1);
  assert.equal(status.body.clients[0].clientId, "razr");
  const bad = await call(server.base, "POST", "/v1/spends", { idempotencyKey: "x", resource: "gold", amount: 1, purpose: "p" });
  assert.equal(bad.status, 400);
  const missing = await call(server.base, "GET", "/v1/nothing");
  assert.equal(missing.status, 404);
  const day = await call(server.base, "GET", "/v1/days/2026-11-16");
  assert.equal(day.body.categories.find((c: { category: string }) => c.category === "moved").earned, true);
  await server.stop();
});
