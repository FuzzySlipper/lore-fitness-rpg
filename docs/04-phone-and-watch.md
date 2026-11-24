# Stage 4 — Android and Wear OS companions

Status: In progress (phone and watch apps built with ravens, undo, tile, complication and drills; verified in emulators; installed on Lore's razr and Watch 3). Owner: Claude Code session `s/a60d803335a9aa0a` (started 2026-11-23). Updated: 2026-11-24.

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
- [x] Fast workout, walk, mobility, meal, water and recovery entry.
- [ ] Corrections, undo, backdating, goal preferences and quiet hours. All but goal
  preferences done (2026-11-24); goals stay ledger settings for now.
- [ ] Health Connect import using supported records, source identity and versions.
- [ ] Cumulative-data aggregation and cross-source reconciliation.
- [x] Foreground sync and supported/permitted scheduled background reads.
- [x] Persistent pending entries, retries and acknowledgment handling.
- [x] Notifications that respect preferences and reflect actual committed state.
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
- The phone is also reached by wireless debugging now (paired, then `adb connect`
  to the IP:port on its Wireless debugging screen; it does not advertise itself
  over mDNS). Its screencap needs `-d <display id>` because the razr has two
  displays (main 4630947043778501779, cover …780).
- OHealth still exports nothing after Patch turned on its Health Connect sharing
  (2026-11-24, about 02:00): Health Connect's own "Data and access" says "No data"
  and its diagnostics show no write quota used by OHealth, while our app reads in
  the foreground and from the 15-minute background pass. Next check: after OHealth
  has synced new activity from the watch, and OHealth's own export setting.
  Android 16 also offers on-phone step counting into Health Connect ("New activity
  metrics tracked"); not enabled, since the watch's count is the better source.
- Not yet done on the devices: a watch check-in through the phone to the ledger
  and its acknowledgment (deliberately not faked into Lore's real journal), and
  shake to roll with a real resolved roll.

### Second pass (2026-11-24)

Defaults recorded:

| Item | Default |
| --- | --- |
| Ravens | Phone notifications ("A raven from Leliana") for new journal entries of kind `check-in`, `bonus-roll` and `spend`, and for a level gained, worded from the ledger's own message. The first sync after install marks the journal as seen. Several arrive as one notification. Wear OS mirrors phone notifications to the watch |
| Quiet hours | 22:00–08:00 by default, set in Settings (equal hours mean never quiet). Ravens due in quiet hours wait and arrive together afterwards; none are dropped. A withdrawal cancels a waiting raven for its check-in, and is announced itself when that raven already flew |
| Undo | After a phone check-in, an Undo action resends the same record with a higher revision and `deleted: true`; the ledger withdraws the check-in if it was the only support. Queued, so it also works offline |
| Tile | "Skyhold": an arc of today's earned categories out of six, "N of 6 ready", level, check-ins waiting for the phone, and a tap into the app; redrawn whenever the phone's state or a check-in changes it |
| Complication | "Skyhold readiness", `RANGED_VALUE` (0–6) or `SHORT_TEXT` ("4/6"), for watch faces that accept third-party complications |
| Guided drills | Cullen's drill (Strength, `bodyweight`, ten rounds of 40 s work and 20 s rest), Iron Bull's conditioning (Moved, `movement`, 15 minutes with a nudge every 3), Cassandra's discipline (Mobility, `stretch`, eight one-minute holds). Haptic cues at each step and the last three seconds, the screen kept on, pause, resume and finish early; a finished drill logs a watch check-in with the minutes done (at least one) and the drill's name. Fixed sessions: nothing gets harder because the last one went well. Health Services recording is not used yet |

Verified in emulators (phone Android 15 against the scratch ledger; Wear OS 4
emulator for the watch):

- Ravens: a check-in at 02:26 waited ("waiting" held the line, no notification);
  logging and undoing a check-in left nothing waiting; with quiet hours off, a
  check-in posted "A raven from Leliana" with the ledger's message.
- Undo: the ledger recorded "deleted at source" and withdrew the check-in (−20
  XP, category no longer earned).
- Drills: list, Cullen's opening line, the running count ("Round 1: work 0:35"),
  Finish, the closing line and Log, which queued `bodyweight`/strength with
  `durationMin`, start, end and the note "Cullen's drill".
- Tile: "Open Skyhold · Waiting for the phone" without state; with a synthetic
  state, "3 of 6 ready · Level 4 · 1 waiting" and the arc half filled.

Installed on Lore's devices over wireless debugging; the Skyhold tile was added
on the watch with the debug-surface command. Not yet seen on the devices: the
tile, a drill, a raven mirrored to the watch, the complication on a watch face.

### Corrections and backdating (2026-11-24)

- **Log for another day** (Today screen): a category, a day in the last week and
  optional minutes, sent as a day-level entry (`start` is the date, note "logged
  later"). The ledger counts it for that day if the category was not already
  earned there.
- **History** tab: the last seven days of activities from `GET /v1/activities`,
  newest first, with where each came from, its amounts and whether it counts.
  The apps' own entries (`lfr-phone`, `lfr-watch`) are corrected by resending the
  same record with the next revision: moved to another day, given other minutes,
  removed (`deleted: true`) or restored; these are queued like any check-in, so
  they work offline. The ledger's `PATCH` only edits its own `manual` source, so
  it is not used. Imported records (OHealth and other Health Connect sources) are
  removed and restored with `POST /v1/activities/:id/delete|restore`, which needs
  the connection; a removal survives re-import.
- The snackbar's Undo now times out (long duration) and minute fields use the
  number keypad.

Verified on the phone emulator against the scratch ledger: Strength logged for
Sunday with 20 minutes ("strength 20 min (lfr-phone) for 2026-11-22", check-in
+20 XP); moved to Saturday in History (the activity "updated at source",
Sunday's check-in withdrawn −20 XP, Saturday's granted +20 XP); an imported
250 ml hydration record removed (that day fell to 1750 of 2000 ml and its
hydration check-in was withdrawn) and restored (back to 2000 ml and the check-in
granted again). Installed on Lore's razr.

### Release signing (2026-11-24)

One release key signs both apps (the Data Layer needs the same signature on
phone and watch, and Android only installs an update signed with the key the app
was installed with):

| Item | Value |
| --- | --- |
| Key | PKCS12 keystore `lore-fitness-release.jks`, alias `lore-fitness`, RSA 4096, valid 30 years, `CN=Lore Fitness RPG, O=Household`; certificate SHA-256 `95:92:AD:F9:79:8F:33:05:54:28:C3:7B:58:AA:A9:75:7B:64:B9:58:34:9B:52:E3:00:F0:C1:64:FA:0B:6D:BD` |
| Where | Building copy on den-agents in `~/.config/lore-fitness-rpg/signing/` (mode 600, with `signing.properties` holding the paths and password); den-lore copies in `C:\Dev\Lore-Fitness-RPG-Data\signing\` and `Documents\Lore Fitness RPG\signing\` (with a README), the latter carried off the machine by Den Windows Backup. Never in the repository |
| Gradle | `phone` and `wear` read `signing.properties` from that default path, or `-Plfr.signingProperties=…`; without it a release build is unsigned and Gradle warns |
| Versions | `lfr.versionCode`/`lfr.versionName` in `android/gradle.properties`, shared by both apps; raise the code for every build that is installed. Now 2 / 0.2.0 |

Build and install (den-agents, devices reached by wireless debugging):

```bash
cd android && JAVA_HOME=~/.local/opt/jdk17 ANDROID_HOME=~/.local/opt/android-sdk ./gradlew :phone:assembleRelease :wear:assembleRelease
~/.local/opt/android-sdk/build-tools/35.0.0/apksigner verify --print-certs phone/build/outputs/apk/release/phone-release.apk
adb -s PHONE install -r phone/build/outputs/apk/release/phone-release.apk
adb -s WATCH install -r wear/build/outputs/apk/release/wear-release.apk
```

The switch from the debug builds needed one uninstall of each app (a different
signature), done after checking that neither the phone's queue nor the watch's
pending list held anything and the ledger had no activity. Health Connect,
notification and the phone's Health Connect read permissions were restored with
`pm grant`, as Patch had granted them; the Skyhold tile was added again. Both
devices run 0.2.0; the watch's sync request reached the phone afterwards. From now
on updates install in place and keep the queue, pending check-ins and grants.

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
  den-lore, and versioning that permits in-place sideloaded updates. Done
  2026-11-24 (see Release signing).
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
