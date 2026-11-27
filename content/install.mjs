#!/usr/bin/env node
// Install the season-one campaign into a Marinara instance and start a game, or change the
// Inquisitor's race in an existing game. Uses only Marinara's HTTP API. Run `node content/build.mjs`
// first. Point it at a scratch instance for testing; on Lore's installation it is run once, by
// stage 6, after a backup.
//
//   node content/install.mjs --base http://127.0.0.1:7910 --player player.json
//   node content/install.mjs --base URL --name "Evelyn Trevelyan" [--race human|elf|dwarf|qunari] \
//        [--class warrior|rogue|mage] [--pronouns she/her] [--carry longbow] [--game-name ...] \
//        [--connection ID-or-name] [--no-fitness]
//   node content/install.mjs --base URL --chat CHAT_ID --set-player "Persona name" [same options]
//   node content/install.mjs --base URL --chat CHAT_ID --set-player --player player.json
//   node content/install.mjs --base URL --chat CHAT_ID --set-race elf
//   node content/install.mjs --base URL --chat CHAT_ID --refresh-campaign
//
// The character comes from a player file (content/player.example.json shows every field) and/or
// flags, a flag winning over the file. "name" is a Marinara persona: an existing one is used as it
// is (write your own character there first), otherwise one is created from "description". The class
// builds (attributes, skills, starting kit) are pack files in content/pack/classes; the player file
// adjusts them per character. Keep a real player file outside this public repository.
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
const rulesetDefinition = JSON.parse(readFileSync(join(root, "ruleset/inquisition.json"), "utf8"));

// Class builds come from the pack (content/pack/classes), checked and exported by build.mjs.
const CLASS_BUILDS = dist("classes.json");

// The character a game is built for: a JSON file (see content/player.example.json) given with
// --player, with any flag taking precedence over it.
const player = args.player && args.player !== "true" ? JSON.parse(readFileSync(args.player, "utf8")) : {};
const option = (flag, key, fallback) => args[flag] ?? player[key] ?? fallback;
const listOf = (value) => (Array.isArray(value) ? value : String(value ?? "").split(",")).map((v) => String(v).trim()).filter(Boolean);

/** The class build with the player's own adjustments: attributes, extra trained skills and saves, extra gear. */
function buildFor(klass) {
  const base = CLASS_BUILDS[klass];
  if (!base) throw new Error(`class must be one of ${Object.keys(CLASS_BUILDS).join(", ")}`);
  const sheet = rulesetDefinition.sheet;
  const abilities = { ...base.abilities, ...(player.abilities ?? {}) };
  for (const [id, value] of Object.entries(player.abilities ?? {})) {
    if (!sheet.abilities.some((a) => a.id === id)) throw new Error(`player file: unknown ability "${id}"`);
    if (!Number.isInteger(value) || value < -1 || value > 6) throw new Error(`player file: ${id} must be a whole number from -1 to 6`);
  }
  const trained = (ids, known, what) =>
    Object.fromEntries(listOf(ids).map((id) => {
      if (!known.some((k) => k.id === id)) throw new Error(`player file: unknown ${what} "${id}"`);
      return [id, "trained"];
    }));
  const quartermaster = rulesetDefinition.catalogs.find((c) => c.id === "quartermaster");
  const extra = [...listOf(args.carry), ...listOf(player.carry)];
  for (const id of extra) if (!quartermaster.entries.some((e) => e.id === id)) throw new Error(`unknown item "${id}" to carry`);
  return {
    ...base,
    abilities,
    skills: { ...base.skills, ...trained(player.skills, sheet.skills, "skill") },
    saves: { ...base.saves, ...trained(player.saves, sheet.saves, "save") },
    carried: [...new Set([...base.carried, ...extra])].filter((id) => !base.worn.includes(id)),
  };
}

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

/**
 * Moves a game to another of Marinara's personas, for when the player picks their own character after
 * the install: the setup's persona, the player card's name (with its level, kit and talents), the
 * fitness module's player name and, when asked, the class, race and pronouns. On a class change the
 * attributes, skills and talents follow the new class and the starting kit is swapped; the fitness
 * sync then grants the new class's talents up to the journal's level. Earned activity is untouched.
 */
