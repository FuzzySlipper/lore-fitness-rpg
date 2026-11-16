# Platform findings — 2026-11-16

Stage 1 findings by Claude Code session `s/a60d803335a9aa0a`. Linked from
[stage 1](01-platform-contract.md). Each item says how it was established:
**source** (code or docs read), **observed** (seen on a running system) or
**pending** (not yet checked). Real device data is not recorded here.

## den-lore installation (observed)

The Marinara that Lore actually runs is not `C:\Dev\Marinara-Custom`.

| Item | Observed value |
| --- | --- |
| Running Marinara checkout | `C:\Dev\Marinara-Engine`, started by `start.bat --skip-update`, Node 25.9.0 via fnm |
| Its branch and revision | `local/cartesia-2.4.6` at `7ec172600` (2.5.0 merge plus Cartesia and launcher fixes), tracking the `lore-library-ren/Marinara-Engine` fork |
| Its configuration | `.env`: `HOST=0.0.0.0`, `PORT=7860`, `AUTO_UPDATE_ENABLED=false`, `DATA_DIR=C:\dev\Marinara-Data` |
| `C:\Dev\Marinara-Custom` | `custom/agent-turn` at `3050e9a40`, one commit ahead of the running branch: the optional DSH agent-team turn. That commit exists only locally and is not deployed |
| `C:\Dev\Marinara-DSH` | Not a Git repository: an installed instance (`stage/`, `start.ps1`, `common.ps1`, `wiki/`, `work/`) |
| Other listeners | DSH on 3081, crew-dsh on 8793, crew-hermes on 8796, Ollama on 11434 (no models pulled), crew tunnel on 18787/18794 |
| Network profile | Private; existing inbound allow rules for `node.exe` programs on the Private profile |
| Automatic logon | Not configured. After a reboot, nothing in Lore's session runs until she signs in |
| OS | Windows 11 Pro, build 26200 |

Consequences for the plan:

- **Development checkout vs deployment.** Develop Marinara changes on a branch
  based on `custom/agent-turn` in `Marinara-Custom`, and deploy by updating
  `Marinara-Engine` deliberately (backing up `C:\dev\Marinara-Data` and `.env`
  first, per that fork's `LOCAL-PATCHES.md`). Deploying our branch also deploys
  the DSH agent-turn commit for the first time.
- `LOCAL-PATCHES.md` in `Marinara-Custom` still names `local/cartesia-2.4.6` as
  the installed branch. That is accurate for `Marinara-Engine`, and it lists
  customizations that must survive every merge.
- Marinara's upstream contribution rules (staging PRs, CodeRabbit, changelog,
  `docs-i18n`) apply to upstream PRs. Our changes stay in the local fork, so they
  do not apply; its code conventions (Pino logger, client localization keys,
  `pnpm check`, no committed `.test.ts`) still do.

## Default den-lore runtime plan

| Item | Default |
| --- | --- |
| Fitness service port | 7900 (free on den-lore), bound to `0.0.0.0` |
| Checkout | `C:\Dev\lore-fitness-rpg` |
| Data root | `C:\Dev\Lore-Fitness-RPG-Data` (ledger, backups, logs) |
| Startup | A Windows Scheduled Task triggered at system startup, running as `lore` with S4U logon (no stored password), restart on failure. The service needs no network credentials, so it runs before Lore signs in and keeps accepting phone uploads after Windows Update reboots |
| Firewall | Inbound TCP 7900 allow rule on the Private profile only |
| Marinara dependency | The service never requires Marinara to be running; Marinara's fitness module reconnects when either side restarts |

## Targeted checks

| Check | Status | Result |
| --- | --- | --- |
| Game build survives swipes | **Observed** on scratch Marinara, plus source | Kept through regenerate, swipe switch, continue and a later turn's regenerate |
| Inventory rewind | **Observed** for UI-path adds, plus source | An item added through the UI path was kept once through all of the above; GM-tag adds in a turn can rewind (by design) |
| Locked dice | Source traced | Mechanism identified; extension point chosen below |
| Device capture | Pending | Lore's razr and Watch 3 are not yet connected to an agent host; adb platform-tools 37.0.1 are installed on den-agents at `~/.local/opt/platform-tools` |

The runtime check is [`harness/checks/swipe-persistence.mjs`](../harness/checks/swipe-persistence.mjs):
15/15 assertions passed on 2026-11-16 against a scratch instance of `3050e9a40`
with the mock game master (five model calls: first turn, regenerate, continue,
second turn, regenerate). The game used no ruleset, because a fresh data
directory has none installed; the check exercises metadata persistence, which
does not depend on the ruleset. Repeat it with the Inquisition ruleset once that
package exists.

