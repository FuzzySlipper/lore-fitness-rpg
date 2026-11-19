// Synthetic activity histories for internal playtests and tests. Expands a
// persona from harness/personas.json into the activity records the phone, watch
// and manual entry would send, each with the time it would be delivered.
// All output is synthetic.

import { addDays, zonedTimeToInstant } from "./dates.ts";
import { CATEGORIES } from "./rules.ts";
import type { Category } from "./rules.ts";
import type { ActivityInput } from "./ledger.ts";

export interface Persona {
  id: string;
  description?: string;
  weeks: number;
  week: string[][];
  weekOverrides?: Record<string, string[][]>;
  dayOverrides?: Record<string, string[]>;
  sources?: Record<string, string[]>;
}

export interface SyntheticOptions {
  /** First day of the history (YYYY-MM-DD); persona week patterns start on this day. */
  start: string;
  timeZone: string;
  seed?: number;
  stepGoal?: number;
  hydrationGoalMl?: number;
  /** Add realistic delivery noise: resent duplicates, revised step totals, late manual entries. */
  noise?: boolean;
  clientPrefix?: string;
}

export interface SyntheticRecord extends ActivityInput {
  deliveredAt: string;
  /** Why the generator produced this record (for harness reports). */
  synthetic: string;
}

export interface SyntheticHistory {
  persona: string;
  start: string;
  end: string;
  /** The (date, category) pairs the persona completed: the expected check-ins. */
  scheduled: Array<{ localDate: string; category: Category }>;
  records: SyntheticRecord[];
}

