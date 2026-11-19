// JSON HTTP API for the ledger. LAN-only household service: no accounts.
// Every write is committed before its response is sent.

import { createServer } from "node:http";
import type { IncomingMessage, Server, ServerResponse } from "node:http";
import { Ledger, LedgerError } from "./ledger.ts";

const MAX_BODY_BYTES = 2 * 1024 * 1024;

export const API_VERSION = "v1";

async function readJson(req: IncomingMessage): Promise<Record<string, unknown>> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of req) {
    size += (chunk as Buffer).length;
    if (size > MAX_BODY_BYTES) throw new LedgerError(413, "request body too large");
    chunks.push(chunk as Buffer);
  }
  if (size === 0) return {};
  try {
    const parsed = JSON.parse(Buffer.concat(chunks).toString("utf8"));
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("not an object");
    return parsed;
  } catch {
    throw new LedgerError(400, "body must be a JSON object");
  }
}

function send(res: ServerResponse, status: number, body: unknown): void {
  const text = JSON.stringify(body);
  res.writeHead(status, { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" });
  res.end(text);
}

type Handler = (ctx: { ledger: Ledger; params: string[]; query: URLSearchParams; body: () => Promise<Record<string, unknown>> }) => unknown;

interface Route {
  method: string;
  pattern: RegExp;
  handler: Handler;
}

const optionalNumber = (value: string | null) => (value === null || value === "" ? undefined : Number(value));

const routes: Route[] = [
  { method: "GET", pattern: /^\/healthz$/, handler: () => ({ ok: true }) },
  { method: "GET", pattern: /^\/v1\/status$/, handler: ({ ledger }) => ledger.status() },
  { method: "GET", pattern: /^\/v1\/summary$/, handler: ({ ledger }) => ledger.summary() },
  { method: "GET", pattern: /^\/v1\/settings$/, handler: ({ ledger }) => ledger.settings() },
  { method: "PUT", pattern: /^\/v1\/settings$/, handler: async ({ ledger, body }) => ledger.updateSettings(await body()) },
  {
    method: "POST",
    pattern: /^\/v1\/activities$/,
    handler: async ({ ledger, body }) => {
      const input = await body();
      if (!Array.isArray(input.records)) throw new LedgerError(400, "records must be a list of activity records");
      if (input.records.length > 5000) throw new LedgerError(413, "send at most 5000 records per batch");
      const results = ledger.ingest(input.records, { clientId: typeof input.clientId === "string" ? input.clientId : undefined });
      return { results };
    },
  },
  {
    method: "GET",
    pattern: /^\/v1\/activities$/,
    handler: ({ ledger, query }) => ({ activities: ledger.activities({ from: query.get("from") ?? undefined, to: query.get("to") ?? undefined }) }),
  },
  { method: "GET", pattern: /^\/v1\/activities\/([\w-]+)$/, handler: ({ ledger, params }) => ledger.activity(params[0]) },
  {
    method: "PATCH",
    pattern: /^\/v1\/activities\/([\w-]+)$/,
    handler: async ({ ledger, params, body }) => {
      const input = await body();
      if (!input.changes || typeof input.changes !== "object") throw new LedgerError(400, "changes must be an object");
      return ledger.editActivity(params[0], input.changes as Record<string, unknown>, typeof input.reason === "string" ? input.reason : "");
    },
  },
  {
    method: "POST",
    pattern: /^\/v1\/activities\/([\w-]+)\/delete$/,
    handler: async ({ ledger, params, body }) => {
      const input = await body();
      return { effects: ledger.deleteActivity(params[0], typeof input.reason === "string" ? input.reason : "") };
    },
  },
  {
    method: "POST",
    pattern: /^\/v1\/activities\/([\w-]+)\/restore$/,
    handler: async ({ ledger, params, body }) => {
      const input = await body();
      return { effects: ledger.restoreActivity(params[0], typeof input.reason === "string" ? input.reason : "") };
    },
  },
  { method: "GET", pattern: /^\/v1\/days\/(\d{4}-\d{2}-\d{2})$/, handler: ({ ledger, params }) => ledger.day(params[0]) },
  {
    method: "GET",
    pattern: /^\/v1\/journal$/,
    handler: ({ ledger, query }) => ({
      entries: ledger.journalEntries({
        from: query.get("from") ?? undefined,
        to: query.get("to") ?? undefined,
        after: optionalNumber(query.get("after")),
        limit: optionalNumber(query.get("limit")),
      }),
    }),
  },
  {
    method: "GET",
    pattern: /^\/v1\/bonus-rolls$/,
    handler: ({ ledger, query }) => ({ bonusRolls: ledger.bonusRolls(query.get("status") ?? undefined) }),
  },
  {
    method: "POST",
    pattern: /^\/v1\/bonus-rolls\/([\w-]+)\/resolve$/,
    handler: async ({ ledger, params, body }) => ledger.resolveBonusRoll(params[0], await body()),
  },
  { method: "POST", pattern: /^\/v1\/spends$/, handler: async ({ ledger, body }) => ledger.spend(await body()) },
  { method: "GET", pattern: /^\/v1\/spends$/, handler: ({ ledger }) => ({ spends: ledger.spends() }) },
  {
    method: "GET",
    pattern: /^\/v1\/projection$/,
    handler: ({ ledger, query }) => ledger.projection(query.get("chatId") ?? ""),
  },
  {
    method: "POST",
    pattern: /^\/v1\/projection\/ack$/,
    handler: async ({ ledger, body }) => {
      const input = await body();
      return ledger.acknowledgeProjection(input.chatId, input.grantIds, input.note);
    },
  },
];

export function createLedgerServer(ledger: Ledger, log: (line: string) => void = () => {}): Server {
  return createServer(async (req, res) => {
    const url = new URL(req.url ?? "/", "http://ledger.local");
    const started = Date.now();
    let status = 500;
    try {
      const candidates = routes.filter((route) => route.pattern.test(url.pathname));
      if (!candidates.length) throw new LedgerError(404, `no route for ${url.pathname}`);
      const route = candidates.find((candidate) => candidate.method === req.method);
      if (!route) throw new LedgerError(405, `${req.method} is not supported on ${url.pathname}`);
      const params = route.pattern.exec(url.pathname)!.slice(1);
      let cached: Promise<Record<string, unknown>> | undefined;
      const result = await route.handler({ ledger, params, query: url.searchParams, body: () => (cached ??= readJson(req)) });
      status = 200;
      send(res, status, result);
    } catch (error) {
      if (error instanceof LedgerError) {
        status = error.status;
        send(res, status, { error: error.message });
      } else {
        status = 500;
        log(`error ${req.method} ${url.pathname}: ${(error as Error).stack ?? error}`);
        send(res, status, { error: "internal error; see the service log" });
      }
    } finally {
      log(`${req.method} ${url.pathname} ${status} ${Date.now() - started}ms`);
    }
  });
}
