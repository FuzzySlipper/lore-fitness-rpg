#!/usr/bin/env node
// Play a few scripted turns of an installed season-one game (content/install.mjs) on a scratch
// Marinara with a real model, and print each reply for a human or agent to judge: the Skyhold
// opening, lorebook-driven scenes (the ledger mission, a companion), and a recovery-day turn.
//
// Usage: node campaign-play.mjs --base http://127.0.0.1:7910 --chat CHAT_ID [--chars 2500]

const args = Object.fromEntries(
  process.argv.slice(2).reduce((pairs, value, index, all) => {
    if (value.startsWith("--")) pairs.push([value.slice(2), all[index + 1]]);
    return pairs;
  }, []),
);
const base = (args.base ?? "http://127.0.0.1:7910").replace(/\/$/, "");
const chatId = args.chat;
const chars = Number(args.chars ?? 2500);
if (!chatId) throw new Error("--chat is required");

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

async function turn(label, body) {
  const started = Date.now();
  const stream = await api("POST", "/api/generate/", { chatId, streaming: true, ...body });
  const seconds = ((Date.now() - started) / 1000).toFixed(1);
  if (typeof stream === "string" && stream.includes('"type":"error"')) {
    process.stdout.write(`\n## ${label}: ERROR after ${seconds}s\n${stream.slice(0, 600)}\n`);
    process.exitCode = 1;
    return;
  }
  const list = await api("GET", `/api/chats/${chatId}/messages`);
  const last = (Array.isArray(list) ? list : (list.messages ?? [])).at(-1);
  process.stdout.write(`\n## ${label}: ${seconds}s\n${String(last?.content ?? "").slice(0, chars)}\n`);
}

await api("POST", "/api/game/start", { chatId }).catch((error) => process.stdout.write(`(game/start: ${error.message})\n`));
await turn("opening", {
  generationGuide:
    "Begin the game now with the first visible GM VN narration/dialogue segment. This is an invisible startup trigger, not a player action. Do not mention a start command.",
  generationGuideSource: "game_start",
});
await turn("the ledger", { userMessage: "I go down to the storerooms; the quartermaster, Hadley Brisk, has been asking for me about the ledger." });
await turn("a companion", { userMessage: "Later I find Sera on the tavern roof and ask what she's heard about smugglers in the passes." });
await api("POST", "/api/fitness/log", { entryId: crypto.randomUUID(), category: "rest" }).catch(() => undefined);
await turn("a rest day", { userMessage: "I take the day to rest. I sit in the garden with a book and let Skyhold run itself for an afternoon." });
