# Stage 1 — Platform contract and integration checks

Status: Planned. Owner: Unassigned. Updated: 2026-11-15.

[Outline](implementation.md) · [Progress](progress.md) ·
[Next: durable mechanics](02-durable-mechanics.md)

## Outcome

Replace uncertain integration assumptions with observed contracts. Establish the
smallest engineering path from an activity source to a durable scratch receipt
and identify the exact Marinara/DSH hooks the complete product will use.

These checks are engineering bring-up. Lore's first campaign playtest remains
the complete release described in the outline.

## Scope

- Reinspect the current custom Marinara and DSH revisions, their repository
  instructions, running/build paths and any changes since the source snapshot.
- Establish the maintained source for the installed DSH stage bundle before
  editing generated files. Record cross-repository ownership and commit pointers.
- Record actual watch variant, Wear OS version, Android version and OHealth
  version. Confirm Health Connect availability on the Razr.
- Inspect which activity records OHealth writes: steps, exercise sessions,
  duration, distance and optional sleep/heart-rate fields. Measure the delay
  between a completed activity and an available record.
- Query the watch's Health Services capabilities. Check supported exercise types,
  measurements and the paired-device communication path.
- Establish the Windows runtime arrangement on den-lore: service port,
  application/data directories, launch mechanism and startup ownership.

## Work checklist

- [ ] Read and record current source revisions and relevant integration symbols.
- [ ] Trace accepted Game Mode turns, dice results, combat completion,
  regeneration, swipes and checkpoint restore.
- [ ] Identify how committed activity summaries can enter the existing DSH team
  without losing Game Mode's structured output and state handling.
- [ ] Produce a device capability/export matrix with observed, unsupported and
  untested values distinguished.
- [ ] Receive one OHealth/Health Connect event in a scratch journal.
- [ ] Receive one manually entered event and one custom-watch event.
- [ ] Replay duplicate delivery and show that the event identity remains stable.
- [ ] Select and document the initial API contracts and local service deployment
  arrangement on den-lore.

## Contracts to establish

Record a versioned activity envelope: event ID, source/source record identity,
revision, activity type, start/end time, timezone offset, quantities/units and
recording/import timestamps. Define corrections, deletion and the difference
between an unavailable measurement and a recorded zero.

Define acknowledgment and retry behavior for watch → phone → service delivery.
Identify which source owns a workout and how a Health Connect copy maps back to
it. Sketch campaign/grant identity separately from chat/message identity.

Use the current Marinara dice service and combat integration where supported.
Any proposed adapter operation must be labeled new work; do not claim an
existing XP or general-purpose DSH tool API that the inspected code lacks.

## Deliverables

- A dated platform findings document under `docs/`, linked from this stage.
- Synthetic example events and a small runnable integration probe when code work
  starts. Real device data stays local; commit only redacted summaries or
  synthetic equivalents suitable for the public repository.
- Initial API and ownership decisions, with concrete source pointers.
- A den-lore runtime plan including the service/data path, port and startup
  approach. The proposed persistent-data root is `C:\Dev\Lore-Fitness-RPG-Data`.

Do not provision a separate LAN server. Keep Marinara, DSH, the fitness service
and ledger together on den-lore as Patch requested.

## Acceptance evidence

- [ ] One imported, one manual and one custom-watch activity have observable
  receipts, with supported fields and delivery timing recorded.
- [ ] Repeated receipt of the same activity does not create a second activity.
- [ ] The Game Mode/DSH integration points are traced in current source, and
  remaining implementation gaps are explicitly named.
- [ ] The actual device capability matrix supports the proposed first-release
  features, or the plan documents a useful fallback for an unavailable field.
- [ ] The chosen Windows service arrangement can coexist with the existing apps.

If a physical device is temporarily unavailable, mark that evidence pending and
continue source inspection, synthetic probes and contract work. Do not silently
turn simulated results into device verification.

## Handoff

Update the owner/status and findings links here and in [progress.md](progress.md).
Post the major confirmed capabilities and integration decisions to the existing
crew thread. Stage 2 consumes the event contract; stage 4 consumes the device
matrix; stage 3 consumes the current Marinara/DSH source map.
