#!/usr/bin/env node
// Build the season-one campaign pack: check every entry in content/pack/ against the format in
// content/README.md and write importable files to content/dist/.
//
//   node content/build.mjs            check, then build
//   node content/build.mjs --check    check only (exit 1 on errors)
//   node content/build.mjs --inquisitor "Name"   name of the player's persona card in the setup
//
// Outputs: inquisition-season-one.lorebook.json and race-<race>.lorebook.json (SillyTavern
// world-info format, which Marinara imports), game-setup.json (body for
// POST /api/game/setup/apply-json) and manifest.json.

import { mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { basename, dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(fileURLToPath(import.meta.url));
const packDir = join(root, "pack");
const distDir = join(root, "dist");
const args = process.argv.slice(2);
const checkOnly = args.includes("--check");
const inquisitorName = args.includes("--inquisitor") ? args[args.indexOf("--inquisitor") + 1] : "The Inquisitor";

const PACK_VERSION = 1;
const RULESET = { id: "local/inquisition", version: 2 };
const RACES = ["human", "elf", "dwarf", "qunari"];
const COMPANIONS = ["solas", "cassandra", "leliana", "cullen", "dorian", "sera", "iron-bull", "blackwall"];

const SECTIONS = {
  companion: ["Summary", "Personality", "Voice", "Dialogue examples", "With the Inquisition", "Training role", "Reacting to effort", "Scene hooks", "Knowledge limits", "Revelations"],
  npc: ["Summary", "Details", "Scene hooks"],
  faction: ["Summary", "Details", "Scene hooks"],
  location: ["Summary", "Details", "When to use", "Scene hooks"],
  mission: ["Premise", "Stakes", "Beats", "Choices", "Encounters", "Outcomes", "Low-energy version"],
  encounter: ["Setup", "Twist", "Preparation pays off", "Aftermath"],
  project: ["Order", "Report", "Unlocks"],
  race: ["How the world sees them", "Companion reactions", "Address and titles", "Backstory hooks"],
  watch: ["Raven notes", "Drill cues", "Dice flavor"],
  season: ["Premise", "Acts", "How the story moves", "Original characters"],
  recipe: ["At the workshop"],
  class: ["At the training yard"],
};
const HEADER = {
  companion: ["id", "name", "keys", "class", "abilities", "kit"],
  npc: ["id", "name", "keys"],
  faction: ["id", "name", "keys"],
  location: ["id", "name", "keys"],
  mission: ["id", "name", "act", "kind", "location", "companions", "requires", "keys"],
  encounter: ["id", "name", "tier", "opponents", "location", "keys"],
  project: ["id", "name", "advisor", "cost", "act", "keys"],
  race: ["id", "race"],
  watch: ["id", "companion"],
  season: ["id", "name", "keys"],
  recipe: ["id", "name", "item", "count", "cost", "keys"],
  class: ["id", "name", "abilities", "skills", "saves", "worn", "carried", "potions"],
};

const errors = [];
const warnings = [];
const fail = (file, message) => errors.push(`${file}: ${message}`);
const warn = (file, message) => warnings.push(`${file}: ${message}`);

function walk(dir) {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? walk(path) : name.endsWith(".md") ? [path] : [];
  });
}

