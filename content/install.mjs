#!/usr/bin/env node
// Install the season-one campaign into a Marinara instance and start a game, or change the
// Inquisitor's race in an existing game. Uses only Marinara's HTTP API. Run `node content/build.mjs`
// first. Point it at a scratch instance for testing; on Lore's installation it is run once, by
// stage 6, after a backup.
//
//   node content/install.mjs --base http://127.0.0.1:7910 --name "Evelyn Trevelyan" \
//        [--race human|elf|dwarf|qunari] [--class warrior|rogue|mage] [--pronouns she/her] \
//        [--connection ID] [--no-fitness]
//   node content/install.mjs --base URL --chat CHAT_ID --set-race elf
//   node content/install.mjs --base URL --chat CHAT_ID --refresh-campaign
//
// The campaign data the Training panel reads (war table, crafting, companions, acts and missions)
// is stored on the game chat as metadata `fitnessCampaign`; --refresh-campaign rewrites it after a
// pack update without touching anything the player did (that lives under metadata `fitness`).
//
// Re-running is safe: the ruleset, lorebooks and persona are reused when they already exist.

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(fileURLToPath(import.meta.url));
const args = Object.fromEntries(
  process.argv.slice(2).reduce((pairs, value, index, all) => {
    if (value.startsWith("--")) pairs.push([value.slice(2), all[index + 1]?.startsWith("--") ? "true" : (all[index + 1] ?? "true")]);
    return pairs;
  }, []),
);
const base = (args.base ?? "http://127.0.0.1:7910").replace(/\/$/, "");
const RACES = ["human", "elf", "dwarf", "qunari"];
const dist = (file) => JSON.parse(readFileSync(join(root, "dist", file), "utf8"));
const manifest = dist("manifest.json");

