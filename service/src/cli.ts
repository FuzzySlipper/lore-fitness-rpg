// Ledger command line.
//
//   node src/cli.ts status  [--data DIR]
//   node src/cli.ts backup  [--data DIR] [--out FILE]
//   node src/cli.ts synth   --persona ID [--personas FILE] [--start DATE] [--time-zone TZ] [--seed N] [--noise]
//   node src/cli.ts seed    --persona ID [--data DIR] [--personas FILE] [--start DATE] [--time-zone TZ]
//                           [--seed N] [--noise] [--resolve-rolls]
//
// `synth` prints synthetic activity records as JSON lines. `seed` feeds them into a
// (scratch) ledger in delivery order with a simulated clock, optionally resolving
// bonus rolls with seeded synthetic dice in place of Marinara's dice, and prints a
// summary comparing earned check-ins with the persona's schedule.

import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { loadConfig, parseFlags } from "./config.ts";
import { addDays, localDateOf } from "./dates.ts";
import { backupTo, openLedgerDb } from "./db.ts";
import { Ledger } from "./ledger.ts";
import { generateHistory } from "./synthetic.ts";
import type { Persona } from "./synthetic.ts";

const here = dirname(fileURLToPath(import.meta.url));
const DEFAULT_PERSONAS = resolve(here, "../../harness/personas.json");

function loadPersona(flags: Record<string, string>): Persona {
  const file = flags.personas ?? DEFAULT_PERSONAS;
  const personas = JSON.parse(readFileSync(file, "utf8")).personas as Persona[];
  const persona = personas.find((p) => p.id === flags.persona);
  if (!persona) throw new Error(`persona ${flags.persona ?? "(none)"} not found in ${file}; have ${personas.map((p) => p.id).join(", ")}`);
  return persona;
}

function historyFor(flags: Record<string, string>, timeZone: string, stepGoal?: number, hydrationGoalMl?: number) {
  const persona = loadPersona(flags);
  // Default: the history ends yesterday, so a playtest starts on a fresh "today".
  const start = flags.start ?? addDays(localDateOf(new Date(), timeZone), -persona.weeks * 7);
  return generateHistory(persona, {
    start,
    timeZone,
    seed: Number(flags.seed ?? 1),
    noise: flags.noise === "true",
    stepGoal,
    hydrationGoalMl,
  });
}

function seededDice(seed: number) {
  let state = seed >>> 0 || 1;
  return (sides: number) => {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    return ((state >>> 0) % sides) + 1;
  };
}

const [command, ...rest] = process.argv.slice(2);
const flags = parseFlags(rest);

switch (command) {
  case "status": {
    const config = loadConfig(flags);
    const ledger = new Ledger(openLedgerDb(config.dbPath), { defaultTimeZone: config.timeZone });
    process.stdout.write(`${JSON.stringify({ ...ledger.status(), character: ledger.character() }, null, 2)}\n`);
    break;
  }
  case "backup": {
    const config = loadConfig(flags);
    const db = openLedgerDb(config.dbPath);
    const out = resolve(flags.out ?? join(config.backupDir, `ledger-${new Date().toISOString().replace(/[:.]/g, "-")}.sqlite`));
    backupTo(db, out);
    db.close();
    process.stdout.write(`${out}\n`);
    break;
  }
  case "synth": {
    const history = historyFor(flags, flags["time-zone"] ?? "UTC");
    for (const record of history.records) process.stdout.write(`${JSON.stringify(record)}\n`);
    break;
  }
  case "seed": {
    const config = loadConfig(flags);
    let now = new Date();
    const ledger = new Ledger(openLedgerDb(config.dbPath), { defaultTimeZone: config.timeZone, clock: () => now });
    const settings = ledger.settings();
    const history = historyFor(flags, config.timeZone, settings.stepGoal, settings.hydrationGoalMl);
    const roll = seededDice(Number(flags.seed ?? 1) * 7919);
    const counts: Record<string, number> = {};
    for (const record of history.records) {
      now = new Date(record.deliveredAt);
      const { deliveredAt: _deliveredAt, synthetic: _synthetic, ...input } = record;
      const [result] = ledger.ingest([input]);
      counts[result.status] = (counts[result.status] ?? 0) + 1;
      if (flags["resolve-rolls"] === "true")
        for (const pending of ledger.bonusRolls("pending"))
          ledger.resolveBonusRoll(pending.id, { result: roll(ledger.rules.bonusRoll.sides), resolvedBy: "synthetic-dice" });
    }
    now = new Date();
    const earned = new Set(
      (ledger.db.prepare("SELECT local_date AS d, category AS c FROM check_ins WHERE status = 'active'").all() as Array<{ d: string; c: string }>).map(
        (row) => `${row.d}|${row.c}`,
      ),
    );
    const expected = new Set(history.scheduled.map((s) => `${s.localDate}|${s.category}`));
    const missing = [...expected].filter((key) => !earned.has(key));
    const unexpected = [...earned].filter((key) => !expected.has(key));
    process.stdout.write(
      `${JSON.stringify(
        {
          persona: history.persona,
          range: [history.start, history.end],
          records: history.records.length,
          ingest: counts,
          scheduledCheckIns: expected.size,
          earnedCheckIns: earned.size,
          missing,
          unexpected,
          character: ledger.character(),
          pendingBonusRolls: ledger.bonusRolls("pending").length,
          dbPath: config.dbPath,
        },
        null,
        2,
      )}\n`,
    );
    break;
  }
  default:
    process.stderr.write("usage: cli.ts status|backup|synth|seed [flags]; see the header of src/cli.ts\n");
    process.exit(2);
}
