#!/usr/bin/env node
// Stage 3 check for the optional DSH agent team on a fitness game, against a scratch Marinara
// whose game connection is the dsh-stage mock provider and a local DSH instance
// (serve-dsh-stage.sh), never Lore's installation:
//
//  - The fitness panel reports the team engine and turns the team on for the game.
//  - A game turn is written by the team: the lore agent, narrator and reviewer all run, and
//    the reply is saved through Game Mode's own post-processing.
//  - Game Mode's per-turn material (format reminder, committed fitness facts) reaches the
//    narrator and reviewer as turn notes, never the lore agent; the narrator gets the game brief.
//  - Regenerating the turn hands the team the same locked fitness facts.
//  - With the team engine down, the turn falls back to the normal call and is still saved,
//    and the panel says the team failed.
//
// Usage: node team-turn.mjs --base http://127.0.0.1:7910 --chat CHAT_ID
//          --dsh-log DSH_MOCK.jsonl --dsh-dir DSH_INSTANCE_DIR [--engine-down true]
// Run once with the DSH host up, then stop it and run again with --engine-down true.
// The chat must be an installed season-one game (content/install.mjs) with the fitness module on.
// Synthetic fixture only.

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { randomUUID } from "node:crypto";

const args = Object.fromEntries(
  process.argv.slice(2).reduce((pairs, value, index, all) => {
    if (value.startsWith("--")) pairs.push([value.slice(2), all[index + 1]]);
    return pairs;
  }, []),
);
const base = (args.base ?? "http://127.0.0.1:7910").replace(/\/$/, "");
const chatId = args.chat;
const dshLog = args["dsh-log"];
const dshDir = args["dsh-dir"];
assert.ok(chatId && dshLog && dshDir, "--chat, --dsh-log and --dsh-dir are required");
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
function record(name, ok, detail) {
  results.push({ name, ok });
  process.stdout.write(`${ok ? "PASS" : "FAIL"} ${name}${detail ? ` — ${detail}` : ""}\n`);
}
const messages = async () => {
  const list = await api("GET", `/api/chats/${chatId}/messages`);
  return Array.isArray(list) ? list : (list.messages ?? []);
};
/** dsh-stage mock log records since a line count, as {role, messages}. */
const dshRecords = (since = 0) =>
  readFileSync(dshLog, "utf8")
    .trim()
    .split("\n")
    .filter(Boolean)
    .slice(since)
    .map((line) => JSON.parse(line));
const dshCount = () => dshRecords().length;
const text = (record) =>
  record.messages.map((m) => (typeof m.content === "string" ? m.content : JSON.stringify(m.content ?? ""))).join("\n");
const lastTurnRecord = () =>
  readFileSync(join(dshDir, "logs", "turns.jsonl"), "utf8")
    .trim()
    .split("\n")
    .map((line) => JSON.parse(line))
    .filter((r) => r.chatId === chatId)
    .at(-1);
const facts = (value) => value.match(/<fitness_facts[\s\S]*?<\/fitness_facts>/)?.[0] ?? null;

async function turn(body) {
  const stream = await api("POST", "/api/generate/", { chatId, streaming: true, ...body });
  if (typeof stream === "string" && stream.includes('"type":"error"')) throw new Error(`generation error: ${stream.slice(0, 400)}`);
  const phases = [...String(stream).matchAll(/"phase":"([a-z_]+)"/g)].map((m) => m[1]);
  return { phases, last: (await messages()).at(-1) };
}

// 1. Panel status and the toggle.
let view = await api("GET", `/api/fitness/chats/${chatId}`);
record("panel reports the team engine", view.team?.engine === true, JSON.stringify(view.team));
view = await api("POST", `/api/fitness/chats/${chatId}/team`, { enabled: true });
record("toggle turns the team on", view.team?.enabled === true);

