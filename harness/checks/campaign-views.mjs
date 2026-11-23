#!/usr/bin/env node
// Stage 3 check of the Training panel's campaign views against a scratch Marinara with the
// fitness module, a scratch ledger and the mock game master (serve-scratch-marinara.sh
// --persona steady), never Lore's installation. The game must be installed with
// content/install.mjs, which stores the campaign pack on the chat.
//
//  - War table: a project open in the current act spends its cost once in the ledger; a retry
//    with the same key spends nothing more; ordering it again, or a later act's project, is
//    refused. Its report reaches the next turn's locked facts once, a regenerate reads the same
//    facts, and the turn after does not repeat it.
//  - Workshop: a recipe spends supplies and puts the item in Game Mode's inventory, using
//    materials from the pack; one whose materials are missing is refused before anything is spent.
//  - Campaign: setting the act and marking a mission done reach every later turn's facts.
//
// Usage: node campaign-views.mjs --base http://127.0.0.1:7910 --chat CHAT_ID
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
  if (!response.ok) {
    const error = new Error(`${method} ${path} -> ${response.status}: ${text.slice(0, 300)}`);
    error.status = response.status;
    throw error;
  }
  return parsed;
}
const refused = (promise) => promise.then(() => null, (error) => error.status ?? 0);
function record(name, ok, detail) {
  results.push({ name, ok });
  process.stdout.write(`${ok ? "PASS" : "FAIL"} ${name}${detail ? ` — ${detail}` : ""}\n`);
}

const view = () => api("GET", `/api/fitness/chats/${chatId}`);
const supplies = async () => (await view()).character.resources.supplies;
const metadata = async () => {
  const chat = await api("GET", `/api/chats/${chatId}`);
  return typeof chat.metadata === "string" ? JSON.parse(chat.metadata) : chat.metadata;
};
const held = async (name) =>
  ((await metadata()).gameInventory ?? []).filter((stack) => stack.name === name).reduce((n, s) => n + s.quantity, 0);
function lastFacts() {
  const request = JSON.parse(readFileSync(mockLog, "utf8").trim().split("\n").at(-1));
  const text = request.messages.map((m) => (typeof m.content === "string" ? m.content : JSON.stringify(m.content))).join("\n");
  return text.match(/<fitness_facts[\s\S]*?<\/fitness_facts>/)?.[0] ?? "";
}
async function turn(body) {
  const stream = await api("POST", "/api/generate/", { chatId, streaming: true, ...body });
  if (typeof stream === "string" && stream.includes('"type":"error"')) throw new Error(`generation error: ${stream.slice(0, 300)}`);
  const list = await api("GET", `/api/chats/${chatId}/messages`);
  return (Array.isArray(list) ? list : list.messages).at(-1);
}

// 0. The pack is on the game.
let current = await view();
const pack = current.campaign?.pack;
record(
  "campaign pack installed on the game",
  Boolean(pack) && pack.projects.length > 0 && pack.recipes.length > 0 && pack.companions.length === 8,
  pack ? `${pack.projects.length} projects, ${pack.recipes.length} recipes, ${pack.season.acts.length} acts` : "none",
);
record("game starts in act 1", current.campaign?.state.act === 1);

// 1. War table.
const project = pack.projects.find((p) => p.id === "audit-the-stores");
const later = pack.projects.find((p) => p.act === 2);
const key = randomUUID();
let before = await supplies();
await api("POST", `/api/fitness/chats/${chatId}/war-table`, { id: project.id, idempotencyKey: key });
let after = await supplies();
record("project spends its cost once", before - after === project.cost.amount, `${before} → ${after}`);
const replay = await api("POST", `/api/fitness/chats/${chatId}/war-table`, { id: project.id, idempotencyKey: key });
record("retry with the same key spends nothing", replay.replayed === true && (await supplies()) === after);
record(
  "ordering a done project again is refused",
  (await refused(api("POST", `/api/fitness/chats/${chatId}/war-table`, { id: project.id, idempotencyKey: randomUUID() }))) === 409,
);
record(
  "a later act's project is refused",
  (await refused(api("POST", `/api/fitness/chats/${chatId}/war-table`, { id: later.id, idempotencyKey: randomUUID() }))) === 409,
  later.name,
);

// 2. Workshop.
before = await supplies();
await api("POST", `/api/fitness/chats/${chatId}/craft`, { id: "elfroot-from-the-garden", idempotencyKey: randomUUID() });
record("recipe puts the item in the inventory", (await held("Elfroot")) === 2 && before - (await supplies()) === 1);
await api("POST", `/api/fitness/chats/${chatId}/craft`, { id: "healing-potions", idempotencyKey: randomUUID() });
record("recipe uses materials from the pack", (await held("Elfroot")) === 1 && (await held("Healing potion")) === 2);
before = await supplies();
const noIron = await refused(api("POST", `/api/fitness/chats/${chatId}/craft`, { id: "forge-chainmail", idempotencyKey: randomUUID() }));
record("missing materials refuse before spending", noIron === 409 && (await supplies()) === before);
record("panel counts pending results", (await view()).campaign.state.pending === 3);

// 3. The next turn's locked facts carry the results once.
const first = await turn({ userMessage: "I go to the war room to hear the reports." });
const firstFacts = lastFacts();
record(
  "next turn's facts carry the report and the workshop",
  firstFacts.includes(project.report.slice(0, 60)) && firstFacts.includes("2 × Healing potion") && firstFacts.includes("Campaign: act 1 of 3"),
);
await turn({ regenerateMessageId: first.id });
record("regenerate reads the same facts", lastFacts() === firstFacts);
record("pending results are cleared once locked", (await view()).campaign.state.pending === 0);

// 4. Campaign progress.
const mission = pack.missions.find((m) => m.id === "a1-tampered-ledger");
await api("POST", `/api/fitness/chats/${chatId}/campaign`, { mission: { id: mission.id, done: true } });
await api("POST", `/api/fitness/chats/${chatId}/campaign`, { act: 2 });
current = await view();
record("act and mission saved", current.campaign.state.act === 2 && current.campaign.state.missionsDone.includes(mission.id));
await turn({ userMessage: "We ride for the Fallow Mire." });
const nextFacts = lastFacts();
record(
  "later turn states the act and missions, without repeating the report",
  nextFacts.includes("act 2 of 3, Red Lyrium Roads") && nextFacts.includes(mission.name) && !nextFacts.includes(project.report.slice(0, 60)),
);
record(
  "a project opens with its act",
  (await refused(api("POST", `/api/fitness/chats/${chatId}/war-table`, { id: later.id, idempotencyKey: randomUUID() }))) === null,
  later.name,
);

const failed = results.filter((r) => !r.ok).length;
process.stdout.write(`\n${results.length - failed}/${results.length} checks passed\n`);
process.exitCode = failed ? 1 : 0;
