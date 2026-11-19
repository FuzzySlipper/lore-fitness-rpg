// Versioned activity-to-reward rules. Numbers are balancing placeholders, not
// fitness advice; tuned values and the rule version are recorded in
// docs/02-durable-mechanics.md. A grant keeps the rule version that produced it,
// and a rules change never reinterprets earlier grants.

export const CATEGORIES = ["moved", "strength", "mobility", "meal", "hydration", "rest"] as const;
export type Category = (typeof CATEGORIES)[number];

export const RESOURCES = ["supplies", "training", "reroll"] as const;
export type ResourceName = (typeof RESOURCES)[number];

export type Aggregate = "steps" | "hydration";

export interface KindRule {
  category: Category;
  /** Aggregated kinds count toward a daily goal instead of qualifying on their own. */
  aggregate?: Aggregate;
}

export interface RuleSet {
  version: number;
  /** XP for each earned daily check-in. */
  baseXp: number;
  /** Ceiling on check-in XP per local day. */
  dailyXpCap: number;
  /** Level L needs levelStepXp * L * (L - 1) / 2 total XP. */
  levelStepXp: number;
  maxLevel: number;
  categoryResource: Record<Category, ResourceName>;
  /** At or above this unspent balance a check-in grants no more of that resource. */
  resourceSoftCap: Record<ResourceName, number>;
  bonusRoll: { notation: string; sides: number; luckyAtLeast: number; luckyAmount: number };
  kinds: Record<string, KindRule>;
}

export const CATEGORY_LABELS: Record<Category, string> = {
  moved: "Moved",
  strength: "Strength",
  mobility: "Mobility",
  meal: "Meal habit",
  hydration: "Hydration goal",
  rest: "Rest and recovery",
};

const movement: KindRule = { category: "moved" };

export const RULES_V1: RuleSet = {
  version: 1,
  baseXp: 20,
  dailyXpCap: 120,
  levelStepXp: 100,
  maxLevel: 20,
  categoryResource: {
    moved: "supplies",
    meal: "supplies",
    hydration: "supplies",
    strength: "training",
    mobility: "training",
    rest: "reroll",
  },
  resourceSoftCap: { supplies: 15, training: 10, reroll: 3 },
  bonusRoll: { notation: "1d20", sides: 20, luckyAtLeast: 18, luckyAmount: 1 },
  kinds: {
    walk: movement,
    run: movement,
    hike: movement,
    cycle: movement,
    swim: movement,
    wheelchair: movement,
    dance: movement,
    sport: movement,
    elliptical: movement,
    rowing: movement,
    movement,
    steps: { category: "moved", aggregate: "steps" },
    strength: { category: "strength" },
    resistance: { category: "strength" },
    bodyweight: { category: "strength" },
    mobility: { category: "mobility" },
    stretch: { category: "mobility" },
    yoga: { category: "mobility" },
    pilates: { category: "mobility" },
    "meal-habit": { category: "meal" },
    hydration: { category: "hydration", aggregate: "hydration" },
    "recovery-day": { category: "rest" },
    recovery: { category: "rest" },
    meditation: { category: "rest" },
    rest: { category: "rest" },
  },
};

export const CURRENT_RULES = RULES_V1;

export function isCategory(value: unknown): value is Category {
  return typeof value === "string" && (CATEGORIES as readonly string[]).includes(value);
}

export function isResource(value: unknown): value is ResourceName {
  return typeof value === "string" && (RESOURCES as readonly string[]).includes(value);
}

export function xpForLevel(rules: RuleSet, level: number): number {
  return (rules.levelStepXp * level * (level - 1)) / 2;
}

export function levelForXp(rules: RuleSet, xp: number): number {
  let level = 1;
  while (level < rules.maxLevel && xp >= xpForLevel(rules, level + 1)) level += 1;
  return level;
}

export function resolveCategory(rules: RuleSet, kind: string, explicit: Category | null): Category | null {
  return explicit ?? rules.kinds[kind]?.category ?? null;
}

export function aggregateOf(rules: RuleSet, kind: string, explicit: Category | null): Aggregate | undefined {
  const rule = rules.kinds[kind];
  if (!rule?.aggregate) return undefined;
  // An explicit category that differs from the kind's turns the record into a plain session.
  if (explicit && explicit !== rule.category) return undefined;
  return rule.aggregate;
}

export interface Settings {
  stepGoal: number;
  hydrationGoalMl: number;
  mealHabit: string;
  timeZone: string;
}

export interface DayActivity {
  id: string;
  source: string;
  kind: string;
  explicitCategory: Category | null;
  quantities: Record<string, unknown>;
}

export interface CategoryEvaluation {
  qualifies: boolean;
  /** Activities that support the check-in, in arrival order. */
  supporting: string[];
  detail: string;
}

const num = (value: unknown) => (typeof value === "number" && Number.isFinite(value) ? value : 0);

/** Whether a category is earned on one local day, from that day's live activities in the category. */
export function evaluateCategory(
  rules: RuleSet,
  settings: Settings,
  category: Category,
  activities: DayActivity[],
): CategoryEvaluation {
  const sessions = activities.filter((a) => aggregateOf(rules, a.kind, a.explicitCategory) === undefined);
  const supporting = sessions.map((a) => a.id);
  const notes: string[] = [];
  let qualifies = sessions.length > 0;

  const stepRecords = activities.filter((a) => aggregateOf(rules, a.kind, a.explicitCategory) === "steps");
  if (stepRecords.length > 0) {
    // Device step totals overlap (watch and phone both count the same walk), so
    // the best single source counts, not the sum across sources.
    const bySource = new Map<string, { steps: number; ids: string[] }>();
    for (const record of stepRecords) {
      const entry = bySource.get(record.source) ?? { steps: 0, ids: [] };
      entry.steps += num(record.quantities.steps);
      entry.ids.push(record.id);
      bySource.set(record.source, entry);
    }
    const best = [...bySource.values()].sort((a, b) => b.steps - a.steps)[0];
    notes.push(`${best.steps.toLocaleString("en-US")} of ${settings.stepGoal.toLocaleString("en-US")} steps`);
    if (best.steps >= settings.stepGoal) {
      qualifies = true;
      supporting.push(...best.ids);
    }
  }

  const waterRecords = activities.filter((a) => aggregateOf(rules, a.kind, a.explicitCategory) === "hydration");
  if (waterRecords.length > 0) {
    // Separate drinks logged on different devices are different drinks, so they add up.
    const goalMet = waterRecords.some((a) => a.quantities.goalMet === true);
    const total = waterRecords.reduce((sum, a) => sum + num(a.quantities.amountMl), 0);
    notes.push(goalMet ? "goal marked met" : `${total} of ${settings.hydrationGoalMl} ml`);
    if (goalMet || total >= settings.hydrationGoalMl) {
      qualifies = true;
      supporting.push(...waterRecords.map((a) => a.id));
    }
  }

  if (sessions.length > 0) notes.unshift(`${sessions.length} session${sessions.length === 1 ? "" : "s"}`);
  return { qualifies, supporting, detail: notes.join(", ") || "nothing logged" };
}
