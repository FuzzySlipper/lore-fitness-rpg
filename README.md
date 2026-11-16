# Lore Fitness RPG

A persistent, character-driven fitness RPG for Marinara, with Android and Wear OS
companions. The first campaign takes place in Dragon Age: Inquisition: real-world
activity contributes to character development, preparation, companion scenes and
playable expeditions.

**Current state:** planning and repository setup. Application code, phone/watch
apps and runtime deployment have not been implemented. The intended first
playtest is a complete, stable campaign experience; engineering checks happen
throughout development.

## Start here

- [Implementation outline](docs/implementation.md): product scope, architecture,
  deployment, stage dependencies and the first-playtest target.
- [Progress and decisions](docs/progress.md): current work, ownership, decisions
  and handoffs.
- [Platform and source references](docs/references.md): what was inspected and
  what still needs device verification.
- [Agent instructions](AGENTS.md): how to work on and coordinate this project.

| Stage | Plan |
| --- | --- |
| 1 | [Platform contract and integration checks](docs/01-platform-contract.md) |
| 2 | [Durable activity and progression mechanics](docs/02-durable-mechanics.md) |
| 3 | [Marinara campaign and DSH integration](docs/03-marinara-integration.md) |
| 4 | [Android and Wear OS companions](docs/04-phone-and-watch.md) |
| 5 | [Inquisition ruleset and complete campaign](docs/05-campaign-season.md) |
| 6 | [Stabilization, deployment and first playtest release](docs/06-stabilization-and-release.md) |

## Deployment and devices

All desktop runtime components will run together on **den-lore**, an always-on
Windows desktop:

- This checkout: `C:\Dev\lore-fitness-rpg`
- Existing custom Marinara: `C:\Dev\Marinara-Custom`
- Existing DSH integration: `C:\Dev\Marinara-DSH`

The Linux development checkout is `/home/agent/dev/lore-fitness-rpg`.
The target devices are a **OnePlus Watch 3** and **Motorola razr ultra (2025)**.
Actual firmware and OHealth export coverage remain to be measured.

The planned fitness service and its ledger run on den-lore alongside Marinara
and DSH. Mobile clients retain queued entries while away from the LAN or during
desktop maintenance. Keep runtime data outside the source checkout; the proposed
data root is `C:\Dev\Lore-Fitness-RPG-Data`.

## Coordination

The project discussion lives in crew thread
**`den-01M6WSZV8VFGDJPDSXTE1QS7YF`**, on the `lore-rpg` board, titled
“Dragon Age: Inquisition | Fitness RPG Character Card”.

Use repository Markdown for task detail and durable handoffs. Post major
milestones, decisions and coordination needs to that existing crew thread.
**Do not create Den tasks for this project.** The docs are the current
implementation authority; earlier research is background.

For Codex, read the thread with:

```sh
crew-codex board read den-01M6WSZV8VFGDJPDSXTE1QS7YF --unfold
```

Use your own harness's crew driver when working from another agent environment.

This public repository holds code, documentation and synthetic fixtures. Device
credentials, real activity history, personal chat exports and runtime logs stay
outside Git. No install or run commands are provided until runnable components
exist.
