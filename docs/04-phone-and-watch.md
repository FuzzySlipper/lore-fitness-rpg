# Stage 4 — Android and Wear OS companions

Status: In progress (first version built; phone app verified in an emulator). Owner: Claude Code session `s/a60d803335a9aa0a` (started 2026-11-23). Updated: 2026-11-23.

[Outline](implementation.md) · [Progress](progress.md) ·
[Previous: Marinara integration](03-marinara-integration.md) ·
[Next: ruleset and campaign](05-campaign-season.md)

## Outcome and dependencies

Deliver native companions for the Motorola razr ultra (2025) and OnePlus Watch 3
that sync with the service on den-lore when reachable. Start now against Health
Connect's documented API, emulators and stage 2's API; Patch can make Lore's
actual devices available for agent testing throughout development.

Lore loves gadgets, so the watch is an engagement feature in its own right, not
just another data source. Playful watch interactions are in scope even where
OHealth already records the underlying activity.

Use Kotlin/Compose phone and Wear OS modules with persistent local queues.
Keep the application identity/signing compatible for paired-device transport
and updates. The existing Marinara Termux/WebView APK is not this companion.

## Phone work

- [ ] Onboarding for the server connection, watch pairing and relevant health
  permissions, with understandable capability/sync status.
- [ ] Today dashboard, current mission, daily check-ins, rewards, journal and
  recent history.
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

- [ ] **Shake to roll.** When a check-in earns a bonus roll, the die appears on
  the watch; a wrist flick animates the roll with haptics. The result comes from
  the ledger/Marinara dice record, so the watch presents a real, stored roll and
  never generates its own. Offline, the roll waits until the result is available.
- [ ] **Leliana's ravens.** Short in-character notifications when a war-table
  operation completes, a companion scene unlocks or a reward lands, respecting
  quiet hours.
- [ ] **Skyhold readiness complication** and a Today tile with the current
  mission and which companion is waiting.
- [ ] **Companion-framed guided drills.** Start, pause, resume and finish
  sessions framed as Cullen's drills, Iron Bull's conditioning or Cassandra's
  discipline, with haptic cues, recorded through Health Services for supported
  exercise types.
- [ ] Large, quick water and recovery check-in actions with undo/recovery on phone.
- [ ] Selective passive measurements only when they serve a concrete feature.
- [ ] Cached mission/status and durable offline check-ins.
- [ ] Paired-device transfer and acknowledgments with the phone companion.
- [ ] Restrained completion haptics and readable active/ambient presentation.

## First version (2026-11-23)

Code: [`android/`](../android/) (Gradle 8.11.1 wrapper, AGP 8.7.3, Kotlin 2.0.21,
Compose). Modules: `core` (ledger client, activity record, Data Layer paths),
`phone` and `wear`. Build on den-agents with JDK 17 and the Android SDK under
`~/.local/opt`:

```bash
cd android && JAVA_HOME=~/.local/opt/jdk17 ANDROID_HOME=~/.local/opt/android-sdk ./gradlew :phone:assembleDebug :wear:assembleDebug
```

Defaults recorded:

