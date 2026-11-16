# Progress and decisions

Updated: 2026-11-16.

## Current state

The repository contains the implementation outline, six stage plans and agent
coordination instructions. No application feature or runtime deployment is
complete. Stages 1–5 and the stage 6 playtest harness can start now in parallel
from the recorded defaults; see [Stages and dependencies](implementation.md#stages-and-dependencies).

| Stage | Status | Owner | Next action |
| --- | --- | --- | --- |
| [1 — Platform contract](01-platform-contract.md) | In progress | Claude Code `s/a60d803335a9aa0a` | Swipe, inventory and dice checks done; device capture waits on Lore's razr and Watch 3 being connected |
| [2 — Durable mechanics](02-durable-mechanics.md) | Planned | Unassigned | Build the ledger with the default daily check-in reward model and the synthetic history generator |
| [3 — Marinara integration](03-marinara-integration.md) | Planned | Unassigned | Build the fitness module: game-build projection, locked results and committed UI actions; DSH after |
| [4 — Phone and watch](04-phone-and-watch.md) | Planned | Unassigned | Build phone/watch modules against Health Connect and the stage 2 API, including the watch gadget features |
| [5 — Ruleset and campaign](05-campaign-season.md) | Planned | Unassigned | Write the Inquisition ruleset package and author the season with the canon defaults |
| [6 — Stabilization and release](06-stabilization-and-release.md) | Harness in progress | Harness: Claude Code `s/a60d803335a9aa0a` | Harness scaffold works; next, scripted persona sessions and a real-model connection |

## Confirmed decisions

| Date | Decision | Source |
| --- | --- | --- |
| 2026-11-08 | Dragon Age: Inquisition fitness RPG, requested cards/lorebooks, supported dice/combat and non-punitive motivation | Lore's original crew-thread post |
| 2026-11-15 | Ambitious, expandable scope with a complete and reasonably stable first full testing release | Patch's planning request and acceptance |
| 2026-11-15 | Deploy the fitness service and ledger on den-lore with Marinara and DSH; the desktop is always on | Patch's explicit hosting correction |
| 2026-11-15 | Target OnePlus Watch 3 and Motorola razr ultra (2025) | Patch's device information |
| 2026-11-15 | Public `lore-fitness-rpg` repository; stage plans and handoffs in Markdown; major coordination on the existing crew thread instead of Den tasks | Patch's repository/coordination request |
| 2026-11-16 | Front-loaded complete build, not a vertical slice; Lore tests only the complete experience; choose and record sensible defaults instead of asking for guidance | Patch, in plan review |
| 2026-11-16 | Mechanical results are committed before narration; swipes rewrite only the prose. A recovery-earned reroll resource is the sanctioned exception | Patch's direction; reroll resource is an agent-proposed default |
| 2026-11-16 | The watch is an engagement feature because Lore loves gadgets; playful watch uses are in scope | Patch, in plan review |
| 2026-11-16 | Lore's razr and Watch 3 can be made available for agent testing; Lore's time and attention are the bounded resource | Patch, in plan review |
| 2026-11-16 | Upstreaming to Marinara is unnecessary; keep changes modular, but a sprawling fork is acceptable when the functionality needs it | Patch, in plan review |
| 2026-11-16 | Lore plays the Inquisitor directly; the Inquisitor's race (human, elf, dwarf, Qunari) must be easy to change | Lore, relayed by Patch |
| 2026-11-16 | Defaults adopted: ledger-authoritative progression projected into the Game Mode game build; daily category check-ins with caps; Inquisition ruleset package; DSH as an optional toggle built last; no checkpoint restore; sideloaded APKs, no Play Console; internal agent playtesting; canon defaults in stage 5 (the agent-not-Inquisitor default was later replaced by Lore's choice) | Agent-proposed defaults under Patch's defaults-over-questions direction |

Architecture details in the stage plans are the accepted starting direction.
Unresolved implementation details remain proposals until verified or selected;
record material changes here and on the crew thread.

## Open facts to establish

These no longer block work; each has a recorded default in the owning stage.

- Actual Android, Wear OS and OHealth versions, watch variant, exported record
  types and observed synchronization cadence (stage 1 device capture).
- Runtime confirmation that the game build survives swipes, and whether
  inventory rewinds (stage 1).
- Fitness service port, Windows startup mechanism and backup location on den-lore.
- Tuned reward numbers and combat balance (stages 2 and 5, via internal playtests).
- Device battery/latency baselines.

## How to update this file

Use `Planned`, `In progress`, `Blocked` or `Complete` with a short explanation
when needed. Keep the status here consistent with the relevant stage document.
For a handoff, include the owner/session, date, files or components changed,
commit references, evidence actually obtained, unresolved work and next action.
Device-dependent work can remain open while independent implementation proceeds.

Post major updates to crew thread `den-01M6WSZV8VFGDJPDSXTE1QS7YF` on `lore-rpg`.
Name Patch or Lore when attributing a decision; do not convert an agent's
suggestion into an owner request. Never mark an acceptance item complete merely
because its code or plan exists.

## Work log

### 2026-11-15 — Planning scaffold

Codex session `s/ae5ff1cf833e7d5d` prepared the implementation outline, individual
stage plans, source map and coordination instructions. The plan incorporates
Patch's choice to keep all desktop components on den-lore. Feature implementation
and physical-device validation remain unstarted.

Repository setup is complete:

- Public repository: [FuzzySlipper/lore-fitness-rpg](https://github.com/FuzzySlipper/lore-fitness-rpg).
- Initial planning commit: `825bc96d682c28928e55d0f99b80d6fa1f3e3bb6` on `main`.
- Development checkout: `/home/agent/dev/lore-fitness-rpg`.
- den-lore checkout: `C:\Dev\lore-fitness-rpg`, cloned from the public repository.
- Validation: all 11 Markdown files checked for relative links and whitespace;
  all six stage plans have consistent initial status; `git diff --cached --check`
  passed. GitHub visibility was verified as public and the initial remote clone
  was clean at the planning commit.

These are repository/document checks. No fitness service or native application
was installed or started, and no product test was claimed.

### 2026-11-16 — Plan review and defaults

Claude Code session `s/a60d803335a9aa0a` reviewed the plan with Patch against the
crew thread and a read-only inspection of `C:\Dev\Marinara-Custom` on den-lore
(still `3050e9a`; Marinara running on port 7860). Source findings from Marinara's
own docs: Game Mode awards no XP automatically and level-up is manual; live
sheet values rewind with swipes while the game build does not; checkpoints have
no in-app restore; custom ruleset packages are supported; by default a
regenerated turn rolls new dice, while the pre-thrown dice queue keeps values
across swipes.

Patch then set the direction recorded in the decisions table: a front-loaded
complete build with defaults over questions, locked mechanical results, the
watch as a gadget-engagement feature, Lore's devices available for agents, and
fork sprawl accepted. The outline, AGENTS.md, all six stage plans and the
reference map were revised accordingly.

Validation: Markdown relative links and anchors checked; whitespace checked. This
is a documentation change; no application code was written or run and no device
was tested. Next action: assign owners and start stages 1–5 and the stage 6
playtest harness in parallel.

### 2026-11-16 — Stage 1 checks and playtest harness scaffold

Claude Code session `s/a60d803335a9aa0a`. Lore chose (via Patch) to play the
Inquisitor directly with an easily changed race; stage 5 canon defaults updated
in `2105951`.

Stage 1, recorded in [platform findings](platform-findings-2026-11-16.md):

- **Observed on den-lore:** Lore runs `C:\Dev\Marinara-Engine` on
  `local/cartesia-2.4.6` (`7ec172600`) with data in `C:\dev\Marinara-Data`;
  `Marinara-Custom`'s `custom/agent-turn` (`3050e9a40`) is one undeployed commit
  ahead and exists only locally. Port 7900 is free; no automatic logon.
- **Observed on a scratch Marinara:** a projected build in
  `gameCharacterCards[].rulesetSheet`, a fitness metadata key and a UI-path
  inventory grant all survived regenerate, swipe switch, continue and a later
  turn's regenerate (`harness/checks/swipe-persistence.mjs`, 15/15).
- **Source-traced:** metadata writes are whole-array last-writer-wins; inventory
  rewind is a latest-turn heuristic; the locked-result record should key on the
  player's user message.
- **Pending:** device capture. adb is installed on den-agents; the devices are
  not connected yet.

Playtest harness: mock game master, scratch-Marinara launcher, den-serve manifest,
playtest profile `lore-fitness-marinara` (a session booted and rendered the
Marinara home screen, then was stopped) and persona definitions. Not yet built:
scripted persona sessions, scratch ledger, real-model connection.

Validation: the swipe-persistence check above; link/anchor check of all
Markdown. No fitness service or native app exists yet, and nothing was installed
on den-lore.
