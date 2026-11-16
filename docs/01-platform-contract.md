# Stage 1 — Platform contract and integration checks

Status: In progress. Owner: Claude Code session `s/a60d803335a9aa0a` (started 2026-11-16). Updated: 2026-11-16.

[Outline](implementation.md) · [Progress](progress.md) ·
[Next: durable mechanics](02-durable-mechanics.md)

## Outcome

Confirm the few runtime assumptions the defaults in the
[implementation outline](implementation.md) depend on, and fix the den-lore
runtime arrangement. This stage no longer gates the others: stages 2–5 start
now from the recorded defaults, and a check that cannot be answered quickly is
replaced by a recorded default rather than blocking work.

These checks are engineering bring-up. Lore's first campaign playtest remains
the complete release described in the outline.

## Targeted checks

- [x] **Game build survives swipes at runtime.** Observed 2026-11-16 on a scratch
  instance; see [findings](platform-findings-2026-11-16.md). Write a level/build change to
  `chat.metadata.gameCharacterCards[].rulesetSheet` in a scratch Game Mode chat,
  then swipe, regenerate and continue the turn. Marinara's design notes say the
  game build does not rewind; confirm it in the running build.
- [x] **Inventory rewind behavior.** Observed for UI-path adds and source-traced
  2026-11-16. Determine whether inventory stacks rewind
  with swipes. If they do, apply crafted or granted items through the committed
  UI-action path rather than through a narrated turn.
- [x] **Locked dice.** Source-traced 2026-11-16; default extension point recorded. Trace how the pre-thrown dice queue keeps swipe,
  regenerate and continue on the same values, and where the fitness module can
  extend that guarantee to every mechanical turn.
- [ ] **Device capture.** With Lore's razr and Watch 3 available, record the
  watch variant, Wear OS, Android and OHealth versions; which records OHealth
  writes to Health Connect (steps, exercise sessions, duration, distance, sleep,
  heart rate, hydration); typical delay before records appear; Health Services
  capabilities; and the paired-device Data Layer path.
- [x] **den-lore runtime.** Default plan recorded 2026-11-16 (port 7900, startup
  Scheduled Task with S4U, Private-profile firewall rule). Choose the service port, data directory, Windows
  startup mechanism and firewall rule, and note how Windows Update reboots
  affect startup order with Marinara and DSH.
- [x] Reinspect the current custom Marinara and DSH revisions, their repository
  instructions and build paths, and record commit pointers.

## Current findings

[Platform findings 2026-11-16](platform-findings-2026-11-16.md). Main surprises:
the Marinara Lore runs is `C:\Dev\Marinara-Engine` (`local/cartesia-2.4.6`),
not `Marinara-Custom`; build writes go through a whole-array, last-writer-wins
metadata patch; and the locked-result record should key on the player's user
message. Remaining: the device capture, pending connection of Lore's devices.

## Defaults if a check is inconclusive

| Check | Default |
| --- | --- |
| Game build rewinds after all | Store projected level/build in a fitness-module table keyed by game and apply it on load |
| Inventory rewinds | Grant items only through explicit UI actions recorded in the ledger |
| A Health Connect record type is missing | Treat that category as manual entry plus watch quick check-in |
| OHealth export delay is long | Show the item as pending import; manual entry stays available and later imports collapse into the same daily check-in |
| Port conflict | Pick the next free port above 7900 and record it |

## Contracts to establish

Record a versioned activity envelope: event ID, source/source record identity,
revision, activity type, start/end time, timezone offset, quantities/units and
recording/import timestamps. Define corrections, deletion and the difference
between an unavailable measurement and a recorded zero.

Define acknowledgment and retry behavior for watch → phone → service delivery.
Identify which source owns a workout and how a Health Connect copy maps back to
it. Sketch campaign/grant identity separately from chat/message identity.

Any proposed Marinara operation must be labeled new work; do not claim an
existing XP or general-purpose DSH tool API that the inspected code lacks.

## Deliverables

- A dated platform findings document under `docs/`, linked from this stage.
- Synthetic example events and small runnable probes. Real device data stays
  local; commit only redacted summaries or synthetic equivalents.
- A den-lore runtime plan including the service/data path, port and startup
  approach. The proposed persistent-data root is `C:\Dev\Lore-Fitness-RPG-Data`.

Do not provision a separate LAN server. Keep Marinara, DSH, the fitness service
and ledger together on den-lore as Patch requested.

## Acceptance evidence

- [ ] Each targeted check has an observed result or a recorded default (all but
  the device capture, 2026-11-16).
- [ ] The device capability matrix distinguishes observed, unsupported and
  untested values.
- [ ] The chosen Windows service arrangement can coexist with the existing apps
  (port 7900 observed free; not yet installed).

Do not silently turn simulated results into device verification.

## Handoff

Update the owner/status and findings links here and in [progress.md](progress.md).
Post confirmed capabilities and any default that changed to the crew thread.
