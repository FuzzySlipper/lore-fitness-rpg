#!/usr/bin/env node
// Stage 3 recovery check against a scratch Marinara with the fitness module and its scratch
// ledger (serve-scratch-marinara.sh --persona ID), never Lore's installation. It stops and
// restores the SCRATCH ledger itself:
//
//  - Ledger down: a turn still generates, carries no fitness facts, and locks nothing; the
//    panel reports the journal unreachable.
//  - Ledger restored from an older backup: the game notices the journal is behind what it
//    already saw, stops writing the card and adding facts, and resumes from the restored
//    journal only when the player accepts it.
//
// Usage: node fitness-recovery.mjs --base http://127.0.0.1:7910 --ledger-port 7912
//          --ledger-data DATA/ledger --mock-log DATA/mock-gm-requests.jsonl [--service DIR]
// Synthetic fixture only.

import assert from "node:assert/strict";
import { execFileSync, spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { copyFileSync, readFileSync, rmSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const args = Object.fromEntries(
  process.argv.slice(2).reduce((pairs, value, index, all) => {
    if (value.startsWith("--")) pairs.push([value.slice(2), all[index + 1]]);
    return pairs;
  }, []),
);
const base = (args.base ?? "http://127.0.0.1:7910").replace(/\/$/, "");
const ledgerPort = Number(args["ledger-port"] ?? 7912);
const ledgerBase = `http://127.0.0.1:${ledgerPort}`;
const ledgerData = resolve(args["ledger-data"] ?? "");
const mockLog = args["mock-log"];
const serviceDir = resolve(args.service ?? join(dirname(fileURLToPath(import.meta.url)), "../../service"));
assert.ok(args["ledger-data"] && mockLog, "--ledger-data and --mock-log are required");
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
function lastFacts() {
  const lines = readFileSync(mockLog, "utf8").trim().split("\n");
  const text = JSON.parse(lines.at(-1)).messages.map((m) => (typeof m.content === "string" ? m.content : "")).join("\n");
  return text.match(/<fitness_facts[\s\S]*?<\/fitness_facts>/)?.[0] ?? null;
}
async function turn(chatId, userMessage) {
  const body = await api("POST", "/api/generate/", { chatId, streaming: true, userMessage });
  if (typeof body === "string" && body.includes('"type":"error"')) throw new Error(`generation error: ${body.slice(0, 400)}`);
  const list = await api("GET", `/api/chats/${chatId}/messages`);
  const messages = Array.isArray(list) ? list : (list.messages ?? []);
  return { userMessageId: [...messages].reverse().find((m) => m.role === "user")?.id, reply: messages.at(-1) };
}
const playerXp = async (chatId) =>
  (await readMeta(chatId)).gameCharacterCards.find((c) => c.name === "Josephine Synthetic").rulesetSheet.build.fields.xp;

function ledgerPids() {
  const out = execFileSync("ss", ["-ltnpH", `sport = :${ledgerPort}`], { encoding: "utf8" });
  return [...new Set([...out.matchAll(/pid=(\d+)/g)].map((m) => Number(m[1])))];
}
async function waitFor(check, label) {
  for (let i = 0; i < 60; i += 1) {
    if (await check().catch(() => false)) return;
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error(`timed out waiting for ${label}`);
}

// Setup: a fitness game with a player card.
const mock = (await api("GET", "/api/connections")).find((c) => c.name === "Mock GM");
const persona = await api("POST", "/api/characters/personas", { name: "Josephine Synthetic", description: "Synthetic fixture." });
const created = await api("POST", "/api/game/create", {
  name: `Fitness recovery ${new Date().toISOString()}`,
  connectionId: mock.id,
  personaId: persona.id,
  setupConfig: { genre: "Dark fantasy", setting: "Skyhold", tone: "Grim", difficulty: "normal", rating: "sfw", playerGoals: "Fixture", gmMode: "standalone", partyCharacterIds: [], personaId: persona.id },
});
const chatId = created.sessionChat.id;
await api("POST", "/api/game/setup/apply-json", {
  chatId,
  rawJson: JSON.stringify({ storyArc: "Fixture.", worldOverview: "Fixture.", plotTwists: ["Fixture."], startingNpcs: [{ name: "Cullen" }], characterCards: [{ name: "Josephine Synthetic" }, { name: "Cullen" }] }),
});
await api("POST", `/api/fitness/chats/${chatId}/enable`, { enabled: true });
await turn(chatId, "I look over the war table.");

// A restore point, then progress the game sees.
const backup = join(ledgerData, "recovery-check-before.sqlite");
execFileSync(process.execPath, [join(serviceDir, "src/cli.ts"), "backup", "--data", ledgerData, "--out", backup]);
const xpAtBackup = (await ledger("GET", "/v1/summary")).character.xp;
const day = await ledger("GET", `/v1/days/${(await ledger("GET", "/v1/summary")).today}`);
const category = day.categories.find((c) => !c.earned)?.category;
assert.ok(category, "every category is already earned today; use a fresh scratch ledger");
await api("POST", "/api/fitness/log", { entryId: randomUUID(), category });
await turn(chatId, "I report what I did today.");
const xpSeen = await playerXp(chatId);
record("the card took the new check-in", xpSeen === xpAtBackup + 20, `${xpAtBackup} -> ${xpSeen}`);

// Ledger down.
for (const pid of ledgerPids()) process.kill(pid, "SIGTERM");
await waitFor(async () => ledgerPids().length === 0, "the ledger to stop");
const down = await turn(chatId, "I keep going while the ravens are late.");
record("a turn still generates while the ledger is down", Boolean(down.reply?.content));
record("it carries no fitness facts", lastFacts() === null);
record("and locks nothing", !(await readMeta(chatId)).fitness.turns[down.userMessageId]);
const downView = await api("GET", `/api/fitness/chats/${chatId}`);
record("the panel reports the journal unreachable", downView.ledger.reachable === false);

// Ledger restored from the older backup.
const dbPath = join(ledgerData, "ledger.sqlite");
for (const suffix of ["", "-wal", "-shm"]) rmSync(dbPath + suffix, { force: true });
copyFileSync(backup, dbPath);
const restarted = spawn(process.execPath, [join(serviceDir, "src/main.ts"), "--data", ledgerData, "--host", "127.0.0.1", "--port", String(ledgerPort)], {
  detached: true,
  stdio: "ignore",
});
restarted.unref();
await waitFor(async () => (await fetch(`${ledgerBase}/healthz`)).ok, "the restored ledger");
const behind = await turn(chatId, "I check the ledger against the quartermaster's count.");
record("after a ledger restore the turn carries no fitness facts", lastFacts() === null);
record("and locks nothing", !(await readMeta(chatId)).fitness.turns[behind.userMessageId]);
const behindView = await api("GET", `/api/fitness/chats/${chatId}`);
record("the game reports the journal is behind", behindView.reconciliation?.status === "ledger-behind", JSON.stringify(behindView.reconciliation));
record("the card keeps what the player saw", (await playerXp(chatId)) === xpSeen);

const accepted = await api("POST", `/api/fitness/chats/${chatId}/accept-restored-ledger`);
record("accepting clears the warning", accepted.reconciliation === null);
record("and the card follows the restored journal", (await playerXp(chatId)) === xpAtBackup, `xp ${xpSeen} -> ${await playerXp(chatId)}`);
await turn(chatId, "I start again from what the quartermaster has.");
record("fitness facts resume on the next turn", Boolean(lastFacts()));

rmSync(backup, { force: true });
const failed = results.filter((r) => !r.ok);
process.stdout.write(`\n${results.length - failed.length}/${results.length} checks passed (chat ${chatId}; restored ledger pid ${restarted.pid}).\n`);
process.exit(failed.length ? 1 : 0);
