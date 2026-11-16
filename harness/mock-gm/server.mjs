#!/usr/bin/env node
// Scripted OpenAI-compatible chat-completions server for internal playtests and
// stage 1 checks. It stands in for the game master's model so mechanical runs
// are deterministic and cost nothing. Every request is appended to a JSONL log,
// which shows exactly what Marinara sent (prompts, committed facts, tools).
//
// Usage: node server.mjs --port 7911 --script script.json --log requests.jsonl
//
// Script format (JSON): { "rules": [ { "match": "regex", "reply": "text" }, ... ],
//                         "default": ["reply 1", "reply 2", ...] }
// A rule matches against the last user message. Unmatched requests cycle through
// "default". Replies may contain Marinara game tags; the server does not parse them.

import { createServer } from "node:http";
import { appendFileSync, readFileSync } from "node:fs";

const args = Object.fromEntries(
  process.argv.slice(2).reduce((pairs, value, index, all) => {
    if (value.startsWith("--")) pairs.push([value.slice(2), all[index + 1]]);
    return pairs;
  }, []),
);
const port = Number(args.port ?? 7911);
const host = args.host ?? "127.0.0.1";
const logPath = args.log;
const script = args.script
  ? JSON.parse(readFileSync(args.script, "utf8"))
  : { rules: [], default: ["The torches of Skyhold gutter as the wind shifts. What do you do?"] };

let defaultIndex = 0;

function lastUserText(messages = []) {
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    const message = messages[i];
    if (message.role !== "user") continue;
    if (typeof message.content === "string") return message.content;
    if (Array.isArray(message.content)) {
      return message.content.map((part) => part.text ?? "").join("\n");
    }
  }
  return "";
}

function chooseReply(body) {
  const text = lastUserText(body.messages);
  for (const rule of script.rules ?? []) {
    if (new RegExp(rule.match, "i").test(text)) return rule.reply;
  }
  const replies = script.default ?? ["..."];
  const reply = replies[defaultIndex % replies.length];
  defaultIndex += 1;
  return reply;
}

function log(entry) {
  if (!logPath) return;
  appendFileSync(logPath, `${JSON.stringify({ at: new Date().toISOString(), ...entry })}\n`);
}

function sendJson(res, status, value) {
  res.writeHead(status, { "content-type": "application/json" });
  res.end(JSON.stringify(value));
}

createServer((req, res) => {
  if (req.method === "GET" && req.url.endsWith("/models")) {
    sendJson(res, 200, { object: "list", data: [{ id: "mock-gm", object: "model", owned_by: "harness" }] });
    return;
  }
  if (req.method !== "POST" || !req.url.endsWith("/chat/completions")) {
    sendJson(res, 404, { error: { message: `mock-gm does not serve ${req.method} ${req.url}` } });
    return;
  }
  let raw = "";
  req.on("data", (chunk) => (raw += chunk));
  req.on("end", () => {
    let body;
    try {
      body = JSON.parse(raw);
    } catch {
      sendJson(res, 400, { error: { message: "invalid JSON" } });
      return;
    }
    const reply = chooseReply(body);
    const { model, stream, messages, tools, ...parameters } = body;
    log({ model, stream: Boolean(stream), parameters, messages, tools, reply });
    const id = `mock-${Date.now()}`;
    const created = Math.floor(Date.now() / 1000);
    if (body.stream) {
      res.writeHead(200, { "content-type": "text/event-stream", "cache-control": "no-cache" });
      const chunk = (delta, finish = null) =>
        res.write(
          `data: ${JSON.stringify({ id, object: "chat.completion.chunk", created, model: body.model, choices: [{ index: 0, delta, finish_reason: finish }] })}\n\n`,
        );
      chunk({ role: "assistant" });
      for (const piece of reply.match(/[\s\S]{1,80}/g) ?? [""]) chunk({ content: piece });
      chunk({}, "stop");
      res.write("data: [DONE]\n\n");
      res.end();
      return;
    }
    sendJson(res, 200, {
      id,
      object: "chat.completion",
      created,
      model: body.model,
      choices: [{ index: 0, message: { role: "assistant", content: reply }, finish_reason: "stop" }],
      usage: { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 },
    });
  });
}).listen(port, host, () => {
  process.stdout.write(`mock-gm listening on http://${host}:${port}/v1\n`);
});
