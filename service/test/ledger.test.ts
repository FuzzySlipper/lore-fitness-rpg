import assert from "node:assert/strict";
import { test } from "node:test";
import { activeCheckIns, grants, makeLedger, manual, TZ, walk } from "./helpers.ts";
import { RULES_V1 } from "../src/rules.ts";

test("an accepted walk earns one Moved check-in with XP, supplies, a pending bonus roll and a journal entry", () => {
  const { ledger } = makeLedger();
  const [result] = ledger.ingest([walk()]);
  assert.equal(result.status, "created");
  assert.equal(result.localDate, "2026-11-16");
  assert.equal(result.category, "moved");
  assert.deepEqual(activeCheckIns(ledger), [{ localDate: "2026-11-16", category: "moved" }]);
  assert.deepEqual(grants(ledger), [{ kind: "check-in", xp: 20, resource: "supplies", amount: 1, ruleVersion: 1 }]);
  assert.equal(ledger.bonusRolls("pending").length, 1);
  assert.ok(result.effects.some((e) => e.includes("Moved check-in for 2026-11-16") && e.includes("+20 XP")));
  const journal = ledger.journalEntries();
  assert.ok(journal.some((entry) => entry.kind === "activity" && entry.activityId === result.activityId));
  assert.ok(journal.some((entry) => entry.kind === "check-in"));
});

test("resending the same revision is acknowledged once; older revisions are ignored; newer ones replace", () => {
  const { ledger } = makeLedger();
  const record = walk({ sourceRecordId: "w-1", revision: 2 });
  assert.equal(ledger.ingest([record])[0].status, "created");
  assert.equal(ledger.ingest([record])[0].status, "duplicate");
  assert.equal(ledger.ingest([{ ...record, revision: 1 }])[0].status, "stale");
  const changed = ledger.ingest([{ ...record, quantities: { durationMin: 99 } }])[0];
  assert.equal(changed.status, "duplicate");
  assert.match(changed.warnings.join(" "), /same revision with different content/);
  assert.equal(ledger.ingest([{ ...record, revision: 3, quantities: { durationMin: 45 } }])[0].status, "updated");
  assert.equal(grants(ledger).length, 1, "no extra grant from resends or revisions");
  assert.equal(ledger.activities()[0].quantities.durationMin, 45);
  assert.equal(ledger.activity(changed.activityId!).revisions.length, 2);
});

test("overlapping sources for one category and day collapse into one check-in that lists each source", () => {
  const { ledger } = makeLedger();
  ledger.ingest([walk({ sourceRecordId: "a" })]);
  const second = ledger.ingest([walk({ source: "watch", sourceRecordId: "b" })])[0];
  const third = ledger.ingest([manual("moved")])[0];
  assert.match(second.effects.join(" "), /also supports the Moved check-in/);
  assert.equal(activeCheckIns(ledger).length, 1);
  assert.equal(grants(ledger).length, 1);
  const moved = ledger.day("2026-11-16").categories.find((c) => c.category === "moved")!;
  assert.equal(moved.supportingActivityIds.length, 3);
  assert.ok(moved.supportingActivityIds.includes(third.activityId!));
});

test("step totals count the best single source, not the sum across devices", () => {
  const { ledger } = makeLedger();
  const day = { kind: "steps", start: "2026-11-16T06:00:00Z", timeZone: TZ };
  ledger.ingest([{ ...day, source: "ohealth", sourceRecordId: "s1", quantities: { steps: 4000 } }]);
  const below = ledger.ingest([{ ...day, source: "phone", sourceRecordId: "s2", quantities: { steps: 4500 } }])[0];
  assert.equal(activeCheckIns(ledger).length, 0, "4,000 + 4,500 from two devices is not 6,000 steps");
  assert.match(below.effects.join(" "), /not earned yet \(4,500 of 6,000 steps\)/);
  ledger.ingest([{ ...day, source: "ohealth", sourceRecordId: "s1", revision: 2, quantities: { steps: 6200 } }]);
  assert.equal(activeCheckIns(ledger).length, 1);
});

test("hydration counts toward the goal across drinks; more water earns nothing extra", () => {
  const { ledger } = makeLedger();
  const drink = (n: number, source = "watch") => ({ source, sourceRecordId: `d${n}`, kind: "hydration", start: "2026-11-16T15:00:00Z", timeZone: TZ, quantities: { amountMl: 500 } });
  ledger.ingest([drink(1), drink(2), drink(3, "phone")]);
  assert.equal(activeCheckIns(ledger).length, 0);
  ledger.ingest([drink(4)]);
  assert.deepEqual(activeCheckIns(ledger), [{ localDate: "2026-11-16", category: "hydration" }]);
  ledger.ingest([drink(5), drink(6), drink(7)]);
  assert.equal(grants(ledger).length, 1);
});