| Item | Default |
| --- | --- |
| Identity | Both apps are `io.github.fuzzyslipper.lorefitness`, one `versionCode` in `gradle.properties`, signed with the same key, because the Wear Data Layer only connects apps with the same package and signature. Engineering builds use den-agents' debug key; the release key comes with stage 6 packaging and stays outside the repository |
| Minimum versions | Phone Android 9 (API 28), watch Wear OS 3 (API 30); target 35 and 34 |
| Server | `http://192.168.1.25:7900` (den-lore), changeable in Settings; plain HTTP is allowed because the ledger is a household LAN service |
| Queue | Every check-in and import goes into a SharedPreferences queue first, keyed by `(source, sourceRecordId)` with the newest revision winning, and leaves it only when the ledger answers with anything but `rejected` (rejected records are kept for display, not retried). WorkManager runs a pass every 15 minutes with a network; Sync now, a check-in and a watch request run one at once |
| Health Connect | Reads steps, exercise sessions and hydration for the last three days on each pass. Steps become one daily total per source app and local day (`steps-YYYY-MM-DD`, source `hc:<package>`), so the ledger's best-single-source rule sees each app apart; sessions and hydration keep their Health Connect id; the last-modified time is the revision. Background reading asks for `READ_HEALTH_DATA_IN_BACKGROUND`; without it, imports happen when the app is open |
| Manual check-ins | Source `lfr-phone` or `lfr-watch`, a random id, the category's own kind (`movement`, `strength`, `mobility`, `meal-habit`, `hydration` with `goalMet`, `recovery`) |
| Watch path | The watch never calls the ledger. A check-in is stored on the watch and sent to the phone (`/lfr/check-in`); the phone queues it and answers `/lfr/check-in-ack` only after the ledger accepted it, and the watch resends until then. The phone publishes `/lfr/state` (today's character and categories, last ten resolved rolls) after each pass |
| Shake to roll | The watch shows a resolved roll it has not shown before (rolls present at the first sync after install count as seen). A wrist flick (linear acceleration above 14 m/s²) or the Roll button plays the animation and lands on the stored result; the faces before it are animation only |

Verified in an Android 15 emulator against a scratch ledger seeded with the
steady persona (never the real ledger): the Today screen showed the persona's
level 6, 1680/2100 XP and resources; Log on Mobility produced "Mobility
check-in … +20 XP" in the ledger from client `razr-…`; with the ledger
stopped, a Strength check-in stayed queued ("1 waiting to reach the journal",
with the error), survived a force-stop, and reached the ledger when the app
opened again with it back.

Not yet verified: the watch app on any device, the Data Layer path, Health
Connect import with real OHealth records, the background pass, and both apps on
Lore's devices. Not yet built: tiles and the readiness complication, ravens,
guided drills, corrections/undo and quiet hours.

### Devices (2026-11-23)

Both are connected to den-lore by USB. The razr ultra is `ZD222V8F3K`,
`motorola_razr_ultra_2025`, Android 16, authorized for den-lore's adb on
2026-11-23 (USB set to tethering, which does not matter for adb). The phone
debug build is installed: it opened, synced with den-lore's real ledger (empty:
level 1, 0 XP) and screencap reports two displays (main and cover). Health
Connect access was granted by Patch (steps, exercise, hydration and background
reading, all `granted=true`), but the first import read 0 records: OHealth
(`com.heytap.health.international` 5.1.10) declares Health Connect write
permissions for steps, exercise, distance, calories, heart rate, sleep and
others, and none of them was granted, so it was not exporting anything. It
declares no hydration write permission at all, so hydration from OHealth is not
expected; water stays a manual or watch check-in (the stage 1 default for a
missing record type). Patch then granted all of OHealth's write permissions in Health
Connect. Our app still read 0 records, also after OHealth was opened for a
minute, and Health Connect's `dumpsys` lists rate-limit usage for our app's
foreground and background reads (the 15-minute WorkManager pass works) but none
for OHealth: it has written nothing. Granting the permissions does not start
OHealth's export by itself; its own sync setting is next. The watch now shows up
to adb as `L631105000030F6E015L` (debugging on, authorization pending on the
watch).
The Watch 3 shows as "OPWE242" in file-transfer mode only: its USB debugging is
not on yet. den-lore's `adb` is `C:\dev\bt-haptic\tools\platform-tools\adb.exe`;
from an SSH session it needs `TMP`/`TEMP` pointed at a writable folder
(`C:\Dev\Lore-Fitness-RPG-Data\tmp`), and its server exits with the session.

### On the devices (2026-11-24)

The phone and watch moved to den-agents' desk; den-agents is a VM with no USB
passthrough, so both are reached by Wi-Fi wireless debugging from den-agents
(`adb pair IP:PORT CODE` with the code the device shows, then the device
advertises itself over mDNS). The watch paired: OPWE242, Wear OS 5 (Android 14,
API 34), Google Play services 26.45, Data Layer connected to the phone over
Bluetooth. The phone's pairing code had expired before it was used; it needs a
fresh one.

- The watch app installed and runs. While the watch sits on its charger,
  OnePlus's full-screen charging display covers every app and takes taps, so
  screenshots and taps cannot reach the app then.
- Found and fixed: the phone had been publishing `/lfr/state` since it was
  installed (the watch's Data Layer counted 23 updates for the app), but the
  watch app saved none of it. A listener only hears changes; state published
  before the watch app existed, or while it was not running, is only in the Data
  Layer store. The watch app now reads `/lfr/state` from the store when it opens,
  and it then held den-lore's real state (level 1, nothing earned).
- The watch's sync request reached the phone (`/lfr/sync` in the watch's Data
  Layer log).
- Not yet done on the devices: a watch check-in through the phone to the ledger
  and its acknowledgment (deliberately not faked into Lore's real journal), and
  shake to roll with a real resolved roll.

## Source selection and synchronization

OHealth stays the main source for ordinary workouts; import them from Health
Connect. Use original event identity for sessions recorded by our app. If our
session is later exported to and read back from Health Connect, recognize that
representation as the same activity. All sources for one category and day
collapse into one check-in in the ledger.

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
- One local signing key for both modules, kept outside the repository on
  den-lore, and versioning that permits in-place sideloaded updates.
- Synthetic integration fixtures shared with the service contract.
- Device observations for ordinary use, folded/unfolded phone use, watch
  interaction, delivery latency and release-build battery cost.

## Acceptance evidence

- [ ] Supported automatic imports reach the journal with correct identity/units.
- [ ] Manual entries and guided drills remain usable while disconnected.
- [ ] Reconnection and process/device restart preserve and acknowledge queued work.
- [ ] OHealth, app-recorded and imported copies reconcile without duplicate XP.
- [ ] Shake-to-roll shows the stored roll and never a locally generated one.
- [ ] Ravens, complication, tile and guided drills work on Lore's Watch 3.
- [ ] Permission changes leave a clear status and useful manual entry path.
- [ ] Full and folded phone layouts, watch controls and ambient presentation are
  exercised on the actual devices.
- [ ] Battery and latency measurements use a release build and a comparable
  baseline; agreed limits and observed results are recorded.
- [ ] Updating both apps preserves pairing and pending history.

Keep raw personal device captures and activity exports outside the public repo.
Record reusable findings, synthetic repros and evidence summaries here and in
[progress.md](progress.md); post major device milestones to the crew thread.