### Game build (source and observed)

`chat.metadata.gameCharacterCards[].rulesetSheet` is one value per chat. No swipe,
regenerate, continue, message-delete or checkpoint path restores chat metadata
from a snapshot (`routes/chats.routes.ts` swipe routes ~3945–4101;
`services/storage/chats.storage.ts:1190-1233`; `services/game/checkpoint.service.ts:64-160`).
Live per-turn values live in `game_state_snapshots.ruleset_live`, one row per
message and swipe, and do rewind.

Caveats that shape the fitness module:

- The only external write path is `PATCH /api/chats/:id/metadata`, a top-level
  shallow merge: the whole `gameCharacterCards` array is replaced, last writer
  wins, with no version check and no `rulesetSheet` validation. Session
  conclusion, party recruitment and the client's Edit Sheet also write the whole
  array, and the client sends its cached copy. A malformed envelope silently
  drops that card out of sheet commands.
- **Default:** the fitness module writes builds server-side inside Marinara
  (not over HTTP), re-reads the chat immediately before writing, changes only
  its own card fields, validates the envelope, and re-applies outstanding
  projections on load if a concurrent writer clobbered them. Projection receipts
  live in a fitness-owned metadata key, which nothing else writes.

### Inventory (source and observed)

The authoritative stacks are chat-global (`chat.metadata.gameInventory`). Swipe
"rewind" is a heuristic for the latest turn only: switching or regenerating
restores a telling's stacks only if nothing changed them since
(`shared/utils/game-inventory-turns.ts`; `services/game/game-inventory.service.ts:348-368`).
An external add therefore neither duplicates nor undoes. `POST /api/game/inventory`
has no idempotency key.

**Default:** grant items through a committed UI action recorded in the ledger,
with the grant ID stored alongside so a retry is detected; never through a
narrated turn.

### Locked dice (source)

Two existing behaviors (`services/game/dice-pool.service.ts:245-377`;
`routes/generate.routes.ts:4370-4392, 10193-10216, 10399-10408`):

- Default path: rolls are stored per swipe in `message_swipes.extra.diceRollResults`;
  continue keeps them, regenerate rolls fresh.
- Sighted pool (`gameOneRequestDice` with `gameDicePoolMode`): a `game_dice_pools`
  row keyed by chat, assistant message and swipe; regenerate and swipe re-read
  the earliest row for the message, so every telling faces the same values.

**Default extension point:** commit mechanical results keyed on the **player's
user message**, which is created before generation (`generate.routes.ts:1304-1340`)
and shared by every swipe and regenerate of the reply. Keying on the assistant
message (the dice-pool pattern) leaves nothing behind when a first generation
fails. The module resolves dice, grants and outcomes into that record before
the model is called, injects them as committed facts, and every retelling reads
the same record. The reroll resource replaces the record once and logs it.

There is no server-side event bus or swipe/commit hook. The module hooks the
generate route directly; a snapshot's `committed` flag is set only when the next
user message arrives (`generate.routes.ts:1305-1337`).

### Other source facts

- Provider `custom` is an OpenAI-compatible client with any `baseUrl`; loopback
  works. No mock provider ships; Marinara's own e2e tests use a fake HTTP server.
- Game creation: `POST /api/game/create` (optional pinned `ruleset: {id, version}`),
  LLM-free setup through `POST /api/game/setup/apply-json`, then `POST /api/game/start`.
- Rulesets install as capability packages under `DATA_DIR/capability-packages`
  (kind `ruleset`, hash-pinned `ruleset.json`); `GET /api/capability-packages/rulesets`
  lists them.
- Scripted callers without `Origin`/`Referer`/`Sec-Fetch-Site` headers pass the
  CSRF hook; browsers send the shared CSRF header.

## Scratch environment

A scratch Marinara for checks and internal playtests runs on den-agents from a
copy of `custom/agent-turn` (`3050e9a40`) at
`~/dev/lore-fitness-rpg-work/marinara-custom`, with Node 24 and an isolated
`DATA_DIR`. It never touches Lore's installation or data. Model calls go to the
scripted mock game master in [`harness/mock-gm`](../harness/mock-gm/server.mjs).
See the [harness README](../harness/README.md) for setup and the playtest profile.