test("the day boundary is local midnight in the activity's own zone", () => {
  const { ledger } = makeLedger();
  // 23:30 in Chicago on 16 November is 05:30 UTC on 17 November.
  const late = ledger.ingest([walk({ start: "2026-11-17T05:30:00Z", end: "2026-11-17T05:50:00Z", timeZone: "America/Chicago" })])[0];
  assert.equal(late.localDate, "2026-11-16");
  const tokyo = ledger.ingest([walk({ start: "2026-11-17T05:30:00Z", end: undefined, timeZone: "Asia/Tokyo" })])[0];
  assert.equal(tokyo.localDate, "2026-11-17");
  assert.equal(activeCheckIns(ledger).length, 2);
});

test("a backdated day-level entry earns its own day if that day's category is still unearned", () => {
  const { ledger } = makeLedger();
  ledger.ingest([manual("strength", { start: "2026-11-10" })]);
  ledger.ingest([manual("strength", { start: "2026-11-10" })]);
  assert.deepEqual(activeCheckIns(ledger), [{ localDate: "2026-11-10", category: "strength" }]);
});

test("removing evidence withdraws the check-in with reversal grants; a spent resource goes negative and later check-ins fill it", () => {
  const { ledger } = makeLedger();
  const [w] = ledger.ingest([walk()]);
  ledger.spend({ idempotencyKey: "k1", resource: "supplies", amount: 1, purpose: "war table: scout the Hinterlands" });
  const effects = ledger.deleteActivity(w.activityId!, "this was the dog walker's watch");
  assert.match(effects.join(" "), /withdrawn/);
  assert.match(effects.join(" "), /supplies balance -1; later check-ins fill it first/);
  assert.match(effects.join(" "), /pending bonus roll was cancelled/);
  assert.equal(ledger.balance("supplies"), -1);
  assert.equal(ledger.totalXp(), 0);
  assert.equal(ledger.spends().length, 1, "the spend is kept");
  assert.equal(ledger.bonusRolls("cancelled").length, 1);
  ledger.ingest([manual("meal")]);
  assert.equal(ledger.balance("supplies"), 0);
  // Re-importing the removed record does not bring it back.
  assert.equal(ledger.ingest([{ ...ledger.activity(w.activityId!), start: "2026-11-16T14:00:00Z", revision: 5 }])[0].status, "updated");
  assert.equal(ledger.activity(w.activityId!).counted, false);
  ledger.restoreActivity(w.activityId!, "it was mine after all");
  assert.equal(activeCheckIns(ledger).filter((c) => c.category === "moved").length, 1);
});

test("level never goes down after a correction", () => {
  const { ledger } = makeLedger();
  const ids: string[] = [];
  for (let day = 1; day <= 5; day += 1) {
    const date = `2026-11-0${day}`;
    for (const category of ["moved", "strength"]) ids.push(ledger.ingest([manual(category, { start: date })])[0].activityId!);
  }
  assert.equal(ledger.character().xp, 200);
  assert.equal(ledger.character().level, 2);
  ledger.deleteActivity(ids[0], "mistake");
  assert.equal(ledger.character().xp, 180);
  assert.equal(ledger.character().level, 2, "level stays at the highest reached");
});

test("bonus rolls resolve once; a repeat returns the stored result; a high roll is a lucky find", () => {
  const { ledger } = makeLedger();
  ledger.ingest([walk()]);
  const [roll] = ledger.bonusRolls("pending");
  assert.throws(() => ledger.resolveBonusRoll(roll.id, { result: 21, resolvedBy: "marinara-dice" }), /1 to 20/);
  const first = ledger.resolveBonusRoll(roll.id, { result: 19, resolvedBy: "marinara-dice" });
  assert.equal(first.alreadyResolved, false);
  assert.match(first.effects[0], /lucky find, \+1 supplies/);
  const again = ledger.resolveBonusRoll(roll.id, { result: 2, resolvedBy: "marinara-dice" });
  assert.equal(again.alreadyResolved, true);
  assert.equal(again.roll.result, 19);
  assert.equal(ledger.balance("supplies"), 2);
});

