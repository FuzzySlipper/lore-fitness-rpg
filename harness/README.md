# Internal playtest harness

Agents play the campaign here before Lore sees it (see
[stage 6](../docs/06-stabilization-and-release.md#internal-playtest-harness)).
Everything runs on den-agents against a **scratch** Marinara with its own data
directory. Nothing here touches Lore's installation on den-lore or her data.

## Pieces

| Path | Purpose |
| --- | --- |
| [`mock-gm/server.mjs`](mock-gm/server.mjs) | Scripted OpenAI-compatible model for the game master. Deterministic and free; logs every request Marinara sends to `mock-gm-requests.jsonl` |
| [`scripts/serve-scratch-marinara.sh`](scripts/serve-scratch-marinara.sh) | Starts a scratch Marinara on `--port` and the mock GM on `port+1`, then creates a default "Mock GM" connection |
| [`den-serve.json`](den-serve.json) | den-serve manifest so the crew playtest service can host one private scratch Marinara per session |
| [`checks/swipe-persistence.mjs`](checks/swipe-persistence.mjs) | Stage 1 runtime check: projected build, projection marker and a granted item survive regenerate, swipe switch and continue |
| [`personas.json`](personas.json) | Synthetic activity personas (steady, busy, illness, missed days, returning) for the stage 2 history generator |

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

3. The crew playtest profile `lore-fitness-marinara` in
   `~/.config/crew-playtest/games.json` (hosted, browser backend) names this
   repository and `harness/den-serve.json`; run `playtest reload` after editing it.

## Running

A standalone scratch instance for scripted checks:

```bash
bash harness/scripts/serve-scratch-marinara.sh --port 7910 --data ~/dev/lore-fitness-rpg-work/scratch-run
```

```bash
node harness/checks/swipe-persistence.mjs --base http://127.0.0.1:7910
```

A browser playtest session with its own scratch world:

```bash
playtest start lore-fitness-marinara
```

Stop it with `playtest stop SESSION`; that ends the scratch Marinara and the
mock GM too. Give the mock GM a reply script with `--script FILE` (format in
the server's header comment) to stage specific turns.

## Model choice

Mechanical runs (rewards, rolls, locked results, swipes) use the mock GM.
Playtests of tone, companion voice and pacing need a real model behind a
`custom` connection. That model and whose account pays for it are not chosen
yet; never point the harness at Lore's own provider connections.

## Still to build

- A scratch ledger fed by the stage 2 history generator from `personas.json`.
- Scripted persona sessions that play through Marinara's UI and record rewards,
  rolls, locked results under swipes, companion voice and pacing.
- The Inquisition ruleset installed into the scratch data directory.
