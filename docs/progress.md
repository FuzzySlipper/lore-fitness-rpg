# Progress and decisions

Updated: 2026-11-15.

## Current state

The repository contains the implementation outline, six stage plans and agent
coordination instructions. No application feature or runtime deployment is
complete. The next implementation work is stage 1.

| Stage | Status | Owner | Next action |
| --- | --- | --- | --- |
| [1 — Platform contract](01-platform-contract.md) | Planned | Unassigned | Inspect current integrations and arrange the narrow phone/watch capability checks |
| [2 — Durable mechanics](02-durable-mechanics.md) | Planned | Unassigned | Implement the ledger after stage 1 establishes event and integration contracts |
| [3 — Marinara integration](03-marinara-integration.md) | Planned | Unassigned | Trace Game Mode commit/checkpoint paths before adding projection and DSH support |
| [4 — Phone and watch](04-phone-and-watch.md) | Planned | Unassigned | Build native clients against the verified platform and ledger contract |
| [5 — Campaign season](05-campaign-season.md) | Planned | Unassigned | Establish canon/world-state structure and author the first season |
| [6 — Stabilization and release](06-stabilization-and-release.md) | Planned | Unassigned | Integrate completed stages, then run the release acceptance scenarios |

## Confirmed decisions

| Date | Decision | Source |
| --- | --- | --- |
| 2026-11-08 | Dragon Age: Inquisition fitness RPG, requested cards/lorebooks, supported dice/combat and non-punitive motivation | Lore's original crew-thread post |
| 2026-11-15 | Ambitious, expandable scope with a complete and reasonably stable first full testing release | Patch's planning request and acceptance |
| 2026-11-15 | Deploy the fitness service and ledger on den-lore with Marinara and DSH; the desktop is always on | Patch's explicit hosting correction |
| 2026-11-15 | Target OnePlus Watch 3 and Motorola razr ultra (2025) | Patch's device information |
| 2026-11-15 | Public `lore-fitness-rpg` repository; stage plans and handoffs in Markdown; major coordination on the existing crew thread instead of Den tasks | Patch's repository/coordination request |

Architecture details in the stage plans are the accepted starting direction.
Unresolved implementation details remain proposals until verified or selected;
record material changes here and on the crew thread.

## Open facts to establish

- Actual Android, Wear OS and OHealth versions, watch variant, exported record
  types and observed synchronization cadence.
- Fitness service port, Windows startup mechanism and backup location on den-lore.
- Exact Game Mode and DSH adapter contract for the current custom revisions.
- Rule balancing, default combat presentation and campaign world-state choices.
- Device battery/latency baselines and the eventual distribution account.

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
