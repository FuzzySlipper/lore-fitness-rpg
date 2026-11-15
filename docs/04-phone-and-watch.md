# Stage 4 — Android and Wear OS companions

Status: Planned. Owner: Unassigned. Updated: 2026-11-15.

[Outline](implementation.md) · [Progress](progress.md) ·
[Previous: Marinara integration](03-marinara-integration.md) ·
[Next: campaign season](05-campaign-season.md)

## Outcome and dependencies

Deliver native companions for the Motorola razr ultra (2025) and OnePlus Watch 3,
using stage 1's observed capabilities and stage 2's stable activity API. Clients
should be useful throughout the day and reconcile with the service on den-lore
when reachable.

Use Kotlin/Compose phone and Wear OS modules with persistent local queues.
Keep the application identity/signing compatible for paired-device transport
and updates. The existing Marinara Termux/WebView APK is not this companion.

## Phone work

- [ ] Onboarding for the server connection, watch pairing and relevant health
  permissions, with understandable capability/sync status.
- [ ] Today dashboard, current mission, rewards, journal and recent history.
- [ ] Fast workout, walk, mobility, meal, water and recovery entry.
- [ ] Corrections, undo, backdating, goal preferences and quiet hours.
- [ ] Health Connect import using supported records, source identity and versions.
- [ ] Cumulative-data aggregation and cross-source reconciliation.
- [ ] Foreground sync and supported/permitted scheduled background reads.
- [ ] Persistent pending entries, retries and acknowledgment handling.
- [ ] Notifications that respect preferences and reflect actual committed state.
- [ ] Folded/unfolded presentation and practical Razr cover-display actions where
  supported by the installed device software.

## Watch work

- [ ] Today tile, mission progress and a useful complication.
- [ ] Large, quick water and recovery check-in actions with undo/recovery on phone.
- [ ] Guided session start, pause, resume and finish.
- [ ] Health Services recording for supported workouts owned by our app.
- [ ] Selective passive measurements only when they serve a concrete feature.
- [ ] Cached mission/status and durable offline check-ins.
- [ ] Paired-device transfer and acknowledgments with the phone companion.
- [ ] Restrained completion haptics and readable active/ambient presentation.

## Source selection and synchronization

Support normal OHealth use and our own guided sessions. Import the former from
Health Connect; use original event identity for sessions recorded by our app.
If our session is later exported to and read back from Health Connect, recognize
that representation as the same activity.

Do not promise live access to OHealth's active session via our ExerciseClient.
Query actual Health Services capabilities and record unavailable types clearly.
OHealth-specific stress/readiness scores remain optional until their export is
observed. Missing data is not a measured zero or a reason to discard a manual log.

Record timestamps from the event rather than assigning delayed/batched data to
the time it arrived. Handle timezone changes, interrupted reads, expired sync
tokens, reboots and permissions changing. Show last successful sync, pending
entries and a useful Sync now action. Avoid repeated high-frequency sensor
polling solely to keep a progress display moving.

The phone/watch can remain offline from den-lore during an outing. The first
release needs reliable queueing and later synchronization, not a publicly
reachable desktop or a new cloud service.

## Deliverables

- Buildable phone/watch modules with documented engineering-install commands.
- A consistent application ID/signing/update strategy; actual signing material
  remains local and untracked.
- Synthetic integration fixtures shared with the service contract.
- Device observations for ordinary use, folded/unfolded phone use, watch
  interaction, delivery latency and release-build battery cost.
- A draft distribution procedure for direct APK builds and optional Play internal
  testing, completed in stage 6.

## Acceptance evidence

- [ ] Supported automatic imports reach the journal with correct identity/units.
- [ ] Manual entries and guided workouts remain usable while disconnected.
- [ ] Reconnection and process/device restart preserve and acknowledge queued work.
- [ ] OHealth, app-recorded and imported copies reconcile without duplicate XP.
- [ ] Permission changes leave a clear status and useful manual entry path.
- [ ] Full and folded phone layouts, watch controls and ambient presentation are
  exercised on the actual devices where applicable.
- [ ] Battery and latency measurements use a release build and a comparable
  baseline; agreed limits and observed results are recorded.
- [ ] Updating both apps preserves pairing and pending history.

Keep raw personal device captures and activity exports outside the public repo.
Record reusable findings, synthetic repros and evidence summaries here and in
[progress.md](progress.md); post major device milestones to the crew thread.