function parse(path) {
  const file = relative(root, path);
  const text = readFileSync(path, "utf8").replace(/\r\n/g, "\n");
  const match = text.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  if (!match) {
    fail(file, "missing the --- header block");
    return null;
  }
  const header = {};
  for (const line of match[1].split("\n")) {
    if (!line.trim()) continue;
    const at = line.indexOf(":");
    if (at < 0) {
      fail(file, `header line without a colon: ${line}`);
      continue;
    }
    const key = line.slice(0, at).trim();
    const raw = line.slice(at + 1).trim();
    header[key] = raw.startsWith("[") && raw.endsWith("]") ? raw.slice(1, -1).split(",").map((v) => v.trim()).filter(Boolean) : raw;
  }
  const sections = {};
  const order = [];
  let current = null;
  for (const line of match[2].split("\n")) {
    const heading = line.match(/^## (.+)$/);
    if (heading) {
      current = heading[1].trim();
      order.push(current);
      sections[current] = [];
    } else if (current) sections[current].push(line);
  }
  for (const key of Object.keys(sections)) sections[key] = sections[key].join("\n").trim();
  return { file, header, sections, order };
}

const words = (text) => (text.match(/\S+/g) ?? []).length;
const listItems = (text) => text.split("\n").filter((line) => /^\s*(-|\d+\.)\s+/.test(line));

const ruleset = JSON.parse(readFileSync(join(root, "ruleset/inquisition.json"), "utf8"));
const opponentIds = new Set(ruleset.catalogs.find((c) => c.id === "opponents").entries.map((e) => e.id));
const ITEM_CATALOG = "quartermaster";
const items = new Map(ruleset.catalogs.find((c) => c.id === ITEM_CATALOG).entries.map((e) => [e.id, e]));
const materialsOf = (header) =>
  [].concat(header.materials ?? []).map((m) => {
    const [, id, count] = m.match(/^(\S+?)(?:\s+x(\d+))?$/) ?? [];
    return { id, count: Number(count ?? 1) };
  });

const entries = walk(packDir).map(parse).filter(Boolean);
const byId = new Map();
for (const entry of entries) {
  const { file, header, sections, order } = entry;
  const type = header.type;
  if (!SECTIONS[type]) {
    fail(file, `unknown type "${type}"`);
    continue;
  }
  for (const key of HEADER[type]) if (header[key] === undefined || header[key] === "") fail(file, `header needs ${key}`);
  if (header.id && basename(file, ".md") !== header.id && !(type === "race" && header.id === `race-${basename(file, ".md")}`) && !(type === "watch" && header.id === `watch-${basename(file, ".md")}`))
    fail(file, `id "${header.id}" does not match the file name`);
  if (byId.has(header.id)) fail(file, `duplicate id "${header.id}" (also ${byId.get(header.id).file})`);
  byId.set(header.id, entry);
  const expected = SECTIONS[type];
  const missing = expected.filter((s) => !(s in sections));
  if (missing.length) fail(file, `missing sections: ${missing.join(", ")}`);
  const present = order.filter((s) => expected.includes(s));
  if (!missing.length && present.join("|") !== expected.join("|")) fail(file, `sections out of order; expected ${expected.join(", ")}`);
  for (const s of expected) if (s in sections && !sections[s]) fail(file, `section "${s}" is empty`);
  const body = expected.map((s) => sections[s] ?? "").join("\n");
  const total = words(body);
  const limits = { companion: [250, 900], mission: [150, 650], encounter: [80, 350], project: [50, 250], npc: [60, 300], faction: [60, 300], location: [80, 350], race: [120, 600], watch: [30, 300], season: [150, 700], recipe: [15, 120], class: [15, 120] }[type];
  if (total < limits[0] || total > limits[1]) warn(file, `${total} words; expected ${limits[0]}–${limits[1]}`);
  if (type === "companion" && listItems(sections["Dialogue examples"] ?? "").length < 4) fail(file, "needs at least 4 dialogue examples");
  if (type === "companion") {
    // What the companion fights with: a ruleset sheet the installer writes, kept at the Inquisitor's level.
    if (!["warrior", "rogue", "mage"].includes(header.class)) fail(file, "class must be warrior, rogue or mage");
    const scores = [].concat(header.abilities ?? []).map(Number);
    if (scores.length !== 6 || scores.some((n) => !Number.isInteger(n) || n < -1 || n > 6))
      fail(file, "abilities must be six whole numbers from -1 to 6 (STR, DEX, MAG, CUN, WIL, CON)");
    for (const id of [].concat(header.kit ?? [])) if (!items.has(id)) fail(file, `kit item "${id}" is not in the ruleset's ${ITEM_CATALOG} catalog`);
  }
  if (type === "mission") {
    if (!["1", "2", "3", "any"].includes(header.act)) fail(file, "act must be 1, 2, 3 or any");
    if (!["story", "operation", "companion", "recovery"].includes(header.kind)) fail(file, "kind must be story, operation, companion or recovery");
    const beats = listItems(sections.Beats ?? "").length;
    if (beats < 3 || beats > 6) fail(file, `needs 3–5 beats (has ${beats})`);
  }
  if (type === "encounter") {
    if (!["skirmish", "dangerous", "boss"].includes(header.tier)) fail(file, "tier must be skirmish, dangerous or boss");
    for (const item of [].concat(header.opponents ?? [])) {
      const id = item.replace(/\s+x\d+$/, "");
      if (!opponentIds.has(id)) fail(file, `opponent "${id}" is not in the ruleset's opponents catalog`);
    }
  }
  if (type === "project" && !/^(supplies|training) \d+$/.test(header.cost ?? "")) fail(file, 'cost must look like "supplies 3" or "training 2"');
  if (type === "class") {
    // A class is what the installer builds the Inquisitor from: checked against the ruleset's sheet.
    const sheetSkills = new Set(ruleset.sheet.skills.map((k) => k.id));
    const sheetSaves = new Set(ruleset.sheet.saves.map((k) => k.id));
    const scores = [].concat(header.abilities ?? []).map(Number);
    if (scores.length !== 6 || scores.some((n) => !Number.isInteger(n) || n < -1 || n > 6))
      fail(file, "abilities must be six whole numbers from -1 to 6 (STR, DEX, MAG, CUN, WIL, CON)");
    for (const id of [].concat(header.skills ?? [])) if (!sheetSkills.has(id)) fail(file, `skill "${id}" is not on the ruleset's sheet`);
    for (const id of [].concat(header.saves ?? [])) if (!sheetSaves.has(id)) fail(file, `save "${id}" is not on the ruleset's sheet`);
    for (const id of [...[].concat(header.worn ?? []), ...[].concat(header.carried ?? [])])
      if (!items.has(id)) fail(file, `item "${id}" is not in the ruleset's ${ITEM_CATALOG} catalog`);
    if (!/^\d{1,2}$/.test(header.potions ?? "")) fail(file, "potions must be a whole number");
  }
  if (type === "recipe") {
    if (!/^supplies \d+$/.test(header.cost ?? "")) fail(file, 'cost must look like "supplies 2"');
    if (!items.has(header.item)) fail(file, `item "${header.item}" is not in the ruleset's ${ITEM_CATALOG} catalog`);
    if (!/^[1-9]\d?$/.test(header.count ?? "")) fail(file, "count must be 1–99");
    for (const m of materialsOf(header)) if (!items.has(m.id)) fail(file, `material "${m.id}" is not in the ruleset's ${ITEM_CATALOG} catalog`);
  }
  if (type === "race" && !RACES.includes(header.race)) fail(file, `race must be one of ${RACES.join(", ")}`);
  if (/\b\d+\s*XP\b|\bgain(s)? (a )?level\b|\blevel up\b/i.test(body) && type !== "season") warn(file, "mentions XP or levelling; mechanics belong to the runtime");
}

// Cross-references.
for (const entry of entries) {
  const { file, header } = entry;
  const refs = (value) => [].concat(value ?? []).filter((v) => v && v !== "none");
  if (header.type === "mission") {
    for (const id of refs(header.requires)) if (!byId.has(id)) fail(file, `requires unknown mission "${id}"`);
    for (const id of refs(header.companions)) if (!COMPANIONS.includes(id)) fail(file, `unknown companion "${id}"`);
    const encounterIds = (entry.sections.Encounters ?? "").match(/\b[a-z0-9]+(?:-[a-z0-9]+)+\b/g) ?? [];
    for (const id of encounterIds) if (byId.get(id)?.header.type !== "encounter") fail(file, `Encounters names "${id}", which is not an encounter id`);
  }
  if (header.type === "watch" && !COMPANIONS.includes(header.companion)) fail(file, `unknown companion "${header.companion}"`);
}

for (const line of warnings) process.stdout.write(`warning ${line}\n`);
for (const line of errors) process.stdout.write(`error ${line}\n`);
const counts = entries.reduce((acc, e) => ((acc[e.header.type] = (acc[e.header.type] ?? 0) + 1), acc), {});
process.stdout.write(`${entries.length} entries ${JSON.stringify(counts)}; ${errors.length} errors, ${warnings.length} warnings\n`);
if (errors.length) process.exit(1);
if (checkOnly) process.exit(0);

// ── Build ──
const flatten = (text) => text.replace(/\n{2,}/g, "\n").replace(/^\s*-\s+/gm, "- ").trim();
function contentFor({ header, sections }) {
  const type = header.type;
  const parts = [];
  const add = (label, section) => sections[section] && parts.push(`${label ? `${label}: ` : ""}${flatten(sections[section])}`);
  if (type === "companion") {
    parts.push(`${header.name} (companion).`);
    add("", "Summary");
    add("Personality", "Personality");
    add("Voice", "Voice");
    add("Example lines, original, for voice only", "Dialogue examples");
    add("With the Inquisition", "With the Inquisition");
    add("Training role", "Training role");
    add("Reacting to the Inquisitor's effort (never guilt or nagging)", "Reacting to effort");
    add("Scene hooks", "Scene hooks");
    add("Knows and does not know", "Knowledge limits");
    add("Revelations, only when the condition has happened in play; other characters do not know these", "Revelations");
  } else if (type === "mission") {
    parts.push(`Mission "${header.name}" (act ${header.act}, ${header.kind}, ${header.location}).`);
    for (const s of SECTIONS.mission) add(s, s);
  } else if (type === "encounter") {
    parts.push(`Encounter "${header.name}" (${header.tier}): opponents ${[].concat(header.opponents).join(", ")} from the ruleset.`);
    for (const s of SECTIONS.encounter) add(s, s);
  } else if (type === "project") {
    parts.push(`War-table project "${header.name}" (${header.advisor}; costs ${header.cost}, spent through the Training panel, never by narration).`);
    for (const s of SECTIONS.project) add(s, s);
  } else if (type === "watch") {
    return null;
  } else {
    parts.push(`${header.name} (${type}).`);
    for (const s of SECTIONS[type]) add(s === "Summary" ? "" : s, s);
  }
  return parts.join("\n");
}

function worldInfo(name, list) {
  const entriesOut = {};
  list.forEach((item, uid) => {
    entriesOut[uid] = {
      uid,
      key: item.keys,
      keysecondary: [],
      comment: item.comment,
      ...(item.description ? { description: item.description } : {}),
      content: item.content,
      constant: item.constant ?? false,
      selective: false,
      order: item.order ?? 100,
      position: 0,
      disable: false,
    };
  });
  return { name, description: `Lore fitness RPG season one, pack version ${PACK_VERSION}`, scan_depth: 4, token_budget: 2048, recursive_scanning: false, entries: entriesOut };
}

// ── Wiki shape ──
// The same entries feed the trigger lorebook (plain Game Mode) and, through Marinara's team
// turn, the DSH agents' wiki. Each entry gets a readable title (the entry's name in the wiki
// index), a one-line summary (the lorebook entry's description, which Marinara never injects)
// and a closing "See also" line naming related entries, which the team wiki turns into links.
const TYPE_LABEL = { project: "war-table project" };
const titleOf = (e) => `${e.header.name} (${TYPE_LABEL[e.header.type] ?? e.header.type})`;
const wikiEntries = entries.filter((e) => !["race", "watch", "recipe", "class"].includes(e.header.type));
const firstSentence = (text = "") => {
  const line = text.replace(/^\s*(-|\d+\.)\s+/, "").split(/\n\s*\n|\n\s*(?:-|\d+\.)\s/)[0].replace(/\s+/g, " ").trim();
  const sentence = line.match(/^.+?[.!?](?=\s|$)/)?.[0] ?? line;
  return sentence.length > 200 ? `${sentence.slice(0, 197).trimEnd()}...` : sentence;
};
function summaryOf({ header, sections }) {
  const lead = { mission: "Premise", encounter: "Setup", project: "Order", season: "Premise" }[header.type] ?? "Summary";
  return firstSentence(sections[lead]);
}
// Structural links (from headers) rank before name mentions; each page keeps at most 12.
const related = new Map(wikiEntries.map((e) => [e.header.id, new Map()]));
const link = (a, b, weight = 2) => {
  if (a === b || !related.has(a) || !related.has(b)) return;
  for (const [from, to] of [[a, b], [b, a]]) related.get(from).set(to, Math.max(related.get(from).get(to) ?? 0, weight));
};
for (const e of wikiEntries) {
  const { id, type } = e.header;
  const list = (value) => [].concat(value ?? []).filter((v) => v && v !== "none");
  if (type === "mission" || type === "encounter") for (const loc of list(e.header.location)) link(id, loc);
  if (type === "mission") {
    for (const c of list(e.header.companions)) link(id, c);
    for (const r of list(e.header.requires)) link(id, r);
    for (const enc of (e.sections.Encounters ?? "").match(/\b[a-z0-9]+(?:-[a-z0-9]+)+\b/g) ?? []) link(id, enc);
  }
  if (type === "project") link(id, e.header.advisor);
}
// Named mentions: an entry whose text names another entry links to it (people, places, factions).
const mentionable = wikiEntries.filter((e) => ["companion", "npc", "location", "faction"].includes(e.header.type));
for (const e of wikiEntries) {
  const text = Object.values(e.sections).join("\n");
  for (const other of mentionable) {
    const names = [other.header.name, other.header.name.split(" ")[0]].filter((n) => n.length > 3);
    if (names.some((n) => new RegExp(`\\b${n.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`).test(text))) link(e.header.id, other.header.id, 1);
  }
}
const seeAlso = (e) => {
  const titles = [...related.get(e.header.id)]
    .sort((x, y) => y[1] - x[1] || titleOf(byId.get(x[0])).localeCompare(titleOf(byId.get(y[0]))))
    .slice(0, 12)
    .map(([id]) => titleOf(byId.get(id)));
  return titles.length ? `\nSee also: ${titles.join("; ")}` : "";
};

mkdirSync(distDir, { recursive: true });
const mainEntries = wikiEntries.map((e) => ({
  comment: titleOf(e),
  description: summaryOf(e),
  keys: [].concat(e.header.keys ?? [e.header.name]),
  content: `${contentFor(e)}${seeAlso(e)}`,
  constant: e.header.type === "season",
  order: e.header.type === "season" ? 10 : e.header.type === "companion" ? 50 : 100,
}));
writeFileSync(join(distDir, "inquisition-season-one.lorebook.json"), `${JSON.stringify(worldInfo("Inquisition: Season One", mainEntries), null, 2)}\n`);

for (const race of RACES) {
  const entry = entries.find((e) => e.header.type === "race" && e.header.race === race);
  if (!entry) {
    warn(`pack/race/${race}.md`, "missing; that race's lorebook was not built");
    continue;
  }
  const content = [`The Inquisitor is ${race === "qunari" ? "a Qunari (Vashoth)" : `${/^[aeiou]/.test(race) ? "an" : "a"} ${race}`}. The player chose this; never question or change it.`]
    .concat(SECTIONS.race.map((s) => `${s}: ${flatten(entry.sections[s])}`))
    .join("\n");
  writeFileSync(
    join(distDir, `race-${race}.lorebook.json`),
    `${JSON.stringify(worldInfo(`Inquisition: ${race} Inquisitor`, [{ comment: `race:${race}`, keys: ["Inquisitor"], content, constant: true, order: 20 }]), null, 2)}\n`,
  );
}

const season = entries.find((e) => e.header.type === "season");
const originals = (season?.sections["Original characters"] ?? "").split("\n").map((l) => l.match(/\*\*(.+?)\*\*/)?.[1]).filter(Boolean);
const setup = {
  storyArc: flatten(season?.sections.Acts ?? ""),
  worldOverview: flatten(season?.sections.Premise ?? ""),
  plotTwists: [
    "The tampered ledger's paymaster signs as A.T.: Magister Aurelian Tharsis.",
    "Knight-Captain Ilse Varn once served alongside Cullen.",
    "Tharsis means to break the march on Adamant before it begins.",
  ],
  startingNpcs: [...COMPANIONS.map((id) => ({ name: byId.get(id)?.header.name ?? id })), ...originals.map((name) => ({ name }))],
  // A companion's card is named as the Game Master calls them ("Cassandra"), so dialogue tags and a
  // fight's allies find it; `card:` in the companion file gives that name where it differs.
  characterCards: [{ name: inquisitorName }, ...COMPANIONS.map((id) => ({ name: byId.get(id)?.header.card ?? byId.get(id)?.header.name ?? id }))],
};
writeFileSync(join(distDir, "game-setup.json"), `${JSON.stringify(setup, null, 2)}\n`);
// The Game Mode panel's campaign data (war table, crafting, companions, acts and missions), stored on
// the game chat by install.mjs. Mechanics stay in the ledger; this only names what can be chosen.
const nameOf = (id) => byId.get(id)?.header.name ?? id;
const costOf = (cost) => {
  const [resource, amount] = cost.split(" ");
  return { resource, amount: Number(amount) };
};
const acts = (season?.sections.Acts ?? "")
  .split(/\n(?=\d+\.\s)/)
  .map((block) => block.match(/^(\d+)\.\s+\*\*(.+?)\.?\*\*\s*([\s\S]*)$/))
  .filter(Boolean)
  .map(([, act, name, text]) => ({ act: Number(act), name, summary: text.replace(/\s+/g, " ").trim() }));
const ofType = (type) => entries.filter((e) => e.header.type === type).sort((a, b) => a.header.id.localeCompare(b.header.id));
// Talents the level from the fitness journal unlocks. The Marinara fitness module adds each one to
// the player's sheet as its level is reached, marked as picked from this catalog, so a ruleset fight
// reads what it does from the catalog entry's mechanics.
const TALENT_CATALOG = "talent_trees";
const talentCatalog = ruleset.catalogs.find((c) => c.id === TALENT_CATALOG);
const progression = {
  catalog: TALENT_CATALOG,
  classField: "class",
  talents: talentCatalog.entries.map((e) => ({
    id: e.id,
    name: e.label,
    classes: e.filters.class,
    level: e.filters.level,
    list: e.rows[0].list,
    values: e.rows[0].values,
  })),
};

const campaign = {
  id: "lore-fitness-season-one",
  version: PACK_VERSION,
  progression,
  season: { name: season?.header.name ?? "", premise: (season?.sections.Premise ?? "").replace(/\s+/g, " ").trim(), acts },
  projects: ofType("project")
    .map((e) => ({
      id: e.header.id,
      name: e.header.name,
      advisor: nameOf(e.header.advisor),
      act: e.header.act === "any" ? null : Number(e.header.act),
      cost: costOf(e.header.cost),
      order: flatten(e.sections.Order),
      report: flatten(e.sections.Report),
      // Pack ids in the text read as the entries' names for the Game Master and the panel.
      unlocks: flatten(e.sections.Unlocks).replace(/\b[a-z0-9]+(?:-[a-z0-9]+)+\b/g, (id) => (byId.has(id) ? byId.get(id).header.name : id)),
    }))
    .sort((a, b) => (a.act ?? 0) - (b.act ?? 0) || a.name.localeCompare(b.name)),
  recipes: ofType("recipe").map((e) => ({
    id: e.header.id,
    name: e.header.name,
    item: `${ITEM_CATALOG}/${e.header.item}`,
    itemName: items.get(e.header.item).label,
    count: Number(e.header.count),
    cost: costOf(e.header.cost),
    materials: materialsOf(e.header).map((m) => ({ item: `${ITEM_CATALOG}/${m.id}`, itemName: items.get(m.id).label, count: m.count })),
    workshop: flatten(e.sections["At the workshop"]),
  })),
  companions: COMPANIONS.map((id) => byId.get(id)).filter(Boolean).map((e) => ({
    id: e.header.id,
    name: e.header.name,
    summary: firstSentence(e.sections.Summary),
    role: firstSentence(e.sections["With the Inquisition"]),
    training: firstSentence(e.sections["Training role"]),
    cardName: e.header.card ?? e.header.name,
    class: e.header.class,
    abilities: Object.fromEntries(
      ["strength", "dexterity", "magic", "cunning", "willpower", "constitution"].map((id, i) => [id, Number([].concat(e.header.abilities)[i])]),
    ),
    kit: [].concat(e.header.kit ?? []).map((id) => ({ item: `${ITEM_CATALOG}/${id}`, itemName: items.get(id).label })),
  })),
  missions: ofType("mission")
    .map((e) => ({
      id: e.header.id,
      name: e.header.name,
      act: e.header.act === "any" ? null : Number(e.header.act),
      kind: e.header.kind,
      companions: [].concat(e.header.companions ?? []).filter((c) => c !== "none"),
      requires: [].concat(e.header.requires ?? []).filter((r) => r !== "none"),
      premise: firstSentence(e.sections.Premise),
    }))
    .sort((a, b) => (a.act ?? 9) - (b.act ?? 9) || a.id.localeCompare(b.id)),
};
// The classes the installer builds the Inquisitor from (content/pack/classes).
const ABILITIES = ["strength", "dexterity", "magic", "cunning", "willpower", "constitution"];
const classes = Object.fromEntries(
  ofType("class").map((e) => [
    e.header.id,
    {
      name: e.header.name,
      abilities: Object.fromEntries(ABILITIES.map((id, i) => [id, Number([].concat(e.header.abilities)[i])])),
      skills: Object.fromEntries([].concat(e.header.skills ?? []).map((id) => [id, "trained"])),
      saves: Object.fromEntries([].concat(e.header.saves ?? []).map((id) => [id, "trained"])),
      worn: [].concat(e.header.worn ?? []),
      carried: [].concat(e.header.carried ?? []),
      potions: Number(e.header.potions),
    },
  ]),
);
writeFileSync(join(distDir, "classes.json"), `${JSON.stringify(classes, null, 2)}\n`);
writeFileSync(join(distDir, "campaign.json"), `${JSON.stringify(campaign, null, 2)}\n`);
writeFileSync(
  join(distDir, "manifest.json"),
  `${JSON.stringify({ id: "lore-fitness-season-one", version: PACK_VERSION, ruleset: RULESET, counts, files: ["inquisition-season-one.lorebook.json", ...RACES.map((r) => `race-${r}.lorebook.json`), "game-setup.json", "campaign.json"] }, null, 2)}\n`,
);
process.stdout.write(`built ${relative(process.cwd(), distDir)}\n`);