async function setPlayer(chatId, name) {
  const personas = await api("GET", "/api/characters/personas/list");
  const list = Array.isArray(personas) ? personas : (personas.personas ?? []);
  const persona = list.find((p) => p.name === name);
  if (!persona) throw new Error(`no persona named "${name}"; create it in Marinara first`);
  const chat = await api("GET", `/api/chats/${chatId}`);
  const meta = metadataOf(chat);
  const setupPersona = list.find((p) => p.id === meta.gameSetupConfig?.personaId);
  const oldName = meta.fitness?.playerCard ?? setupPersona?.name;
  const card = (meta.gameCharacterCards ?? []).find((c) => c.name === oldName);
  if (!card) throw new Error(`no player card named "${oldName}" in this game`);
  if (name !== oldName && meta.gameCharacterCards.some((c) => c.name === name))
    throw new Error(`this game already has a card named "${name}"`);
  const build = card.rulesetSheet?.build ?? {};
  const oldClass = build.fields?.class;
  const klass = option("class", "class", oldClass);
  const kit = buildFor(klass);
  const changedClass = klass !== oldClass;
  const pronouns = option("pronouns", "pronouns");
  const nextBuild = {
    ...build,
    fields: { ...build.fields, class: klass, ...(pronouns ? { pronouns } : {}) },
    ...(changedClass
      ? {
          abilities: { ...kit.abilities },
          skills: { ...kit.skills },
          saves: { ...kit.saves },
          // The old class's talents go; the fitness sync grants the new class's by level.
          lists: { ...build.lists, talents: (build.lists?.talents ?? []).filter((row) => !String(row._catalog ?? "").startsWith("talent_trees/")) },
        }
      : {}),
  };
  const cards = meta.gameCharacterCards.map((c) => (c === card ? { ...c, name, rulesetSheet: { ...c.rulesetSheet, build: nextBuild } } : c));
  const state = meta.fitnessCampaignState;
  await api("PATCH", `/api/chats/${chatId}/metadata`, {
    gameCharacterCards: cards,
    gameSetupConfig: { ...meta.gameSetupConfig, personaId: persona.id },
    ...(meta.fitness ? { fitness: { ...meta.fitness, playerCard: name } } : {}),
    // The new class's talents are granted afresh; the companions' records stay.
    ...(changedClass && state ? { fitnessCampaignState: { ...state, talentsGranted: (state.talentsGranted ?? []).filter((id) => id.includes("/")) } } : {}),
  });
  if (chat.personaId !== persona.id) await api("PATCH", `/api/chats/${chatId}`, { personaId: persona.id });
  say(`player card "${oldName}" is now "${name}" (${klass}${changedClass ? `, was ${oldClass}` : ""}); the game's persona is ${name}`);
  if (changedClass) {
    const quartermaster = JSON.parse(readFileSync(join(root, "ruleset/inquisition.json"), "utf8")).catalogs.find((c) => c.id === "quartermaster");
    const label = (id) => quartermaster.entries.find((e) => e.id === id)?.label ?? id;
    const old = CLASS_BUILDS[oldClass];
    const oldItems = new Set([...(old?.worn ?? []), ...(old?.carried ?? [])].map((id) => `quartermaster/${id}`));
    const mine = (metadataOf(await api("GET", `/api/chats/${chatId}`)).gameInventory ?? []).filter((s) => !s.holder && oldItems.has(s.item));
    if (mine.length)
      await api("POST", "/api/game/inventory", {
        chatId,
        ops: [...mine.filter((s) => s.equipped).map((s) => ({ op: "unequip", id: s.id })), ...mine.map((s) => ({ op: "set", id: s.id, quantity: 0 }))],
      });
    const items = [...kit.worn, ...kit.carried];
    const added = await api("POST", "/api/game/inventory", {
      chatId,
      ops: items.map((id) => ({ op: "add", name: label(id), item: `quartermaster/${id}`, count: 1 })),
    });
    const wear = added.inventory.filter((s) => !s.holder && !s.equipped && kit.worn.some((id) => s.item === `quartermaster/${id}`));
    if (wear.length) await api("POST", "/api/game/inventory", { chatId, ops: wear.map((s) => ({ op: "equip", id: s.id })) });
    say(`starting kit: ${mine.map((s) => s.name).join(", ") || "nothing"} out; ${items.map(label).join(", ")} in (${kit.worn.map(label).join(", ")} worn)`);
  }
  const race = option("race", "race");
  if (race) await setRace(chatId, race, name);
  try {
    await api("POST", `/api/fitness/chats/${chatId}/sync`);
    say("fitness sync done: level, resources and talents written to the renamed card");
  } catch (error) {
    say(`fitness sync not run: ${error.message}`);
  }
}

