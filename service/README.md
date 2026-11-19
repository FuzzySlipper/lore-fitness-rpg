# Fitness ledger service

The stage 2 fitness service: a small TypeScript HTTP service with a SQLite
ledger. It is authoritative for activity records, daily check-ins, XP and level,
preparation resources, rerolls, bonus-roll results and campaign projection
receipts. Design and rules: [stage 2](../docs/02-durable-mechanics.md).

No dependencies at run time. Node 24 or newer runs the TypeScript directly (type
stripping) and provides `node:sqlite`, so nothing native is built on den-lore.
TypeScript and `@types/node` are development-only, for `npm run typecheck`.

## Commands

Run from this directory with Node ≥ 24 on `PATH`.

```bash
npm install          # development tools only (typecheck)
npm test             # node:test suite, 23 tests
npm run typecheck
```

```bash
node src/main.ts --data .data --port 7900
```

| Command | Purpose |
| --- | --- |
| `node src/main.ts [--data DIR] [--host HOST] [--port PORT] [--time-zone TZ]` | Serve the API. Takes a backup at every start and keeps the last ten |
| `node src/cli.ts status [--data DIR]` | Counts, clients, projections and character totals |
| `node src/cli.ts backup [--data DIR] [--out FILE]` | Consistent copy (`VACUUM INTO`), safe while the service runs |
| `node src/cli.ts synth --persona ID [--start DATE] [--time-zone TZ] [--seed N] [--noise]` | Print a persona's synthetic records as JSON lines |
| `node src/cli.ts seed --persona ID [--data DIR] [--seed N] [--noise] [--resolve-rolls]` | Feed a persona's history into a (scratch) ledger with a simulated clock and compare earned check-ins with the schedule |

Configuration (flag, then environment, then default):

| Setting | Flag / variable | Default |
| --- | --- | --- |
| Data directory (`ledger.sqlite`, `backups/`) | `--data` / `LFR_DATA_DIR` | `.data` (ignored by Git) |
| Bind address | `--host` / `LFR_HOST` | `127.0.0.1`; den-lore uses `0.0.0.0` so the phone can reach it |
| Port | `--port` / `LFR_PORT` | `7900` |
| Zone for records sent without one | `--time-zone` / `LFR_TIME_ZONE` | The host's zone |

Restore: stop the service, copy a backup over `ledger.sqlite` (remove any
`ledger.sqlite-wal`/`-shm` beside it), start the service. A ledger written by a
newer service version is refused at start rather than misread.

## API (v1)

JSON in and out. LAN household service: no accounts. Every write is committed
before the response is sent, so a client that gets a response can drop its
queued copy; a client that does not can resend safely.

| Method and path | Purpose |
| --- | --- |
| `GET /healthz` | Liveness |
| `GET /v1/status` | Schema/rule version, counts, per-source and per-client sync, projection receipts per chat |
| `GET /v1/summary` | Today's date, character totals, today's categories, pending bonus rolls, settings |
| `GET`/`PUT /v1/settings` | `stepGoal`, `hydrationGoalMl`, `mealHabit`, `timeZone` |
| `POST /v1/activities` | `{clientId?, records: [...]}` → one result per record |
| `GET /v1/activities?from=&to=` | Activities by local date |
| `GET /v1/activities/:id` | One activity with its revision history |
| `PATCH /v1/activities/:id` | `{changes, reason}`; manual entries only |
| `POST /v1/activities/:id/delete` / `restore` | `{reason}`; any source; removal survives re-import |
| `GET /v1/days/:date` | Each category: earned or not, why, supporting activities, grants, bonus roll |
| `GET /v1/journal?from=&to=&after=&limit=` | Player-readable history; `after=SEQ` polls forward |
| `GET /v1/bonus-rolls?status=pending` | Rolls waiting for Marinara's dice |
| `POST /v1/bonus-rolls/:id/resolve` | `{result, resolvedBy, detail?}`; a repeat returns the stored result |
| `POST /v1/spends` / `GET /v1/spends` | `{idempotencyKey, resource, amount, purpose, chatId?, detail?}`; 409 when the balance is short |
| `GET /v1/projection?chatId=` | Character totals plus grants not yet acknowledged for that chat |
| `POST /v1/projection/ack` | `{chatId, grantIds, note?}`; idempotent |

### Activity record

```json
{
  "source": "ohealth",
  "sourceRecordId": "hc-3f2a…",
  "revision": 1,
  "clientId": "razr",
  "kind": "walk",
  "category": "moved",
  "start": "2026-11-16T14:00:00Z",
  "end": "2026-11-16T14:30:00Z",
  "timeZone": "America/Chicago",
  "quantities": { "durationMin": 30, "steps": 3100 },
  "note": "optional",
  "deleted": false
}
```

- `(source, sourceRecordId)` identifies the record. Same `revision` again →
  `duplicate`; lower → `stale`; higher → `updated` and re-evaluated. Health
  Connect's last-modified time works as a revision.
- `start` is an ISO time, or `YYYY-MM-DD` for a day-level entry (manual
  backdating). The local day comes from `start` in `timeZone`.
- `category` is optional when `kind` is known (see `kinds` in
  [`src/rules.ts`](src/rules.ts)); an unknown kind without a category is kept but
  earns nothing.
- Known quantities: `steps`, `durationMin`, `amountMl`, `distanceM`,
  `energyKcal`, `goalMet`. All optional; negative or malformed values are dropped
  with a warning and the record is still accepted.
- `deleted: true` from a source removes the record from counting.
- Result statuses: `created`, `updated`, `duplicate`, `stale`, `rejected` (with
  `reason`). Results carry `warnings` and player-readable `effects`.

### For the Marinara fitness module (stage 3)

1. Poll `GET /v1/projection?chatId=…`; write `character` into the game build
   (`gameCharacterCards[].rulesetSheet`), show each unapplied grant's
   `explanation`, then `POST /v1/projection/ack` with the grant ids.
2. For each pending bonus roll, roll `notation` with Marinara's dice service and
   `POST …/resolve`. Persist Marinara's own receipt first; a retry gets the
   ledger's stored result back.
3. War-table, crafting and reroll actions: `POST /v1/spends` with an idempotency
   key derived from the UI action, before any narration.