test("spends are idempotent by key and refuse to overdraw", () => {
  const { ledger } = makeLedger();
  ledger.ingest([walk(), manual("meal")]);
  const first = ledger.spend({ idempotencyKey: "war-1", resource: "supplies", amount: 2, purpose: "war table" });
  const replay = ledger.spend({ idempotencyKey: "war-1", resource: "supplies", amount: 2, purpose: "war table" });
  assert.equal(first.replayed, false);
  assert.equal(replay.replayed, true);
  assert.equal(ledger.balance("supplies"), 0);
  assert.throws(() => ledger.spend({ idempotencyKey: "war-2", resource: "supplies", amount: 1, purpose: "war table" }), /not enough supplies/);
});

test("recovery days earn a reroll; spending it is recorded; holdings stop at the soft cap", () => {
  const { ledger } = makeLedger();
  for (let day = 1; day <= 5; day += 1) ledger.ingest([manual("rest", { start: `2026-11-0${day}` })]);
  assert.equal(ledger.balance("reroll"), RULES_V1.resourceSoftCap.reroll);
  ledger.spend({ idempotencyKey: "reroll-1", resource: "reroll", amount: 1, purpose: "Fade-touched second chance on the bridge fight" });
  assert.equal(ledger.character().rerolls, 2);
  assert.match(ledger.journalEntries({ limit: 1 })[0].message, /Spent 1 second chance/);
});

test("projection lists unapplied grants per chat and acknowledgment is idempotent", () => {
  const { ledger } = makeLedger();
  ledger.ingest([walk(), manual("strength")]);
  const projection = ledger.projection("chat-1");
  assert.equal(projection.unappliedGrants.length, 2);
  assert.equal(projection.character.xp, 40);
  const ids = projection.unappliedGrants.map((g) => g.id);
  assert.deepEqual(ledger.acknowledgeProjection("chat-1", [...ids, "grant_missing"]).unknown, ["grant_missing"]);
  ledger.acknowledgeProjection("chat-1", ids);
  assert.equal(ledger.projection("chat-1").unappliedGrants.length, 0);
  assert.equal(ledger.projection("chat-1").appliedGrantCount, 2);
  assert.equal(ledger.projection("chat-2").unappliedGrants.length, 2, "another chat has its own receipts");
});

test("manual entries can be edited, imported ones cannot; edits move check-ins between days", () => {
  const { ledger } = makeLedger();
  const [m] = ledger.ingest([manual("mobility", { start: "2026-11-12" })]);
  const [imported] = ledger.ingest([walk()]);
  assert.throws(() => ledger.editActivity(imported.activityId!, { note: "x" }, "typo"), /only manual entries/);
  const edited = ledger.editActivity(m.activityId!, { start: "2026-11-13" }, "wrong day");
  assert.equal(edited.localDate, "2026-11-13");
  assert.deepEqual(
    activeCheckIns(ledger).filter((c) => c.category === "mobility"),
    [{ localDate: "2026-11-13", category: "mobility" }],
  );
  const noteOnly = ledger.editActivity(m.activityId!, { note: "evening stretch" }, "added a note");
  assert.equal(noteOnly.localDate, "2026-11-13", "a day-level entry stays day-level");
});

test("records without optional measurements still count; bad records are rejected individually", () => {
  const { ledger } = makeLedger();
  const results = ledger.ingest([
    { source: "manual", sourceRecordId: "bare", kind: "strength", start: "2026-11-16" },
    { source: "manual", sourceRecordId: "bad-zone", kind: "walk", start: "2026-11-16", timeZone: "Mars/Olympus" },
    { source: "manual", sourceRecordId: "bad-cat", kind: "walk", start: "2026-11-16", category: "cardio" },
    { source: "manual", sourceRecordId: "odd", kind: "gardening", start: "2026-11-16", quantities: { durationMin: -5 } },
  ]);
  assert.deepEqual(
    results.map((r) => r.status),
    ["created", "rejected", "rejected", "created"],
  );
  assert.match(results[3].warnings.join(" "), /no category/);
  assert.match(results[3].warnings.join(" "), /durationMin/);
  assert.deepEqual(activeCheckIns(ledger), [{ localDate: "2026-11-16", category: "strength" }]);
});

test("a rules change keeps earlier grants at their rule version", () => {
  const path = `${process.env.TMPDIR ?? "/tmp"}/lfr-rules-${process.pid}-${Date.now()}.sqlite`;
  const first = makeLedger({ path });
  first.ledger.ingest([walk()]);
  first.db.close();
  const second = makeLedger({ path, rules: { ...RULES_V1, version: 2, baseXp: 30 } });
  second.ledger.ingest([manual("strength")]);
  assert.deepEqual(
    grants(second.ledger).map((g) => [g.ruleVersion, g.xp]),
    [
      [1, 20],
      [2, 30],
    ],
  );
  second.db.close();
});