if (args["set-player"]) {
  if (!args.chat) throw new Error("--chat is required with --set-player");
  const race = option("race", "race");
  if (race && !RACES.includes(race)) throw new Error(`race must be one of ${RACES.join(", ")}`);
  const name = args["set-player"] !== "true" ? args["set-player"] : player.name;
  if (!name) throw new Error("--set-player needs a persona name, or a --player file with one");
  await setPlayer(args.chat, name);
  process.exit(0);
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

const name = option("name", "name");
if (!name) throw new Error('--name "Inquisitor name" is required');
const race = option("race", "race", "human");
const klass = option("class", "class", "warrior");
const pronouns = option("pronouns", "pronouns");
const gameName = option("game-name", "gameName", `Inquisition: ${name}`);
if (!RACES.includes(race)) throw new Error(`race must be one of ${RACES.join(", ")}`);
const kit = buildFor(klass);

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
  (await api("POST", "/api/characters/personas", {
    name,
    description: player.description ?? `The Inquisitor. ${pronouns ? `Pronouns: ${pronouns}.` : ""}`.trim(),
  }));

// 4. The game.
const connections = await api("GET", "/api/connections");
const connectionChoice = option("connection", "connection");
const connection = connectionChoice
  ? connections.find((c) => c.id === connectionChoice || c.name === connectionChoice)
  : (connections.find((c) => c.isDefault === true || c.isDefault === "true") ?? connections[0]);
const created = await api("POST", "/api/game/create", {
  name: gameName,
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
    // Fights resolved by the ruleset, so level, training, supplies, worn armor and made items
    // count in them. Without the combat director Marinara runs its own classic battle instead.
    combatDirector: true,
    combatStyle: "classic",
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
  return { ...card, rulesetSheet: { ...card.rulesetSheet, build: { ...build, fields: { ...build.fields, class: klass, ...(pronouns ? { pronouns } : {}) } } } };
});
await api("PATCH", `/api/chats/${chatId}/metadata`, { gameCharacterCards: cards, fitnessCampaign: dist("campaign.json") });

// 6. The class: attributes, trained skills and the starting kit, worn. Talents are added by the
//    fitness module as the level from the fitness journal reaches them (campaign.json progression).
{
  const meta = metadataOf(await api("GET", `/api/chats/${chatId}`));
  const cards = meta.gameCharacterCards.map((card) => {
    if (card.name !== name) return card;
    const build = card.rulesetSheet.build;
    return {
      ...card,
      rulesetSheet: {
        ...card.rulesetSheet,
        build: {
          ...build,
          abilities: { ...build.abilities, ...kit.abilities },
          skills: { ...build.skills, ...kit.skills },
          saves: { ...build.saves, ...kit.saves },
        },
      },
    };
  });
  await api("PATCH", `/api/chats/${chatId}/metadata`, { gameCharacterCards: cards });
  const quartermaster = JSON.parse(rulesetText).catalogs.find((c) => c.id === "quartermaster");
  const itemRef = (id) => `quartermaster/${id}`;
  const label = (id) => quartermaster.entries.find((e) => e.id === id)?.label ?? id;
  const items = [...kit.worn, ...kit.carried];
  const added = await api("POST", "/api/game/inventory", {
    chatId,
    ops: [
      ...items.map((id) => ({ op: "add", name: label(id), item: itemRef(id), count: 1 })),
      { op: "add", name: label("healing-potion"), item: itemRef("healing-potion"), count: kit.potions },
    ],
  });
  const refused = added.results.filter((result) => !result.ok);
  if (refused.length) say(`starting kit: ${refused.length} item(s) not added: ${JSON.stringify(refused)}`);
  const wear = added.inventory.filter((stack) => kit.worn.some((id) => stack.item === itemRef(id)) && !stack.equipped);
  if (wear.length) {
    const worn = await api("POST", "/api/game/inventory", { chatId, ops: wear.map((stack) => ({ op: "equip", id: stack.id })) });
    const notWorn = worn.results.filter((result) => !result.ok);
    if (notWorn.length) say(`starting kit: ${notWorn.length} item(s) not worn: ${JSON.stringify(notWorn)}`);
  }
  say(`${klass} kit: ${items.join(", ")} (${kit.worn.join(", ")} worn), ${kit.potions} healing potions`);
}

// 7. The companions: a ruleset sheet each (class and attributes from the pack), so a fight the Game
//    Master puts them in can read their numbers, and their kit worn in their own bag. The fitness
//    module keeps their level at the Inquisitor's and gives them their class talents.
{
  const pack = dist("campaign.json");
  const meta = metadataOf(await api("GET", `/api/chats/${chatId}`));
  const byName = new Map(pack.companions.map((c) => [c.cardName, c]));
  const cards = meta.gameCharacterCards.map((card) => {
    const companion = byName.get(card.name);
    if (!companion) return card;
    const build = card.rulesetSheet?.build ?? {};
    return {
      ...card,
      rulesetSheet: {
        v: 1,
        ...card.rulesetSheet,
        build: {
          skills: {},
          saves: {},
          bonuses: {},
          lists: {},
          ...build,
          abilities: { ...companion.abilities },
          fields: { ...(build.fields ?? {}), class: companion.class, level: 1 },
        },
      },
    };
  });
  await api("PATCH", `/api/chats/${chatId}/metadata`, { gameCharacterCards: cards });
  const missing = pack.companions.filter((c) => !cards.some((card) => card.name === c.cardName)).map((c) => c.cardName);
  if (missing.length) say(`companions without a card in this game: ${missing.join(", ")}`);
  const present = pack.companions.filter((c) => !missing.includes(c.name));
  const added = await api("POST", "/api/game/inventory", {
    chatId,
    ops: present.flatMap((c) => c.kit.map((k) => ({ op: "add", name: k.itemName, item: k.item, count: 1, holder: c.cardName }))),
  });
  const refused = added.results.filter((result) => !result.ok);
  if (refused.length) say(`companion kit: ${refused.length} item(s) not added: ${JSON.stringify(refused)}`);
  const wear = added.inventory.filter((stack) => stack.holder && byName.has(stack.holder) && !stack.equipped);
  if (wear.length) {
    const worn = await api("POST", "/api/game/inventory", { chatId, ops: wear.map((stack) => ({ op: "equip", id: stack.id })) });
    const notWorn = worn.results.filter((result) => !result.ok);
    if (notWorn.length) say(`companion kit: ${notWorn.length} item(s) not worn: ${JSON.stringify(notWorn)}`);
  }
  say(`companion sheets and kit: ${present.map((c) => `${c.cardName} (${c.class})`).join(", ")}`);
}

// 8. The fitness module, when this Marinara has it.
if (args["no-fitness"] !== "true" && player.fitness !== false) {
  try {
    const view = await api("POST", `/api/fitness/chats/${chatId}/enable`, { enabled: true });
    say(`fitness module on (ledger ${view.ledger.reachable ? "reachable" : "unreachable"}, level ${view.character?.level ?? "?"})`);
  } catch (error) {
    say(`fitness module not enabled: ${error.message}`);
  }
}
say(`game ready: chat ${chatId} (${name}, ${race} ${klass}, pack ${manifest.id}@${manifest.version})`);
say("reload any Marinara tab that was already open; its games list does not refresh by itself");
