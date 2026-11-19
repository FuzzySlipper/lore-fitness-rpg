#!/usr/bin/env node
// Stage 3 runtime check against a scratch Marinara with the fitness module and a scratch
// ledger (serve-scratch-marinara.sh --persona ID), never Lore's installation:
//
//  - Turning the module on for a game writes the ledger's level and resources onto the
//    player's card in the game build and turns on the sighted dice pool.
//  - Each turn's fitness facts reach the game master, are locked to the player's message,
//    and are identical for regenerate and continue, even when new activity arrived since.
//  - A check-in logged between turns appears once, in the next turn only; its bonus roll is
//    thrown once with Marinara's dice; swipes add no grants.
//
// Usage: node fitness-turn.mjs --base http://127.0.0.1:7910 --ledger http://127.0.0.1:7912
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
const ledgerBase = (args.ledger ?? "http://127.0.0.1:7912").replace(/\/$/, "");
const mockLog = args["mock-log"];
assert.ok(mockLog, "--mock-log is required");
const results = [];

async function call(root, method, path, body) {
  const response = await fetch(`${root}${path}`, {
    method,
    headers: body ? { "content-type": "application/json" } : {},
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await response.text();
  if (!response.ok) throw new Error(`${method} ${path} -> ${response.status}: ${text.slice(0, 400)}`);
  return text.startsWith("{") || text.startsWith("[") ? JSON.parse(text) : text;
}
const api = (method, path, body) => call(base, method, path, body);
const ledger = (method, path, body) => call(ledgerBase, method, path, body);

function record(name, ok, detail) {
  results.push({ name, ok });
  process.stdout.write(`${ok ? "PASS" : "FAIL"} ${name}${detail ? ` — ${detail}` : ""}\n`);
}

const metadataOf = (chat) => (typeof chat.metadata === "string" ? JSON.parse(chat.metadata) : chat.metadata);
const readMeta = async (chatId) => metadataOf(await api("GET", `/api/chats/${chatId}`));
const lastMessage = async (chatId) => {
  const list = await api("GET", `/api/chats/${chatId}/messages`);
  return (Array.isArray(list) ? list : (list.messages ?? [])).at(-1);
};

/** The fitness block in the newest request the mock game master received. */
function lastFacts() {
  const lines = readFileSync(mockLog, "utf8").trim().split("\n");
  const request = JSON.parse(lines.at(-1));
  const text = request.messages.map((m) => (typeof m.content === "string" ? m.content : JSON.stringify(m.content))).join("\n");
  const match = text.match(/<fitness_facts[\s\S]*?<\/fitness_facts>/);
  return { facts: match?.[0] ?? null, requests: lines.length };
}

async function generate(chatId, extra) {
  const body = await api("POST", "/api/generate/", { chatId, streaming: true, ...extra });
  if (typeof body === "string" && body.includes('"type":"error"')) throw new Error(`generation error: ${body.slice(0, 400)}`);
  return lastMessage(chatId);
}

const connections = await api("GET", "/api/connections");
const mock = connections.find((c) => c.name === "Mock GM");
assert.ok(mock, "no Mock GM connection");
const persona = await api("POST", "/api/characters/personas", {
  name: "Evelyn Trevelyan",
  description: "Synthetic fixture Inquisitor.",
});
const created = await api("POST", "/api/game/create", {
  name: `Fitness turn ${new Date().toISOString()}`,
  connectionId: mock.id,
  personaId: persona.id,
  setupConfig: {
    genre: "Dark fantasy",
    setting: "Skyhold, synthetic fixture",
    tone: "Grim with warmth",
    difficulty: "normal",
    rating: "sfw",
    playerGoals: "Prepare for the Arbor Wilds",
    gmMode: "standalone",
    partyCharacterIds: [],
    personaId: persona.id,
  },
});
const chatId = created.sessionChat.id;
await api("POST", "/api/game/setup/apply-json", {
  chatId,
  rawJson: JSON.stringify({
    storyArc: "Synthetic arc.",
    worldOverview: "Synthetic Skyhold.",
    plotTwists: ["Synthetic twist."],
    startingNpcs: [{ name: "Cullen" }],
    characterCards: [{ name: "Evelyn Trevelyan" }, { name: "Cullen" }],
  }),
});

const before = await ledger("GET", "/v1/summary");
const enabled = await api("POST", `/api/fitness/chats/${chatId}/enable`, { enabled: true });
record("module enabled and ledger reachable", enabled.enabled === true && enabled.ledger.reachable === true);
record("rewards earned before enabling are not shown as new", (enabled.ledger.unappliedGrants ?? []).length === 0);
let meta = await readMeta(chatId);
const card = meta.gameCharacterCards.find((c) => c.name === "Evelyn Trevelyan");
const fields = card?.rulesetSheet?.build?.fields ?? {};
record(
  "player card carries the ledger's level and resources",
  fields.level === before.character.level && fields.xp === before.character.xp && fields.supplies === before.character.resources.supplies,
  JSON.stringify(fields),
);
record("sighted dice pool turned on", meta.gameOneRequestDice === true && meta.gameDicePoolMode === true);
const npc = meta.gameCharacterCards.find((c) => c.name === "Cullen");
record("other cards untouched", !npc?.rulesetSheet?.build?.fields?.xp);

const first = await generate(chatId, { userMessage: "I report to the training yard." });
const turn1 = lastFacts();
record("turn facts reach the game master", Boolean(turn1.facts), turn1.facts?.split("\n")[4]);

// Real activity arrives between generations of the same turn.
const logged = await api("POST", "/api/fitness/log", { entryId: randomUUID(), category: "strength", note: "fixture drill" });
record("manual check-in logged through Marinara", logged.status === "created", logged.effects?.at(-1));

await generate(chatId, { regenerateMessageId: first.id });
record("regenerate reuses the locked facts", lastFacts().facts === turn1.facts);
await generate(chatId, { continueMessageId: first.id });
record("continue reuses the locked facts", lastFacts().facts === turn1.facts);

const second = await generate(chatId, { userMessage: "I ask Cullen how the recruits are doing." });
const turn2 = lastFacts();
record("next turn reports the new check-in", /Strength check-in/.test(turn2.facts ?? ""), turn2.facts?.match(/- Strength[^\n]*/)?.[0]);
record("its bonus roll was thrown once by Marinara", /Bonus roll \d+ on 1d20 for Strength/.test(turn2.facts ?? ""));
await generate(chatId, { regenerateMessageId: second.id });
record("regenerate of the next turn reuses its facts", lastFacts().facts === turn2.facts);

const third = await generate(chatId, { userMessage: "I head to the war table." });
const turn3 = lastFacts();
record("a later turn does not repeat the check-in", !/Strength check-in/.test(turn3.facts ?? ""));

const strengthCheckIns = (await ledger("GET", `/v1/days/${logged.localDate}`)).categories.find((c) => c.category === "strength");
const rolls = (await ledger("GET", "/v1/bonus-rolls")).bonusRolls.filter((r) => r.checkInId === strengthCheckIns.checkIn?.id);
record("one check-in and one resolved roll in the ledger", strengthCheckIns.earned && rolls.length === 1 && rolls[0].status === "resolved" && rolls[0].resolvedBy === "marinara-dice");

meta = await readMeta(chatId);
const after = await ledger("GET", "/v1/summary");
const fieldsAfter = meta.gameCharacterCards.find((c) => c.name === "Evelyn Trevelyan").rulesetSheet.build.fields;
record("card follows the ledger after new activity", fieldsAfter.xp === after.character.xp, `xp ${before.character.xp} -> ${fieldsAfter.xp}`);
record("three locked turns recorded", Object.keys(meta.fitness.turns).length === 3);
void third;

const failed = results.filter((r) => !r.ok);
process.stdout.write(`\n${results.length - failed.length}/${results.length} checks passed (chat ${chatId}).\n`);
process.exit(failed.length ? 1 : 0);
