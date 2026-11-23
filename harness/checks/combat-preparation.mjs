#!/usr/bin/env node
// Stage 3 check that fitness preparation reaches a ruleset fight, against a scratch Marinara with the
// fitness module, a scratch ledger and the mock game master playing harness/mock-gm/combat-script.json
// (serve-scratch-marinara.sh --persona steady --script ...), never Lore's installation. The game must be
// a fresh warrior installed with content/install.mjs.
//
//  - Install: the warrior's attributes, the starting kit worn, two healing potions, and the talents
//    the journal's level reaches, each granted once and announced once in the locked facts.
//  - Fight: the Game Master's [combat] tag starts a fight the ruleset resolves. Health includes
//    Provisioned (unspent supplies), defense the worn armor, and an attack adds Seasoned (level)
//    and Drilled (unspent training). Talents and the potion are on the menu; the potion is used up.
//  - Choice: spending supplies and training at the war table lowers health and Drilled in the next
//    fight, so preparation is a trade rather than only a story claim.
//  - A talent the player removes is not added back by a later sync.
//  - Companions: each has a sheet at the Inquisitor's level with their class talents, fights beside
//    the player, and an ally the Game Master names who has no sheet stays out of the fight instead
//    of refusing it.
//  - Loot: a won fight drops the defeated creature's Inquisition loot table (workshop materials and
//    potions), never Game Mode's generic loot.
//
// Usage: node combat-preparation.mjs --base http://127.0.0.1:7910 --chat CHAT_ID
//          --mock-log DATA/mock-gm-requests.jsonl
// Synthetic fixture only.

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";

const args = Object.fromEntries(
  process.argv.slice(2).reduce((pairs, value, index, all) => {
    if (value.startsWith("--")) pairs.push([value.slice(2), all[index + 1]]);
    return pairs;
  }, []),
);
const base = (args.base ?? "http://127.0.0.1:7910").replace(/\/$/, "");
const chatId = args.chat;
const mockLog = args["mock-log"];
assert.ok(chatId && mockLog, "--chat and --mock-log are required");
const results = [];