function mulberry32(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function inRange(spec: string, index: number): boolean {
  const [from, to] = spec.split("-").map(Number);
  return index >= from && index <= (Number.isFinite(to) ? to : from);
}

/** Categories the persona completes on day `index` of its history. */
export function personaDay(persona: Persona, index: number): string[] {
  for (const [spec, categories] of Object.entries(persona.dayOverrides ?? {})) if (inRange(spec, index)) return categories;
  const week = persona.weekOverrides?.[String(Math.floor(index / 7))] ?? persona.week;
  return week[index % 7] ?? [];
}

const MANUAL_KIND: Record<Category, string> = {
  moved: "walk",
  strength: "strength",
  mobility: "mobility",
  meal: "meal-habit",
  hydration: "hydration",
  rest: "recovery-day",
};

export function generateHistory(persona: Persona, options: SyntheticOptions): SyntheticHistory {
  const random = mulberry32(options.seed ?? 1);
  const between = (low: number, high: number) => Math.floor(low + random() * (high - low + 1));
  const chance = (p: number) => random() < p;
  const pick = <T>(items: T[]) => items[Math.floor(random() * items.length)];
  const stepGoal = options.stepGoal ?? 6000;
  const hydrationGoalMl = options.hydrationGoalMl ?? 2000;
  const tz = options.timeZone;
  const client = options.clientPrefix ?? "synthetic";
  const at = (date: string, hour: number, minute: number) => zonedTimeToInstant(date, `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`, tz);
  const later = (instant: Date, minutes: number) => new Date(instant.getTime() + minutes * 60000).toISOString();
  const usesPhoneSteps = Object.values(persona.sources ?? {}).some((list) => list.includes("ohealth-steps"));

  const records: SyntheticRecord[] = [];
  const scheduled: SyntheticHistory["scheduled"] = [];
  const days = persona.weeks * 7;

  for (let index = 0; index < days; index += 1) {
    const date = addDays(options.start, index);
    const categories = personaDay(persona, index).filter((c): c is Category => (CATEGORIES as readonly string[]).includes(c));
    let stepsEmitted = false;

    for (const category of categories) {
      scheduled.push({ localDate: date, category });
      const source = pick(persona.sources?.[category] ?? ["manual"]);
      const reason = `${persona.id} day ${index}: ${category} via ${source}`;

      if (source === "ohealth-steps") {
        const end = at(date, 23, 50);
        const steps = between(stepGoal + 300, stepGoal + 6000);
        records.push({
          source: "ohealth",
          sourceRecordId: `steps-${date}`,
          revision: 1,
          clientId: `${client}-phone`,
          kind: "steps",
          start: at(date, 0, 0).toISOString(),
          end: end.toISOString(),
          timeZone: tz,
          quantities: { steps },
          deliveredAt: later(end, between(5, 60)),
          synthetic: reason,
        });
        stepsEmitted = true;
        continue;
      }

      if (source === "watch-quick" || source === "phone-quick" || (category === "hydration" && source !== "manual")) {
        const device = source === "phone-quick" ? "phone" : "watch";
        const glasses = Math.ceil(hydrationGoalMl / 250);
        for (let glass = 0; glass < glasses; glass += 1) {
          const time = at(date, 8 + Math.floor((glass * 12) / glasses), between(0, 50));
          records.push({
            source: device,
            sourceRecordId: `water-${date}-${glass}`,
            revision: 1,
            clientId: `${client}-${device}`,
            kind: "hydration",
            start: time.toISOString(),
            timeZone: tz,
            quantities: { amountMl: 250 },
            deliveredAt: later(time, between(1, 20)),
            synthetic: reason,
          });
        }
        continue;
      }

      if (source === "manual") {
        const time = at(date, between(7, 20), between(0, 59));
        const late = options.noise && chance(0.12);
        const record: SyntheticRecord = {
          source: "manual",
          sourceRecordId: `manual-${persona.id}-${date}-${category}`,
          revision: 1,
          clientId: `${client}-phone`,
          kind: MANUAL_KIND[category],
          // Late entries are backdated day-level entries, the way a forgotten log is added.
          start: late ? date : time.toISOString(),
          timeZone: tz,
          quantities: category === "moved" || category === "strength" || category === "mobility" ? { durationMin: between(10, 45) } : {},
          deliveredAt: late ? later(at(addDays(date, between(1, 3)), 20, 0), 0) : later(time, between(0, 10)),
          synthetic: late ? `${reason} (logged late)` : reason,
        };
        if (category === "hydration") {
          record.category = "hydration";
          record.kind = "manual";
          record.quantities = { goalMet: true };
        }
        records.push(record);
        continue;
      }

      // ohealth-walk, watch-drill and other session sources.
      const watch = source.startsWith("watch");
      const startTime = at(date, between(6, 19), between(0, 59));
      const duration = category === "moved" ? between(20, 60) : between(10, 30);
      const end = new Date(startTime.getTime() + duration * 60000);
      records.push({
        source: watch ? "watch" : "ohealth",
        sourceRecordId: `${watch ? "drill" : "session"}-${date}-${category}`,
        revision: 1,
        clientId: `${client}-${watch ? "watch" : "phone"}`,
        kind: category === "moved" ? pick(["walk", "walk", "cycle", "hike"]) : MANUAL_KIND[category],
        start: startTime.toISOString(),
        end: end.toISOString(),
        timeZone: tz,
        quantities: { durationMin: duration },
        deliveredAt: later(end, watch ? between(1, 5) : between(10, 120)),
        synthetic: reason,
      });
    }

    // The phone counts steps every day it is carried; below-goal totals must not count.
    const active = categories.length > 0;
    if (usesPhoneSteps && active && !stepsEmitted) {
      const end = at(date, 23, 50);
      records.push({
        source: "ohealth",
        sourceRecordId: `steps-${date}`,
        revision: 1,
        clientId: `${client}-phone`,
        kind: "steps",
        start: at(date, 0, 0).toISOString(),
        end: end.toISOString(),
        timeZone: tz,
        quantities: { steps: between(800, Math.max(900, stepGoal - 1500)) },
        deliveredAt: later(end, between(5, 60)),
        synthetic: `${persona.id} day ${index}: below-goal steps`,
      });
    }
  }

  if (options.noise) {
    const extra: SyntheticRecord[] = [];
    for (const record of records) {
      if (chance(0.08)) {
        extra.push({ ...record, deliveredAt: later(new Date(record.deliveredAt), between(30, 600)), synthetic: `${record.synthetic} (resent duplicate)` });
      }
      if (record.kind === "steps" && chance(0.15)) {
        // Health Connect revises a day's total after the phone syncs late steps.
        const steps = (record.quantities?.steps as number) + between(50, 900);
        extra.push({
          ...record,
          revision: 2,
          quantities: { steps },
          deliveredAt: later(new Date(record.deliveredAt), between(240, 900)),
          synthetic: `${record.synthetic} (revised total)`,
        });
      }
    }
    records.push(...extra);
  }

  records.sort((a, b) => a.deliveredAt.localeCompare(b.deliveredAt));
  return { persona: persona.id, start: options.start, end: addDays(options.start, days - 1), scheduled, records };
}
