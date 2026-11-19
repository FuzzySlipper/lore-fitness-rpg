#!/usr/bin/env node
// Smoke check for a real game-master model behind a scratch Marinara (never
// Lore's installation): plays an opening turn, a second turn and a regenerate,
// and prints each reply's timing, length and opening lines for a human or agent
// to judge tone and companion voice. Synthetic fixture only.
//
// Usage: node real-turn.mjs --base http://127.0.0.1:7910 [--connection ID] [--fitness]
// With --fitness (needs the Marinara fitness module and a --persona scratch ledger), the game is
// played by a synthetic Inquisitor persona with the module on, and a mobility check-in is logged
// before the second turn so the reply shows how the model narrates committed fitness facts.
// Without --connection the default connection is used ("Real GM" when the
// scratch server was started with --model-url).

const args = Object.fromEntries(
  process.argv.slice(2).reduce((pairs, value, index, all) => {
    if (value.startsWith("--")) pairs.push([value.slice(2), all[index + 1]]);
    return pairs;
  }, []),
);
const base = (args.base ?? "http://127.0.0.1:7910").replace(/\/$/, "");

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

// A hosted playtest session reports ready as soon as Marinara serves its page;
// the serve script creates the connections a moment later.
let connections = [];
for (let attempt = 0; attempt < 30 && connections.length === 0; attempt += 1) {
  connections = await api("GET", "/api/connections");
  if (connections.length === 0) await new Promise((resolve) => setTimeout(resolve, 1000));
}
const connection = args.connection
  ? connections.find((c) => c.id === args.connection)
  : (connections.find((c) => c.isDefault === true || c.isDefault === "true") ?? connections[0]);
if (!connection) throw new Error("no connection found");
process.stdout.write(`connection: ${connection.name} -> ${connection.model} at ${connection.baseUrl}\n`);

const fitness = "fitness" in args;
const persona = fitness
  ? await api("POST", "/api/characters/personas", { name: "Evelyn Trevelyan", description: "Synthetic fixture Inquisitor, a human mage." })
  : null;
const created = await api("POST", "/api/game/create", {
  name: `Real turn ${new Date().toISOString()}`,
  connectionId: connection.id,
  ...(persona ? { personaId: persona.id } : {}),
  setupConfig: {
    ...(persona ? { personaId: persona.id } : {}),
    genre: "Dark fantasy",
    setting: "Skyhold, after the Inquisition claims it",
    tone: "Grim with warmth and humor",
    difficulty: "normal",
    rating: "sfw",
    playerGoals: "Rebuild the Inquisition's strength before the next push against Corypheus",
    gmMode: "standalone",
    partyCharacterIds: [],
  },
});
const chatId = created.sessionChat.id;
await api("POST", "/api/game/setup/apply-json", {
  chatId,
  rawJson: JSON.stringify({
    storyArc: "The Inquisitor readies Skyhold's people and companions for the march on the Arbor Wilds.",
    worldOverview: "Skyhold, a mountain fortress in the Frostbacks, newly the Inquisition's seat.",
    plotTwists: ["A supply ledger has been tampered with."],
    startingNpcs: [{ name: "Cullen" }, { name: "Cassandra" }],
    characterCards: [...(persona ? [{ name: persona.name }] : []), { name: "Cullen" }, { name: "Cassandra" }],
  }),
});
if (fitness) {
  const enabled = await api("POST", `/api/fitness/chats/${chatId}/enable`, { enabled: true });
  process.stdout.write(`fitness: enabled=${enabled.enabled} ledger=${enabled.ledger.reachable} level=${enabled.character?.level}\n`);
}

async function turn(label, extra) {
  const started = Date.now();
  const body = await api("POST", "/api/generate/", { chatId, streaming: true, ...extra });
  const seconds = ((Date.now() - started) / 1000).toFixed(1);
  if (typeof body === "string" && body.includes('"type":"error"')) {
    process.stdout.write(`\n## ${label}: ERROR after ${seconds}s\n${body.slice(0, 600)}\n`);
    process.exitCode = 1;
    return null;
  }
  const list = await api("GET", `/api/chats/${chatId}/messages`);
  const last = (Array.isArray(list) ? list : (list.messages ?? [])).at(-1);
  const content = String(last?.content ?? "");
  process.stdout.write(`\n## ${label}: ${seconds}s, ${content.length} chars\n${content.slice(0, fitness ? 2400 : 900)}\n`);
  if (!content.trim()) process.exitCode = 1;
  return last;
}

await turn("opening", { userMessage: "I walk into the Skyhold training yard after my morning walk and look for Cullen." });
if (fitness) {
  const logged = await api("POST", "/api/fitness/log", { entryId: crypto.randomUUID(), category: "mobility" });
  process.stdout.write(`\nlogged between turns: ${logged.effects?.at(-1)}\n`);
}
const second = await turn("second turn", { userMessage: "I ask Cullen and Cassandra what they need from me today." });
if (second) await turn("regenerate of second turn", { regenerateMessageId: second.id });
process.stdout.write(`\nchat ${chatId}\n`);
