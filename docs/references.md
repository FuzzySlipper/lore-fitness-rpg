# Platform and source references

Inspected: 2026-11-15. These findings explain the starting plan. Recheck owning
source and installed device capabilities before implementing a dependency.

## Project direction

- Crew thread: `den-01M6WSZV8VFGDJPDSXTE1QS7YF`, board `lore-rpg`, title
  “Dragon Age: Inquisition | Fitness RPG Character Card”.
- Lore's original post: `den-01M6WSZV8V9DZ9S96GE28KZ39C`, 2026-11-08.
- Patch accepted the expanded plan and selected den-lore as the deployment host
  on 2026-11-15. See [progress.md](progress.md) for the confirmed decisions.

These repository documents carry the implementation detail so an agent can
continue without access to the original chat or an external task tracker.

## Marinara snapshot and owning files

Checkout: `C:\Dev\Marinara-Custom`, version 2.5.0, branch `custom/agent-turn`,
commit `3050e9a406c4ab23279b9e0b4fb067c2db252047` at inspection.

| Area | Source path relative to that checkout | Finding |
| --- | --- | --- |
| Team-turn gate | `packages/server/src/routes/generate.routes.ts` | Ordinary Roleplay replies only at the inspected integration point |
| Team orchestration | `packages/server/src/services/team-turn/index.ts` | Lore/narrator/reviewer request, progress events and normal-generation fallback |
| Provider mapping | `packages/server/src/services/team-turn/team-request.ts` | Original tool definitions excluded from captured team request parameters |
| Lore transfer | `packages/server/src/services/team-turn/team-wiki.ts` | Relevant lorebook entries become a per-chat DSH wiki |
| Team process | `packages/server/src/services/team-turn/team-host.ts` | Existing DSH host connection and on-demand Windows start |
| Dice | `packages/server/src/services/game/dice.service.ts`; `packages/shared/src/features/function-calls/tools/roll-dice/manifest.ts` | Engine dice and supported tool signature |
| State tool | `packages/shared/src/features/function-calls/tools/update-game-state/manifest.ts` | Location/time only; not an XP, inventory or quest mutation API |
| Roleplay encounter actions | `packages/server/src/routes/encounter.routes.ts` | Separate model-produced encounter state path |
| Game combat | `packages/server/src/routes/combat-director.routes.ts`; `packages/server/src/services/game/combat.service.ts`; `docs/game/combat.md` | Engine-resolved combat and ruleset integration |
| Snapshots | `packages/server/src/services/storage/game-state.storage.ts`; `packages/shared/src/types/game-state.ts` | Chat/message/swipe persistence and ruleset state |
| Storage | `docs/development/file-storage.md` | File-native persistence; do not assume an external SQL database in Marinara |
| Extensions | `packages/server/src/services/extensions/personal-extension-sandbox.ts` | Personal server extension backend unavailable on Windows |
| Android wrapper | `android/README.md` | Termux bootstrap and WebView, not a health-data companion |

`LOCAL-PATCHES.md` named an older installed branch at inspection. Verify Git
directly rather than replacing the active custom branch based on that note.
Preserve Cartesia, provider/session and other local customizations.

## DSH snapshot

Instance: `C:\Dev\Marinara-DSH`. The instance package specifies
`@deepseek-ai/dsh` 0.2.2-alpha.2; `stage/package.json` identifies `dsh-stage` 0.1.0.

Inspect `stage/lib/index.mjs`, `stage/profile.patch.yml`, `start.ps1` and
`common.ps1`. The stage has lore search/read, a narrator and a reviewer with a
bounded revision loop. An unresolved review can return prose, so do not treat
review completion as guaranteed factual correctness.

The unversioned installed stage files are a dated observation. Establish the
maintained source and build path before modifying that runtime. Do not commit
the instance's credentials, sessions, personal wiki or logs here.

## Official Android and device references

- [OnePlus Watch 3 specifications](https://www.oneplus.com/us/oneplus-watch-3/specs):
  Wear OS and OHealth/Health Connect support; this does not establish export
  coverage for every metric on Lore's watch.
- [Health Connect setup](https://developer.android.com/health-and-fitness/health-connect/get-started):
  phone integration, feature availability and permission setup.
- [Read Health Connect data](https://developer.android.com/health-and-fitness/health-connect/read-data):
  cumulative-data aggregation and foreground/background reads.
- [Synchronize Health Connect data](https://developer.android.com/health-and-fitness/health-connect/sync-data):
  record versions, change tokens and reconciliation.
- [Health Services](https://developer.android.com/health-and-fitness/health-services)
  and [exercise capabilities](https://developer.android.com/health-and-fitness/health-services/active-data):
  watch measurements and workouts owned by the app.
- [Wearable Data Layer](https://developer.android.com/training/wearables/data/overview):
  paired-device transport and matching package/signature requirements.
- [Wear OS Wi-Fi debugging](https://developer.android.com/training/wearables/get-started/debug-wifi):
  physical-device engineering setup.
- [Play Console registration](https://support.google.com/googleplay/android-developer/answer/6112435?hl=en),
  [internal testing](https://support.google.com/googleplay/android-developer/answer/9845334?hl=en)
  and [new personal-account production testing](https://support.google.com/googleplay/android-developer/answer/14151465?hl=en):
  check current requirements when preparing distribution.

As checked on 2026-11-15, Play Console charges a US$25 one-time registration fee,
internal testing supports up to 100 testers, and new personal accounts have a
separate 12-tester/14-day closed-test requirement before applying for public
production access. No account enrollment, purchase or upload has occurred here.