const engineDown = args["engine-down"] === "true";
// 2. A check-in, then a team-written game turn.
if (!engineDown) {
  await api("POST", "/api/fitness/log", { entryId: randomUUID(), category: "mobility" }).catch(() => undefined);
  let since = dshCount();
  const first = await turn({ userMessage: "I walk the battlements with Cullen and ask how the recruits are holding up." });
  const firstRecord = lastTurnRecord();
  const roles = dshRecords(since).map((r) => r.role);
  record(
    "turn ran through the team",
    first.phases.includes("team_lore") && firstRecord?.ok === true && firstRecord?.game === true,
    `phases ${[...new Set(first.phases)].join(",")}; log ok=${firstRecord?.ok} game=${firstRecord?.game} notes=${firstRecord?.notesChars}`,
  );
  record(
    "lore agent, narrator and reviewer all ran",
    ["lore", "narrator", "reviewer"].every((r) => roles.includes(r)),
    roles.join(","),
  );
  record(
    "reply saved as the game master's",
    first.last?.role === "assistant" && String(first.last?.content ?? "").length > 0,
    String(first.last?.content ?? "").slice(0, 80),
  );

  const firstNarrator = dshRecords(since).find((r) => r.role === "narrator");
  const narratorText = firstNarrator ? text(firstNarrator) : "";
  const firstFacts = facts(narratorText);
  record("narrator gets the game brief", narratorText.includes("This is a game turn"));
  record(
    "narrator gets turn notes with the format and locked facts",
    /Turn notes for this reply:[\s\S]*<output_format>/.test(narratorText) &&
      /Turn notes for this reply:[\s\S]*<fitness_facts/.test(narratorText),
    firstFacts ? firstFacts.slice(0, 90) : "no fitness facts",
  );
  const loreText = dshRecords(since)
    .filter((r) => r.role === "lore")
    .map(text)
    .join("\n");
  record(
    "lore agent never sees per-turn notes",
    loreText.length > 0 && !loreText.includes("<output_format>") && !loreText.includes("<fitness_facts"),
  );
  const reviewerText = dshRecords(since)
    .filter((r) => r.role === "reviewer")
    .map(text)
    .join("\n");
  record(
    "reviewer gets the committed facts and the game checks",
    reviewerText.includes("<fitness_facts") && reviewerText.includes("committed:"),
  );
  const playerLine = narratorText.match(/(?:^|\n)[^\n:]+: I walk the battlements[^\n]*/)?.[0] ?? "";
  record("player's line is clean of injected blocks", playerLine !== "" && !playerLine.includes("<"), playerLine.trim().slice(0, 100));

  // 3. Regenerate: same locked facts reach the team.
  await api("POST", "/api/fitness/log", { entryId: randomUUID(), category: "rest" }).catch(() => undefined);
  since = dshCount();
  await turn({ regenerateMessageId: first.last.id });
  const again = dshRecords(since).find((r) => r.role === "narrator");
  const againFacts = again ? facts(text(again)) : null;
  record("regenerate gives the team the same locked facts", firstFacts !== null && againFacts === firstFacts);
}

// 4. Fallback: run again with the DSH host stopped and --engine-down true.
if (engineDown) {
  const before = (await messages()).length;
  const fallback = await turn({ userMessage: "I check the duty roster before supper." });
  const failed = lastTurnRecord();
  record(
    "engine down: turn still saved by the normal call",
    (await messages()).length === before + 2 && fallback.last?.role === "assistant",
    String(fallback.last?.content ?? "").slice(0, 60),
  );
  record("engine down: team log records the failure", failed?.ok === false, failed?.error?.slice(0, 120));
  view = await api("GET", `/api/fitness/chats/${chatId}`);
  record("engine down: panel says the team failed", view.team?.last?.ok === false);
} else {
  view = await api("GET", `/api/fitness/chats/${chatId}`);
  record("panel shows the last team turn", view.team?.last?.ok === true, JSON.stringify(view.team?.last));
}

const failed = results.filter((r) => !r.ok).length;
process.stdout.write(`\n${results.length - failed}/${results.length} checks passed\n`);
process.exitCode = failed ? 1 : 0;
