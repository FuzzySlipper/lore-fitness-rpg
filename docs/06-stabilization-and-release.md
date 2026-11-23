# Stage 6 — Stabilization, deployment and first playtest release

Status: In progress. The fitness ledger runs on den-lore and a staged Marinara build with the fitness module passes its smoke test there; Lore's running Marinara is not switched yet. Owner: Claude Code session `s/a60d803335a9aa0a` (harness since 2026-11-16, deployment since 2026-11-23). Updated: 2026-11-23.

[Outline](implementation.md) · [Progress](progress.md) ·
[Previous: ruleset and campaign](05-campaign-season.md)

## Outcome and dependencies

Deliver the integrated first season and native companions as a reasonably stable,
maintainable installation on den-lore. All stages 1–5 must have their promised
features integrated, and an internal full-season playthrough must pass, before
calling this Lore's first complete playtest release.

Testing is matched to the real claims: retained activity, consistent rewards,
locked results, working combat/campaign flow, usable devices and recoverable
updates. Avoid enterprise or hostile-user exercises in this household project.

## Internal playtest harness

Lore's attention is the bounded resource, so agents play the campaign first.
Build the harness now, alongside the other stages.

- [x] Hosted scratch Marinara with a scripted mock game master, registered as
  playtest profile `lore-fitness-marinara`; a session booted and rendered
  Marinara on 2026-11-16. See [`harness/`](../harness/README.md).
