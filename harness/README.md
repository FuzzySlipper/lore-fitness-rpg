# Internal playtest harness

Agents play the campaign here before Lore sees it (see
[stage 6](../docs/06-stabilization-and-release.md#internal-playtest-harness)).
Everything runs on den-agents against a **scratch** Marinara with its own data
directory. Nothing here touches Lore's installation on den-lore or her data.

## Pieces

| Path | Purpose |
| --- | --- |
| [`mock-gm/server.mjs`](mock-gm/server.mjs) | Scripted OpenAI-compatible model for the game master. Deterministic and free; logs every request Marinara sends to `mock-gm-requests.jsonl` |
| [`scripts/serve-scratch-marinara.sh`](scripts/serve-scratch-marinara.sh) | Starts a scratch Marinara on `--port` and the mock GM on `port+1`, then creates a default "Mock GM" connection; with `--model-url` a "Real GM" connection (reasoning off) becomes the default instead |
| [`den-serve.json`](den-serve.json) | den-serve manifest so the crew playtest service can host one private scratch Marinara per session, with the mock GM |
| [`den-serve-live.json`](den-serve-live.json) | The same with the real model on den-nimo as the default connection |
| [`checks/swipe-persistence.mjs`](checks/swipe-persistence.mjs) | Stage 1 runtime check: projected build, projection marker and a granted item survive regenerate, swipe switch and continue |
| [`checks/real-turn.mjs`](checks/real-turn.mjs) | Real-model smoke check: two Game Mode turns and a regenerate, with timing and opening text |
| [`personas.json`](personas.json) | Synthetic activity personas (steady, busy, illness, missed days, returning), expanded by the stage 2 history generator in [`service/src/synthetic.ts`](../service/src/synthetic.ts) |

## One-time setup on den-agents

1. Node 24 or newer (Marinara requires `>=24 <27`). The harness looks in
   `~/.local/opt/node24/bin` by default; set `NODE24_BIN` otherwise.
2. A built Marinara checkout at `~/dev/lore-fitness-rpg-work/marinara-custom`
   (set `MARINARA_DIR` otherwise). The current copy is `custom/agent-turn` at
   `3050e9a40`, bundled from `C:\Dev\Marinara-Custom` on den-lore because that
   branch is not on any remote:

   ```bash
   cd ~/dev/lore-fitness-rpg-work/marinara-custom
   PATH=$HOME/.local/opt/node24/bin:$PATH pnpm install --frozen-lockfile
   PATH=$HOME/.local/opt/node24/bin:$PATH pnpm build
   ```

3. The crew playtest profiles `lore-fitness-marinara` (mock GM) and
   `lore-fitness-marinara-live` (real model) in
   `~/.config/crew-playtest/games.json` (hosted, browser backend) name this
   repository and `harness/den-serve.json` or `harness/den-serve-live.json`; run
   `playtest reload` after editing them.

## Running

A standalone scratch instance for scripted checks:

```bash
bash harness/scripts/serve-scratch-marinara.sh --port 7910 --data ~/dev/lore-fitness-rpg-work/scratch-run
```

```bash
node harness/checks/swipe-persistence.mjs --base http://127.0.0.1:7910
```

The same with the real game master, and its smoke check:

```bash
bash harness/scripts/serve-scratch-marinara.sh --port 7910 --data ~/dev/lore-fitness-rpg-work/scratch-live --model-url http://192.168.1.23:13305/api/v1
```

```bash
node harness/checks/real-turn.mjs --base http://127.0.0.1:7910
```

A browser playtest session with its own scratch world (mock GM, or
`lore-fitness-marinara-live` for the real model):

```bash
playtest start lore-fitness-marinara
```

The session reports ready when Marinara serves its page; the connections appear
a second or two later.

Stop it with `playtest stop SESSION`; that ends the scratch Marinara and the
mock GM too. Give the mock GM a reply script with `--script FILE` (format in
the server's header comment) to stage specific turns.

## Scratch ledger

`serve-scratch-marinara.sh --persona ID [--seed N]` seeds a scratch
[fitness ledger](../service/README.md) with that persona's history (ending
yesterday, with delivery noise and synthetic bonus dice) and serves it on
`port+2`. Both playtest profiles pass `--persona steady`. The seed summary is in
`ledger-seed.json` in the session's data directory. Until the stage 3 module
exists, Marinara does not read the ledger; playtests use it through its API.

## Model choice

Mechanical runs (rewards, rolls, locked results, swipes) use the mock GM.
Playtests of tone, companion voice and pacing use `Gemma-4-26B-A4B-it-MTP-GGUF`
on Patch's LAN Lemonade servers: den-nimo `http://192.168.1.23:13305/api/v1`
by default, den-m5 `http://192.168.1.24:13305/api/v1` for a second concurrent
session (each serves one request at a time). No API key. Reasoning must stay
off; the [stage 6 real-model default](../docs/06-stabilization-and-release.md#real-model-default)
records why. Never point the harness at Lore's own provider connections.

## Still to build

- Scripted persona sessions that play through Marinara's UI and record rewards,
  rolls, locked results under swipes, companion voice and pacing.
- The Inquisition ruleset installed into the scratch data directory.