async function api(method, path, body) {
  const response = await fetch(`${base}${path}`, {
    method,
    headers: body ? { "content-type": "application/json" } : {},
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await response.text();
  if (!response.ok) throw new Error(`${method} ${path} -> ${response.status}: ${text.slice(0, 400)}`);
  return text ? JSON.parse(text) : null;
}
const say = (line) => process.stdout.write(`${line}\n`);

async function lorebookId(file) {
  const book = dist(file);
  const existing = (await api("GET", "/api/lorebooks")).find((l) => l.name === book.name);
  if (existing) return existing.id;
  const imported = await api("POST", "/api/import/st-lorebook", { ...book, __filename: file });
  if (!imported?.lorebookId) throw new Error(`lorebook ${file} did not import: ${JSON.stringify(imported).slice(0, 300)}`);
  say(`imported lorebook ${book.name} (${imported.entriesImported} entries)`);
  return imported.lorebookId;
}

async function raceBookIds() {
  const ids = {};
  for (const race of RACES) ids[race] = await lorebookId(`race-${race}.lorebook.json`);
  return ids;
}

const metadataOf = (chat) => (typeof chat.metadata === "string" ? JSON.parse(chat.metadata) : chat.metadata);

/** Swap the race lorebook and the card's race field; activity, grants and history are untouched. */
async function setRace(chatId, race, playerName) {
  const books = await raceBookIds();
  const meta = metadataOf(await api("GET", `/api/chats/${chatId}`));
  const raceIds = new Set(Object.values(books));
  const active = (meta.activeLorebookIds ?? []).filter((id) => !raceIds.has(id));
  const name = playerName ?? meta.fitness?.playerCard;
  const cards = (meta.gameCharacterCards ?? []).map((card) => {
    if (!name || card.name !== name) return card;
    const sheet = card.rulesetSheet ?? { v: 1, build: {} };
    const build = { abilities: {}, skills: {}, saves: {}, bonuses: {}, fields: {}, lists: {}, ...sheet.build };
    return { ...card, rulesetSheet: { ...sheet, build: { ...build, fields: { ...build.fields, race } } } };
  });
  await api("PATCH", `/api/chats/${chatId}/metadata`, { activeLorebookIds: [...active, books[race]], gameCharacterCards: cards });
  say(`race set to ${race} for chat ${chatId}`);
}

if (args["refresh-campaign"]) {
  if (!args.chat) throw new Error("--chat is required with --refresh-campaign");
  await api("PATCH", `/api/chats/${args.chat}/metadata`, { fitnessCampaign: dist("campaign.json") });
  say(`campaign data refreshed for chat ${args.chat}`);
  process.exit(0);
}

if (args["set-race"]) {
  if (!RACES.includes(args["set-race"])) throw new Error(`race must be one of ${RACES.join(", ")}`);
  if (!args.chat) throw new Error("--chat is required with --set-race");
  await setRace(args.chat, args["set-race"]);
  process.exit(0);
}

const name = args.name;
if (!name) throw new Error('--name "Inquisitor name" is required');
const race = args.race ?? "human";
const klass = args.class ?? "warrior";
if (!RACES.includes(race)) throw new Error(`race must be one of ${RACES.join(", ")}`);
if (!["warrior", "rogue", "mage"].includes(klass)) throw new Error("class must be warrior, rogue or mage");

// 1. Ruleset (imports must be allowed; a re-import of the same version is reported, not an error).
await api("PATCH", "/api/agents/import-policy", { enabled: true });
const rulesetText = readFileSync(join(root, "ruleset/inquisition.json"), "utf8");
const installed = await api("GET", "/api/capability-packages/rulesets");
if (installed.some((r) => r.definition?.id === manifest.ruleset.id && r.definition?.version === manifest.ruleset.version)) {
  say(`ruleset ${manifest.ruleset.id}@${manifest.ruleset.version} already installed`);
} else {
  const result = await api("POST", "/api/game-rulesets/import", { definition: rulesetText });
  say(`ruleset ${result.rulesetId}@${result.version}: ${result.status}`);
}

// 2. Lorebooks: the season book and every race book (only the chosen race's is active).
const seasonBook = await lorebookId("inquisition-season-one.lorebook.json");
const books = await raceBookIds();

// 3. The player's persona.
const personas = await api("GET", "/api/characters/personas/list");
const persona =
  (Array.isArray(personas) ? personas : (personas.personas ?? [])).find((p) => p.name === name) ??
  (await api("POST", "/api/characters/personas", { name, description: `The Inquisitor. ${args.pronouns ? `Pronouns: ${args.pronouns}.` : ""}`.trim() }));

// 4. The game.
const connections = await api("GET", "/api/connections");
const connection = args.connection
  ? connections.find((c) => c.id === args.connection)
  : (connections.find((c) => c.isDefault === true || c.isDefault === "true") ?? connections[0]);
const created = await api("POST", "/api/game/create", {
  name: `Inquisition: ${name}`,
  connectionId: connection?.id,
  personaId: persona.id,
  setupConfig: {
    genre: "Dark fantasy (Dragon Age: Inquisition)",
    setting: "Skyhold and southern Thedas, after the Inquisition claims Skyhold and before the march on Adamant",
    tone: "Grim stakes with warmth, banter and humour; companions are friends, never nags",
    difficulty: "normal",
    rating: "sfw",
    playerGoals: "Lead the Inquisition through season one and prepare for the march on Adamant",
    gmMode: "standalone",
    partyCharacterIds: [],
    personaId: persona.id,
    ruleset: { id: manifest.ruleset.id, version: manifest.ruleset.version },
    activeLorebookIds: [seasonBook, books[race]],
  },
});
const chatId = created.sessionChat.id;

// 5. World setup without a generation: the spine, the companions and the player's own card.
const setup = dist("game-setup.json");
setup.characterCards = setup.characterCards.map((card) => (card.name === "The Inquisitor" ? { name } : card));
await api("POST", "/api/game/setup/apply-json", { chatId, rawJson: JSON.stringify(setup) });
await setRace(chatId, race, name);
const meta = metadataOf(await api("GET", `/api/chats/${chatId}`));
const cards = meta.gameCharacterCards.map((card) => {
  if (card.name !== name) return card;
  const build = card.rulesetSheet.build;
  return { ...card, rulesetSheet: { ...card.rulesetSheet, build: { ...build, fields: { ...build.fields, class: klass, ...(args.pronouns ? { pronouns: args.pronouns } : {}) } } } };
});
await api("PATCH", `/api/chats/${chatId}/metadata`, { gameCharacterCards: cards, fitnessCampaign: dist("campaign.json") });

// 6. The fitness module, when this Marinara has it.
if (args["no-fitness"] !== "true") {
  try {
    const view = await api("POST", `/api/fitness/chats/${chatId}/enable`, { enabled: true });
    say(`fitness module on (ledger ${view.ledger.reachable ? "reachable" : "unreachable"}, level ${view.character?.level ?? "?"})`);
  } catch (error) {
    say(`fitness module not enabled: ${error.message}`);
  }
}
say(`game ready: chat ${chatId} (${name}, ${race} ${klass}, pack ${manifest.id}@${manifest.version})`);