async function api(method, path, body) {
  const response = await fetch(`${base}${path}`, {
    method,
    headers: body ? { "content-type": "application/json" } : {},
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await response.text();
  const parsed = text.startsWith("{") || text.startsWith("[") ? JSON.parse(text) : text;
  if (!response.ok) throw new Error(`${method} ${path} -> ${response.status}: ${text.slice(0, 300)}`);
  return parsed;
}
function record(name, ok, detail) {
  results.push({ name, ok });
  process.stdout.write(`${ok ? "PASS" : "FAIL"} ${name}${detail ? ` — ${detail}` : ""}\n`);
}

const chat = async () => api("GET", `/api/chats/${chatId}`);
const metadata = async () => {
  const value = (await chat()).metadata;
  return typeof value === "string" ? JSON.parse(value) : value;
};
const view = () => api("GET", `/api/fitness/chats/${chatId}`);
const playerCard = async () => {
  const meta = await metadata();
  return meta.gameCharacterCards.find((card) => card.name === meta.fitness?.playerCard);
};
const held = (meta, name) =>
  (meta.gameInventory ?? []).filter((stack) => stack.name === name).reduce((n, s) => n + s.quantity, 0);
function lastFacts() {
  const request = JSON.parse(readFileSync(mockLog, "utf8").trim().split("\n").at(-1));
  const text = request.messages.map((m) => (typeof m.content === "string" ? m.content : JSON.stringify(m.content))).join("\n");
  return text.match(/<fitness_facts[\s\S]*?<\/fitness_facts>/)?.[0] ?? "";
}
async function turn(userMessage) {
  const stream = await api("POST", "/api/generate/", { chatId, streaming: true, userMessage });
  if (typeof stream === "string" && stream.includes('"type":"error"')) throw new Error(`generation error: ${stream.slice(0, 300)}`);
  const list = await api("GET", `/api/chats/${chatId}/messages`);
  return (Array.isArray(list) ? list : list.messages).at(-1);
}

/** Start a fight on the anchor message as the client does: plain names and placeholder numbers, which
 *  a ruleset fight replaces with the sheet's and the bestiary's. The opponent is the bestiary's
 *  Red Templar Behemoth (70 health), so it lasts long enough to try every option. */
async function startFight(anchor, allies = [], enemy = "Red Templar Behemoth") {
  const { personaId } = await chat();
  const placeholder = { hp: 60, maxHp: 60, attack: 10, defense: 6, speed: 6, level: 1 };
  const started = await api("POST", "/api/game/combat/director/start", {
    chatId,
    anchor,
    style: "ruleset",
    party: [
      { id: `persona:${personaId}`, name: (await playerCard()).name, ...placeholder, side: "player" },
      ...allies.map((name, i) => ({ id: `ally-${i}`, name, ...placeholder, side: "player" })),
    ],
    enemies: [{ id: "enemy-0", name: enemy, hp: 44, maxHp: 44, attack: 11, defense: 6, speed: 6, level: 3, side: "enemy" }],
  });
  return { anchor, session: started.session, playerId: `persona:${personaId}` };
}
async function command(fight, cmd) {
  const answer = await api("POST", "/api/game/combat/director/command", {
    chatId,
    anchor: fight.anchor,
    id: fight.session.id,
    instanceId: fight.session.instanceId,
    revision: fight.session.revision,
    requestId: randomUUID(),
    command: cmd,
  });
  fight.session = answer.session;
  return fight.session;
}
/** Let opponents act until it is the player's turn (or the fight is over). */
async function untilPlayer(fight) {
  for (let i = 0; i < 12 && fight.session.ruleset.actorId !== fight.playerId && fight.session.stage !== "done"; i++) {
    await command(fight, { type: "continue" });
  }
  return api("GET", `/api/game/combat/director/state?chatId=${chatId}&anchor=${fight.anchor}`).then((state) => {
    fight.session = state.session;
    return fight.session.ruleset.options ?? [];
  });
}
const player = (fight) => fight.session.ruleset.combatants.find((c) => c.id === fight.playerId);
/** The last attack the player made with this option, as the fight recorded it. */
const lastAttack = (fight, label) =>
  fight.session.ruleset.events
    .map((entry) => entry.event)
    .filter((event) => event.type === "attack" && event.actorId === fight.playerId && event.label === label)
    .at(-1);
const drilledOf = (event) =>
  (event?.bonuses ?? []).filter((b) => b.condition === "drilled").reduce((n, b) => n + b.value, 0);
const describe = (event) => (event ? `d20 ${event.kept} + ${event.modifier}, Drilled ${drilledOf(event)}, total ${event.total}` : "no attack");

// 0. What the installer and the first sync put on the sheet.
const fitness = (await view()).character;
let card = await playerCard();
let build = card.rulesetSheet.build;
let meta = await metadata();
record("warrior attributes from the installer", build.fields.class === "warrior" && build.abilities.strength === 3 && build.abilities.constitution === 2);
const worn = (meta.gameInventory ?? []).filter((stack) => stack.equipped).map((stack) => stack.name);
record("starting kit worn", ["Inquisition longsword", "Heater shield", "Inquisition chainmail"].every((n) => worn.includes(n)), worn.join(", "));
record("two healing potions", held(meta, "Healing potion") === 2);
const talentNames = () => (build.lists.talents ?? []).map((row) => row.name);
const expectedTalents = meta.fitnessCampaign.progression.talents.filter((t) => t.classes.includes("warrior") && t.level <= fitness.level);
record(
  "talents the level reaches are on the sheet, marked from the catalog",
  expectedTalents.every((t) => talentNames().includes(t.name)) && build.lists.talents.every((row) => String(row._catalog).startsWith("talent_trees/")),
  `level ${fitness.level}: ${talentNames().join(", ")}`,
);

// 1. A turn announces the talents once; the Game Master's reply starts a fight.
const fightTurn = await turn("I draw my sword as the gate opens.");
const facts = lastFacts();
record("the turn's locked facts announce each new talent", expectedTalents.every((t) => facts.includes(`New talent at level ${t.level}: ${t.name}.`)));
record("the Game Master's reply asks for a fight", /\[combat: enemies="Venatori Gladiator"\]/.test(fightTurn.content));

// 2. The fight reads the sheet.
const supplies = fitness.resources.supplies;
const training = fitness.resources.training;
const provisioned = (s) => (s >= 15 ? 12 : s >= 10 ? 8 : s >= 5 ? 4 : 0);
const drilled = (t) => (t >= 8 ? 2 : t >= 4 ? 1 : 0);
const seasoned = (level) => (level >= 16 ? 4 : level >= 12 ? 3 : level >= 8 ? 2 : level >= 4 ? 1 : 0);
const healthMax = (s) => 20 + 4 * build.abilities.constitution + 5 * fitness.level + provisioned(s);
let fight = await startFight(fightTurn.id);
record("the fight is resolved by the ruleset", fight.session.style === "ruleset");
record("health includes Provisioned", player(fight).health.max === healthMax(supplies), `${player(fight).health.max} (supplies ${supplies})`);
record("defense includes the worn armor", player(fight).defense === 10 + build.abilities.dexterity + 2 + 3, `${player(fight).defense}`);
let options = await untilPlayer(fight);
const labels = options.map((o) => o.label);
record("the longsword is an attack", options.some((o) => o.kind === "attack" && o.label === "Inquisition longsword"));
record("talents are on the menu", expectedTalents.every((t) => labels.includes(t.name)), labels.filter((l) => !/^(dodge|help|End turn)$/.test(l)).join(", "));
record("the potion is on the menu with two left", options.some((o) => o.label === "Healing potion" && o.left === 2));

const attack = options.find((o) => o.label === "Inquisition longsword");
await command(fight, { type: "ruleset", optionId: attack.id, targetIds: attack.targetIds.slice(0, 1) });
const bonus = build.abilities.strength + seasoned(fitness.level);
const first = lastAttack(fight, "Inquisition longsword");
record(
  "the attack adds Strength with Seasoned, and Drilled",
  first?.modifier === bonus && drilledOf(first) === drilled(training),
  describe(first),
);
await command(fight, { type: "ruleset", optionId: "end-turn", targetIds: [] });
options = await untilPlayer(fight);
const potion = options.find((o) => o.label === "Healing potion");
if (potion) await command(fight, { type: "ruleset", optionId: potion.id, targetIds: [fight.playerId] });
record("drinking the potion uses one up", Boolean(potion) && held(await metadata(), "Healing potion") === 1);
await command(fight, { type: "ruleset", optionId: "end-turn", targetIds: [] });
options = await untilPlayer(fight);
const blow = options.find((o) => o.label === "Mighty Blow");
if (blow) await command(fight, { type: "ruleset", optionId: blow.id, targetIds: blow.targetIds.slice(0, 1) });
const blowEvent = lastAttack(fight, "Mighty Blow");
record(
  "a talent's attack adds talent power with Seasoned, and Drilled",
  blowEvent?.modifier === bonus && drilledOf(blowEvent) === drilled(training),
  describe(blowEvent),
);

// 3. Spending at the war table is a trade: the next fight has less health and less Drilled.
const order = async (id) => api("POST", `/api/fitness/chats/${chatId}/war-table`, { id, idempotencyKey: randomUUID() });
await order("audit-the-stores");
await order("drill-the-garrison");
await order("storm-coast-patrols");
const after = (await view()).character.resources;
card = await playerCard();
build = card.rulesetSheet.build;
record("the card follows the spends", build.fields.supplies === after.supplies && build.fields.training === after.training, `supplies ${after.supplies}, training ${after.training}`);
const secondTurn = await turn("I draw my sword again at the next ambush.");
fight = await startFight(secondTurn.id);
record("the next fight's health follows the supplies left", player(fight).health.max === healthMax(after.supplies), `${player(fight).health.max}`);
options = await untilPlayer(fight);
const attack2 = options.find((o) => o.label === "Inquisition longsword");
await command(fight, { type: "ruleset", optionId: attack2.id, targetIds: attack2.targetIds.slice(0, 1) });
const second = lastAttack(fight, "Inquisition longsword");
record("the next attack's Drilled follows the training left", second?.modifier === bonus && drilledOf(second) === drilled(after.training), describe(second));

// 4. Granted once: a talent the player removes stays removed after another sync.
const cards = (await metadata()).gameCharacterCards.map((c) =>
  c.name === card.name
    ? { ...c, rulesetSheet: { ...c.rulesetSheet, build: { ...c.rulesetSheet.build, lists: { ...c.rulesetSheet.build.lists, talents: c.rulesetSheet.build.lists.talents.filter((r) => r.name !== "War Cry") } } } }
    : c,
);
await api("PATCH", `/api/chats/${chatId}/metadata`, { gameCharacterCards: cards });
await api("POST", `/api/fitness/chats/${chatId}/sync`);
build = (await playerCard()).rulesetSheet.build;
record("a removed talent is not added back", !talentNames().includes("War Cry") && talentNames().length === expectedTalents.length - 1);
await turn("We regroup in the courtyard.");
record("talents are announced only once", !lastFacts().includes("New talent at level"));

// 5. Companions fight beside the Inquisitor, at the same level, with their own kit and talents.
meta = await metadata();
const level = (await view()).character.level;
const companionCards = meta.fitnessCampaign.companions.map((c) => ({ pack: c, card: meta.gameCharacterCards.find((card) => card.name === c.cardName) }));
record(
  "every companion has a sheet at the Inquisitor's level",
  companionCards.every(({ card }) => card?.rulesetSheet?.build?.fields?.level === level),
  companionCards.map(({ pack, card }) => `${pack.cardName} ${card?.rulesetSheet?.build?.fields?.class ?? "?"} ${card?.rulesetSheet?.build?.fields?.level ?? "?"}`).join(", "),
);
const cassandra = companionCards.find(({ pack }) => pack.id === "cassandra").card;
const cassandraTalents = (cassandra.rulesetSheet.build.lists.talents ?? []).map((row) => row.name);
record("companions get their class talents, without announcing them", cassandraTalents.includes("Rally") && !lastFacts().includes("Cassandra"), cassandraTalents.join(", "));
const companionWorn = (meta.gameInventory ?? []).filter((stack) => stack.holder === cassandra.name && stack.equipped).map((stack) => stack.name);
record("companions wear their own kit", companionWorn.includes("Inquisition longsword") && companionWorn.includes("Inquisition chainmail"), companionWorn.join(", "));
const thirdTurn = await turn("I draw my sword beside Cassandra.");
fight = await startFight(thirdTurn.id, ["Cassandra Pentaghast", "Recruit Tamsin"]); // named more fully than her card
const ally = fight.session.ruleset.combatants.find((c) => c.name === cassandra.name);
record("a companion named more fully than her card fights with her sheet and her own kit", Boolean(ally) && ally.defense === 10 + cassandra.rulesetSheet.build.abilities.dexterity + 5, ally ? `health ${ally.health.max}, Defense ${ally.defense}` : "not in the fight");
record(
  "an ally with no sheet stays out instead of refusing the fight",
  !fight.session.ruleset.combatants.some((c) => c.name === "Recruit Tamsin") &&
    !fight.session.party.some((p) => p.name === "Recruit Tamsin") &&
    (fight.session.ruleset.adjustments ?? []).some((line) => line.includes("Recruit Tamsin")),
);

// 6. A won fight drops the creature's own loot table: a Shade leaves elfroot or a potion.
const lootTurn = await turn("I draw my sword as something stirs in the Fade-touched cellar.");
fight = await startFight(lootTurn.id, [], "Shade");
const bagBefore = new Map(((await metadata()).gameInventory ?? []).map((stack) => [stack.id, stack.quantity]));
for (let round = 0; round < 20 && fight.session.stage !== "finished" && !fight.session.outcome; round++) {
  options = await untilPlayer(fight);
  if (fight.session.stage === "finished" || fight.session.outcome) break;
  const swing = options.find((o) => o.label === "Inquisition longsword");
  if (swing) await command(fight, { type: "ruleset", optionId: swing.id, targetIds: swing.targetIds.slice(0, 1) });
  if (fight.session.stage !== "finished" && !fight.session.outcome) await command(fight, { type: "ruleset", optionId: "end-turn", targetIds: [] });
}
const bagAfter = (await metadata()).gameInventory ?? [];
const gained = bagAfter.filter((stack) => stack.quantity > (bagBefore.get(stack.id) ?? 0)).map((stack) => stack.name);
record(
  "a won fight drops the creature's Inquisition loot",
  fight.session.outcome === "victory" && gained.length > 0 && gained.every((name) => ["Elfroot", "Healing potion"].includes(name)),
  `${fight.session.outcome ?? fight.session.stage}; gained ${gained.join(", ") || "nothing"}`,
);

const failed = results.filter((r) => !r.ok).length;
process.stdout.write(`\n${results.length - failed}/${results.length} checks passed\n`);
process.exitCode = failed ? 1 : 0;
