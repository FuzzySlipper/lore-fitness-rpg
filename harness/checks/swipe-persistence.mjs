#!/usr/bin/env node
// Stage 1 runtime check against a scratch Marinara (never Lore's installation):
// does state written outside a turn survive swipe, regenerate and continue?
//
//  - Game build: a card's rulesetSheet in chat.metadata.gameCharacterCards
//    (the planned home for projected level/build), written with PATCH /metadata.
//  - A fitness projection marker key in chat metadata.
//  - Inventory: an item added through POST /api/game/inventory (the UI "Add" path).
//
// Usage: node swipe-persistence.mjs --base http://127.0.0.1:7910 [--connection ID]
// The connection must point at the mock game master (harness/mock-gm).

import assert from "node:assert/strict";

const args = Object.fromEntries(
  process.argv.slice(2).reduce((pairs, value, index, all) => {
    if (value.startsWith("--")) pairs.push([value.slice(2), all[index + 1]]);
    return pairs;
  }, []),
);
const base = (args.base ?? "http://127.0.0.1:7910").replace(/\/$/, "");
const results = [];

async function api(method, path, body) {
  const response = await fetch(`${base}${path}`, {
    method,
    headers: body ? { "content-type": "application/json" } : {},
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await response.text();
  if (!response.ok) throw new Error(`${method} ${path} -> ${response.status}: ${text.slice(0, 400)}`);
  return text.startsWith("{") || text.startsWith("[") ? JSON.parse(text) : text;
}

const metadataOf = (chat) => (typeof chat.metadata === "string" ? JSON.parse(chat.metadata) : chat.metadata);
const readChat = async (chatId) => metadataOf(await api("GET", `/api/chats/${chatId}`));
const messages = async (chatId) => {
  const list = await api("GET", `/api/chats/${chatId}/messages`);
  return Array.isArray(list) ? list : (list.messages ?? []);
};

function record(name, ok, detail) {
  results.push({ name, ok, detail });
  process.stdout.write(`${ok ? "PASS" : "FAIL"} ${name}${detail ? ` — ${detail}` : ""}\n`);
}

async function generate(chatId, extra) {
  const body = await api("POST", "/api/generate/", { chatId, streaming: true, ...extra });
  if (typeof body === "string" && body.includes('"type":"error"')) throw new Error(`generation error: ${body.slice(0, 400)}`);
  const list = await messages(chatId);
  return list.at(-1);
}

let connectionId = args.connection;
if (!connectionId) {
  const connections = await api("GET", "/api/connections");
  const mock = connections.find((c) => c.provider === "custom" && String(c.baseUrl).includes("127.0.0.1"));
  assert.ok(mock, "no custom loopback connection found; pass --connection");
  connectionId = mock.id;
}

const created = await api("POST", "/api/game/create", {
  name: `Swipe persistence ${new Date().toISOString()}`,
  connectionId,
  setupConfig: {
    genre: "Dark fantasy",
    setting: "Skyhold, synthetic fixture",
    tone: "Grim with humor",
    difficulty: "normal",
    rating: "sfw",
    playerGoals: "Prepare for Corypheus",
    gmMode: "standalone",
    partyCharacterIds: [],
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
    characterCards: [{ name: "Cullen" }],
  }),
});

const first = await generate(chatId, { userMessage: "I report to the training yard." });

// Write the projection the fitness module would write: a build change on a card,
// a projection marker, and a granted item.
let meta = await readChat(chatId);
assert.ok(Array.isArray(meta.gameCharacterCards) && meta.gameCharacterCards.length > 0, "setup produced character cards");
const cards = structuredClone(meta.gameCharacterCards);
const projectedSheet = { v: 1, build: { fitnessFixture: { level: 2, xp: 300 } } };
cards[0].rulesetSheet = projectedSheet;
await api("PATCH", `/api/chats/${chatId}/metadata`, {
  gameCharacterCards: cards,
  fitnessProjectionFixture: { grantIds: ["grant-synthetic-1"] },
});
await api("POST", "/api/game/inventory", {
  chatId,
  ops: [{ op: "add", name: "Field rations", count: 1 }],
});

async function check(label) {
  const now = await readChat(chatId);
  const sheet = now.gameCharacterCards?.[0]?.rulesetSheet;
  record(`${label}: game build kept`, JSON.stringify(sheet) === JSON.stringify(projectedSheet), JSON.stringify(sheet));
  record(
    `${label}: projection marker kept`,
    JSON.stringify(now.fitnessProjectionFixture) === JSON.stringify({ grantIds: ["grant-synthetic-1"] }),
  );
  const rations = (now.gameInventory ?? []).filter((s) => /field rations/i.test(s.name));
  const count = rations.reduce((sum, s) => sum + (s.quantity ?? 0), 0);
  record(`${label}: granted item kept once`, count === 1, `count=${count}`);
}

await check("after projection");
await generate(chatId, { regenerateMessageId: first.id });
await check("after regenerate");
await api("PUT", `/api/chats/${chatId}/messages/${first.id}/active-swipe`, { index: 0 }).catch(async () =>
  api("POST", `/api/chats/${chatId}/messages/${first.id}/active-swipe`, { index: 0 }),
);
await check("after switching back to swipe 0");
await generate(chatId, { continueMessageId: first.id });
await check("after continue");
const second = await generate(chatId, { userMessage: "I ask Cullen for a drill." });
await generate(chatId, { regenerateMessageId: second.id });
await check("after a new turn and its regenerate");

const failed = results.filter((r) => !r.ok);
process.stdout.write(`\n${results.length - failed.length}/${results.length} checks passed (chat ${chatId}).\n`);
process.exit(failed.length ? 1 : 0);