- [x] Real game-master model for tone, voice and pacing playtests: Gemma 4 26B
  A4B (MTP) on Patch's LAN Lemonade servers, as playtest profile
  `lore-fitness-marinara-live`; real Game Mode turns observed on 2026-11-16 (see
  [Real-model default](#real-model-default)).
- [ ] Drive Marinara's real Game Mode UI (the `product-playtest` crew service is
  one option) against a scratch ledger fed by the stage 2 synthetic history
  generator.
- [x] Persona definitions in [`harness/personas.json`](../harness/personas.json).
- [ ] Scripted persona sessions: steady routine, busy weeks, illness/recovery stretch,
  several missed days and a return after a break.
- [ ] Record per session: rewards granted, rolls, locked results under swipes,
  companion voice and knowledge, pacing, and anything confusing or dull.
- [ ] Use findings to tune rules and content; file defects as small synthetic
  repros in the owning stage.

### Real-model default

| Item | Default |
| --- | --- |
| Model | `Gemma-4-26B-A4B-it-MTP-GGUF` (Q4_K_M with an MTP draft), served by Lemonade 2026.46.2 with llama.cpp Vulkan, 262144-token context, one request at a time per server |
| Servers | den-nimo `http://192.168.1.23:13305/api/v1` (default) and den-m5 `http://192.168.1.24:13305/api/v1` (second concurrent playtest or fallback). Set up by Patch; no API key |
| Marinara connection | Provider `custom`, created by `serve-scratch-marinara.sh --model-url`; scratch Marinara needs `PROVIDER_LOCAL_URLS_ENABLED=true` to reach LAN addresses |
| Reasoning | Off. Game Mode requests maximum reasoning by default; with this thinking model that truncated a reply and leaked about 16,000 characters of planning into the story. The connection's default parameters set reasoning to none, so Marinara sends `chat_template_kwargs.enable_thinking=false` |
| Observed speed | 5–11 s per Game Mode turn with reasoning off (about 70 tokens/s generation), against 24–66 s with it on |
| Payer | None; Patch's own hardware. Never Lore's provider connections |

Mechanical checks keep using the mock game master, which is deterministic and
free. [`harness/checks/real-turn.mjs`](../harness/checks/real-turn.mjs) is the
smoke check for a real model: two turns and a regenerate with their timing and
opening text. Its Cullen and Cassandra replies used Game Mode speaker tags and
stayed in voice; one called Cassandra's armor "templar", a lore slip for the
stage 5 lorebooks to correct.

## Windows deployment work

- [x] Document the actual service install, build, start, stop and update commands.
  See the [den-lore runbook](#den-lore-runbook).
- [ ] Deploy the fitness service on den-lore alongside custom Marinara and DSH.
  The ledger runs (2026-11-23); Marinara with the fitness module is staged and
  smoke-tested, not yet Lore's running copy.
- [x] Use the selected separate data directory, with backups outside the source
  checkout and a documented restoration procedure.
- [ ] Configure the agreed Windows startup mechanism and recovery after restarts,
  including Windows Update reboots. Boot task and crash restart are in place;
  the restart after a reboot is not yet observed.
- [x] Document ports, the firewall rule and how phone/watch clients find the
  service, without putting credentials or signing material in Git. Phone/watch
  use `http://192.168.1.25:7900`; there are no credentials.
- [ ] Verify startup order and reconnect when Marinara or DSH starts later.
- [ ] After running `content/install.mjs` on den-lore, reload any Marinara tab
  Lore already has open (tablet, phone, desktop) and confirm the game appears
  in the GM list. Open tabs do not refresh that list by themselves; see
  [stage 3](03-marinara-integration.md#campaign-views-2026-11-22).
- [ ] Record compatible revisions of this project, Marinara, DSH, the ruleset,
  content packs and native apps, plus the Marinara update procedure.
- [ ] Provide readable diagnostics for queued data, import failures, pending
  rolls, campaign projection and narrative fallback.

The checkout is `C:\Dev\lore-fitness-rpg`; the runtime data root is
`C:\Dev\Lore-Fitness-RPG-Data`. The observed setup is in the
[den-lore runbook](#den-lore-runbook). Keep existing Marinara/DSH customizations
intact.

## den-lore runbook

Set up 2026-11-23 by Claude Code `s/a60d803335a9aa0a`. den-lore is Windows 11 at
`192.168.1.25`, user `lore`; agents reach it with `~/server-access/den-lore/connect`.

### Fitness ledger (running)

| Item | Value |
| --- | --- |
| Code | `C:\Dev\lore-fitness-rpg` (clone of the public repo, `main`) |
| Node | The newest Node ≥ 24 under fnm (`%APPDATA%\fnm\node-versions`), now v25.9.0; nothing to `npm install` |
| Data | `C:\Dev\Lore-Fitness-RPG-Data`: `ledger.sqlite`, `backups\` (one per start, last ten), `logs\ledger.log` (rotated at 10 MB) |
| Address | `0.0.0.0:7900`; LAN clients use `http://192.168.1.25:7900`; Marinara on the same machine uses the default `http://127.0.0.1:7900` |
| Firewall | Inbound rule "Lore fitness ledger": TCP 7900, Private profile, local subnet only |
| Startup | Scheduled task `lore-fitness-ledger`: at boot, as `lore` (S4U, no password stored, no window), restart every minute on failure, no time limit. It runs `deploy\windows\run-ledger.ps1`, which restarts the service 5 s after any exit |
| Off-machine backup | Scheduled task `lore-fitness-ledger-backup` daily at 20:30 writes a consistent copy to `Documents\Lore Fitness RPG\ledger-backups\ledger-YYYYMMDD-HHmm.sqlite` (last 30 kept); the existing "Den Windows Backup" task backs up `Documents` |

Commands, from an elevated PowerShell on den-lore:

- Install or update: `cd C:\Dev\lore-fitness-rpg; git pull --ff-only; powershell -ExecutionPolicy Bypass -File deploy\windows\install-ledger.ps1`.
  Safe to repeat; it replaces the tasks and firewall rule, keeps the data and
  restarts the service.
- Stop: `Stop-ScheduledTask lore-fitness-ledger`, then end the `node.exe` whose
  command line has `src\main.ts` (the task's loop would restart it otherwise).
  Start: `Start-ScheduledTask lore-fitness-ledger`.
- Health and state: `curl http://127.0.0.1:7900/healthz`, `/v1/status`; or
  `node src\cli.ts status --data C:\Dev\Lore-Fitness-RPG-Data` in `service\`.
- Backup now: `Start-ScheduledTask lore-fitness-ledger-backup`.
- Restore: stop as above; copy the chosen backup over
  `C:\Dev\Lore-Fitness-RPG-Data\ledger.sqlite` and delete any
  `ledger.sqlite-wal`/`-shm` beside it; start. Marinara notices a ledger older
  than what a game already saw and asks before continuing (stage 3).
- Remove: unregister both tasks, remove the firewall rule; the data folder and
  backups stay until deleted by hand.

Verified 2026-11-23: the installer registered both tasks and the rule; the
ledger answered `/healthz` locally and from den-agents over the LAN; killing
its `node.exe` brought it back within about 6 s; the backup task wrote a copy
into Documents. Not verified: a real reboot (the boot trigger) and a Windows
Update restart. The ledger is empty: no device or game is connected to it yet.


### Marinara with the fitness module (staged)

Lore's running Marinara is `C:\Dev\Marinara-Engine` on `local/cartesia-2.4.6`
(Marinara 2.5.0 plus her local patches, despite the branch name), started by its
`start.bat` through fnm on port 7860. It is one worktree of the repository in
`C:\Dev\Marinara-Custom`; others are `Marinara-GroupTurns`,
`Marinara-GroupTurns-i18n` and a Codex worktree under Documents, and
Marinara-Engine has uncommitted changes (about 15 files, 2026-11-23) from
whoever is working there. Its "Den Windows Backup" does not include
`C:\Dev\Marinara-Data`.

- `fitness/module` now contains `local/cartesia-2.4.6` up to its newest commit
  (`ab2ea3214`, persona voices; merged in Marinara `bdfc7810e`, only the
  changelog conflicted), so Lore's branch can later fast-forward to it.
- A staging worktree, `C:\Dev\Marinara-Fitness-Staging` (detached at
  `bdfc7810e`), is built with the repository's pinned pnpm 10.34.5 under Node
  25.9.0 (`pnpm install --frozen-lockfile`, `pnpm build`; about 6 minutes).
- [`deploy/windows/staging-smoke.ps1`](../deploy/windows/staging-smoke.ps1) runs
  that build on loopback ports 7871 (Marinara), 7872 (scripted game master) and
  7901 (a ledger seeded from the steady persona), installs a game and runs the
  combat and swipe checks, then stops everything. On 2026-11-23 on den-lore:
  combat-preparation 26/26, swipe-persistence 15/15. Lore's Marinara and the
  real ledger were not touched.

Default recorded: **Lore's running Marinara is switched at the release, not
now.** Lore tests only the complete experience, and stage 4 (phone and watch)
has not started, so neither the fitness module nor the campaign appears in her
Marinara before then. The switch also needs the uncommitted work in
Marinara-Engine committed or set aside by its owner. At release:

1. Back up `C:\Dev\Marinara-Data`, Marinara-Engine's `.env` and the ledger
   (`Start-ScheduledTask lore-fitness-ledger-backup`), and add
   `C:\Dev\Marinara-Data` to "Den Windows Backup" or copy it under Documents.
2. Merge Lore's newest `local/cartesia-2.4.6` into `fitness/module` again, run
   `pnpm check` and the scratch checks (stage 3 update procedure), rebuild the
   staging worktree and run `staging-smoke.ps1`.
3. In Marinara-Engine, once its working tree is clean, fast-forward
   `local/cartesia-2.4.6` to `fitness/module`, `pnpm install`, `pnpm build`,
   restart Marinara (its `start.bat`). The fitness module reads the ledger at
   the default `http://127.0.0.1:7900`; nothing to set in `.env`.
4. Run `content/install.mjs --base http://127.0.0.1:7860 --name "…"` with Lore's
   chosen name, race and class, then reload her open Marinara tabs.

## Integrated acceptance scenarios

Run an accelerated soak with synthetic history plus a few real days on Lore's
devices. Include:

- [ ] Normal activity import, manual check-ins and app-recorded drills.
- [ ] Duplicated delivery, delayed import and overlapping step/workout sources.
- [ ] A corrected/backdated activity and a visible, sensible reward adjustment.
- [ ] Phone/watch restart, lost connection and a week of queued activity.
- [ ] den-lore/service restart and temporary Marinara/DSH unavailability.
- [ ] Loss of acknowledgment after a resolved dice roll or applied grant.
- [ ] Chat regeneration, swipes and continuation keep locked results; the reroll
  resource changes a result once.
- [ ] A complete activity → reward → preparation → combat → saved result loop.
- [ ] The internal full-season playthrough, including important companion choices.
- [ ] Recovery days, several missed days and resuming after a break.
- [ ] Backup restoration with consistent activity and campaign state.
- [ ] A real update/migration with existing saves, pairing and pending entries.

For each scenario record the build/commit, environment, steps, expected result,
actual result and remaining gap. Use small reusable synthetic repros for defects.
Label accelerated runs as such; do not present them as real-time soaks or
physical-device tests.

## Device quality

- [ ] Measure release-build battery cost once against a comparable baseline.
- [ ] Record expected/observed sync and interaction latency; distinguish scheduled
  background imports from immediate user actions.
- [ ] Check readable phone/watch UI, tap targets, folded/unfolded phone behavior,
  ambient watch presentation, shake-to-roll, ravens, notifications and quiet hours.
- [ ] Confirm permission changes and unavailable optional sensors leave a useful
  manual path with clear status.

Set battery/latency acceptance targets from observed devices and record the
chosen targets. Do not invent measurements or claim all OHealth metrics exist.

## Packaging and distribution

- [ ] Produce reproducible phone/watch release APKs and sideload instructions,
  with versioning that permits in-place updates.
- [ ] Keep package identity and the single local signing key consistent between
  paired modules; store the key outside the repository with a backup.
- [ ] Write release notes with known limitations and rollback/recovery steps.

Play Console distribution is out of scope for this household release.

## Release completion

- [ ] Stage statuses and evidence links accurately reflect the delivered features.
- [ ] No unresolved defect loses accepted activity, duplicates grants, rerolls a
  saved reward, unlocks a locked result or breaks the primary campaign flow.
- [ ] Remaining limitations are explicit and have useful handling where possible.
- [ ] Another agent can find the runtime, diagnose a failed sync, update the
  installation and restore data using repository Markdown.
- [ ] Post the release location, compatible revisions, validation summary and
  known limitations to crew thread `den-01M6WSZV8VFGDJPDSXTE1QS7YF`.

Update [progress.md](progress.md) with the finished release and the next work.
Future feedback and fixes continue in repository Markdown with major updates
on that crew thread, not a new Den task backlog.
