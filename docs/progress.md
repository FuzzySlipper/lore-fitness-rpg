# Progress and decisions

Updated: 2026-11-22.

## Current state

The repository contains the implementation outline, six stage plans and agent
coordination instructions. No application feature or runtime deployment is
complete. Stages 1–5 and the stage 6 playtest harness can start now in parallel
from the recorded defaults; see [Stages and dependencies](implementation.md#stages-and-dependencies).

| Stage | Status | Owner | Next action |
| --- | --- | --- | --- |
| [1 — Platform contract](01-platform-contract.md) | In progress | Claude Code `s/a60d803335a9aa0a` | Swipe, inventory and dice checks done; device capture waits on Lore's razr and Watch 3 being connected |
| [2 — Durable mechanics](02-durable-mechanics.md) | Service implemented | Claude Code `s/a60d803335a9aa0a` | Stage 3 consumes the projection, bonus-roll and spend API; stage 6 installs it on den-lore |
| [3 — Marinara integration](03-marinara-integration.md) | In progress | Claude Code `s/a60d803335a9aa0a` | Game Mode path complete on scratch; DSH agent team works on game turns (scripted provider and a real-model run on den-m5); Training panel tabs with the full war table, workshop, Companions and Campaign views (scripted checks and a browser look); fights resolved by the ruleset with level, training, supplies, kit, talents and companions counting (scripted check, browser fight and real-model fights on den-m5) |
| [4 — Phone and watch](04-phone-and-watch.md) | Planned | Unassigned | Build phone/watch modules against Health Connect and the stage 2 API, including the watch gadget features |
| [5 — Ruleset and campaign](05-campaign-season.md) | In progress | Claude Code `s/a60d803335a9aa0a` | Ruleset v1 and a 93-entry first-draft pack built, installed and play-tested on scratch; next, internal playthroughs to tune, the content matrix and the character card |
| [6 — Stabilization and release](06-stabilization-and-release.md) | Harness in progress | Harness: Claude Code `s/a60d803335a9aa0a` | Sessions now include a seeded scratch ledger; next, scripted persona play through the Marinara UI once stage 3 projects ledger state into games |

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
| 2026-11-16 | Internal tone and voice playtests use Gemma 4 26B A4B on the LAN Lemonade servers (den-nimo, den-m5) that Patch set up; reasoning off; mechanical checks stay on the mock game master | Patch provided the servers; reasoning-off and server split are agent defaults |
| 2026-11-18 | Stage 2 rules version 1 and service defaults (resources, soft caps, bonus roll, steps and hydration counting, correction behavior, zero-dependency Node 24 runtime) | Agent defaults, recorded in [stage 2](02-durable-mechanics.md#rules-version-1-and-recorded-defaults-2026-11-18) |
| 2026-11-18 | Stage 3 fitness module defaults: per-game switch, sheet field ids `level`/`xp`/`supplies`/`training`/`rerolls`, turn facts locked to the player's message, sighted dice pool on for fitness games, ledger's roll result as the only receipt | Agent defaults, recorded in [stage 3](03-marinara-integration.md#recorded-defaults-2026-11-18) |
| 2026-11-18 | Campaign content is compact structured entries the Game Master expands, not long prose; this session designs and reviews, cheaper models draft bulk entries from exemplars | Patch's token-budget suggestion; format is an agent default ([stage 5](05-campaign-season.md)) |
| 2026-11-18 | Ruleset v1: d20 + DA:I attributes; level, unspent training and unspent supplies give concrete fight bonuses, making war-table spends a readiness trade-off | Agent default ([stage 5](05-campaign-season.md#ruleset-version-1-2026-11-18)) |
| 2026-11-19 | Lore delivery is hybrid: trigger lorebooks stay the floor for single-call Game Mode; DSH agent loops get an explorable wiki built from the same `content/pack` source, with an index, links and (later) visibility markers; broader Dragon Age material goes into the wiki only. Committed facts, story state and secrets stay deterministic, never left to a lookup | Patch's direction after discussing trigger vs wiki lore; build details are agent defaults ([stage 3](03-marinara-integration.md#dsh-team-in-game-mode-2026-11-19), [stage 5](05-campaign-season.md#lore-delivery-triggers-and-wiki-2026-11-19)) |
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

### 2026-11-16 — Real game-master model for internal playtests

Claude Code session `s/a60d803335a9aa0a`. Patch set up Lemonade with
`Gemma-4-26B-A4B-it-MTP-GGUF` on den-m5 and den-nimo. Device capture is deferred
until Lore's devices are available again.

- Both servers answered directly (full 262144 context, `--parallel 1`).
- Through a scratch Marinara, Game Mode's default maximum reasoning truncated
  one reply and leaked planning text into another (24–66 s per turn). With the
  connection's reasoning set to none, Marinara sends `enable_thinking=false`;
  turns then took 5–11 s with clean, in-voice prose.
- `serve-scratch-marinara.sh --model-url` creates that connection; playtest
  profile `lore-fitness-marinara-live` (manifest `harness/den-serve-live.json`)
  hosts it. A hosted session ran `harness/checks/real-turn.mjs` and was stopped.
  The mock game master now logs request parameters, which is how the reasoning
  setting was confirmed.

Validation: observed real turns on scratch Marinara and in a hosted playtest
session; no browser-driven play or persona session yet. Next action: scripted
persona sessions and the scratch ledger.

### 2026-11-18 — Stage 2 fitness service and seeded harness ledgers

Claude Code session `s/a60d803335a9aa0a`, after Patch said to go ahead with the
next work. Claimed stage 2 in `1dd5bac`.

- [`service/`](../service/README.md): zero-dependency TypeScript service on
  Node ≥ 24 (`node:sqlite`, type stripping). SQLite ledger with ingestion,
  duplicate/revision handling, daily check-ins, grants and reversals,
  corrections, resources, rerolls, bonus-roll receipts, projection receipts,
  journal, status, backups and schema migrations; HTTP API v1 and a CLI.
- Synthetic history generator from `harness/personas.json`, with delivery noise
  (resent duplicates, revised step totals, late backdated entries).
- Rules version 1 and defaults recorded in
  [stage 2](02-durable-mechanics.md#rules-version-1-and-recorded-defaults-2026-11-18).
- Harness: `serve-scratch-marinara.sh --persona ID` seeds a scratch ledger and
  serves it on port+2; both playtest profiles now start with the `steady`
  persona. A hosted session showed 269 activities and 84 check-ins at the
  ledger and closed all three ports on stop.

Validation: 23 tests and the typecheck pass on den-agents, and the 23 tests pass on den-lore with Node 25.9 (Windows); all five personas seeded to their
exact schedules; HTTP read-back observed. Not done: den-lore install, Health
Connect payload mapping (stage 4), the Marinara module (stage 3), so no
end-to-end swipe check against the ledger yet. Next action: stage 3's fitness
module against this API.

### 2026-11-18 — Stage 3 Game Mode fitness module

Claude Code session `s/a60d803335a9aa0a`; Patch said to start stage 3. Claimed
in `390d12b`.

- Marinara branch `fitness/module` at `2ee03fc13` (on den-agents, and fetched
  as a branch into `C:\Dev\Marinara-Custom` without touching its working tree):
  ledger client, projection onto the persona's card, bonus rolls with
  Marinara's dice, turn facts locked to the player's message, `/api/fitness`
  routes and a Training panel in Game Mode.
- Harness: scratch Marinara gets `FITNESS_LEDGER_URL` for its seeded ledger;
  new check [`harness/checks/fitness-turn.mjs`](../harness/checks/fitness-turn.mjs).
- Stage 5: the ruleset must declare the five sheet field ids.

Validation: fitness-turn 16/16 on scratch and 15/15 in a hosted playtest
session; swipe check still 15/15; `pnpm check` passed before the last small
change (then server typecheck, Prettier and build passed); the panel was used
in a real browser, including a war-table spend. Not tested: a real model,
ledger down, mobile layout, den-lore. Next action: the second-chance reroll,
lock marker and restore reconciliation, then DSH.

### 2026-11-18 — Stage 3: second chance, lock badge, restore handling, real model

Claude Code session `s/a60d803335a9aa0a`, continuing stage 3 at Patch's go-ahead.

- Marinara `fitness/module`: the Fade-touched second chance (spend one reroll,
  rethrow the latest turn's sighted dice pool, regenerate), a lock badge on
  locked replies, detection of a ledger restored from an older backup with an
  explicit "continue from the journal as it is now", and the Marinara update
  procedure in the stage 3 doc.
- Harness: `fitness-turn.mjs` now 23 checks including dice locking and the
  second chance; new `fitness-recovery.mjs` (ledger down, ledger restored);
  `real-turn.mjs --fitness`.

Marinara commit `3d4a4bdf5` (also fetched as a branch into den-lore's `Marinara-Custom`).

Validation: `pnpm check` passed; fitness-turn 23/23 and fitness-recovery 12/12 on scratch; real
Gemma 4 turns on den-nimo narrated the locked facts lightly and in character.
Not tested: mobile layout, these new flows through the browser, den-lore.
Next action: DSH as an optional per-game toggle.

### 2026-11-18 — Stage 5 ruleset and season-one pack

Claude Code session `s/a60d803335a9aa0a`, at Patch's go-ahead. Claimed in
`6846b54`.

- Ruleset `content/ruleset/inquisition.json` (v1), validated by Marinara's
  parser and imported as `local/inquisition`; `fitness-turn.mjs --ruleset`
  24/24 with the Game Master's sheet block showing the ledger's values.
- Content format, linter/builder and installer under `content/`; season spine
  and one exemplar per type by this session; 85 further entries drafted by five
  subagents (four Sonnet, one Haiku) from the inventory, then reviewed and
  corrected here.
- First real-model play test of the installed campaign (see stage 5).

Validation: `content/build.mjs --check` 93 entries, 0 errors; ruleset
validator OK; installer run twice (idempotent); four played turns read as
intended. Not done: internal full playthrough, the content matrix, an
importable character card, crafting recipes, tuning. Next action: stage 6
scripted persona playthroughs using this pack.

### 2026-11-19 — Hybrid lore direction and the DSH team on game turns

Claude Code session `s/a60d803335a9aa0a`, at Patch's direction to record the
trigger/wiki direction and move on to the stage 3 DSH work while the Strix Halo
servers are busy.

- Decision recorded: triggers stay the floor for plain Game Mode; DSH agent
  loops get an explorable wiki from the same pack (stages 3 and 5).
- Marinara `fitness/module` `8b4bd6a5c`: the team turn runs for game chats;
  Game Mode's format reminder and locked facts go to the team as per-turn notes;
  team wiki links from "See also" lines; Training panel Agent team button and
  last-turn status. Fetched as a branch into den-lore's `Marinara-Custom`.
- dsh-stage (unversioned source on den-agents): `mode: "game"`, `turnNotes`,
  `committed` review notes; the change is kept in
  `integrations/dsh-stage/game-turn.patch`. Not deployed to den-lore.
- Content build: entry titles `Name (type)`, one-line summaries as entry
  descriptions, `See also` lines (up to 12 links per entry).
- Harness: `serve-dsh-stage.sh` (den-lore's DSH release, locally) and
  `checks/team-turn.mjs`.

Validation, scripted provider only: team-turn 12/12 with the engine up, 5/5
with it stopped (fallback); dsh-stage connection test passes on alpha.2;
fitness-turn 24/24 and swipe-persistence 15/15 unchanged; `pnpm check` passed;
`content/build.mjs` 0 errors. Not done: a real-model team turn, an
unresolved-review case, a browser look at the panel, deployment. Next action:
a real-model team turn on a Lemonade server once it's free, then visibility
markers for secrets.

### 2026-11-22 — Real-model DSH team turn

Claude Code session `s/a60d803335a9aa0a`. Patch freed den-m5, and I switched it
from Inkling 2 Mini to `Gemma-4-26B-A4B-it-MTP-GGUF`. Gemma is still loaded.

Ran one real-model session: a scratch Marinara on den-m5 with the local alpha.2
DSH instance and a fresh season-one game. It played the opening, two player
turns and a regenerate.

- All three player turns were written by the team and passed review: 40 s,
  27 s and 24 s. Game Mode markup was intact.
- Locked fitness facts reached the narrator. From turn 2 on, the prompt cache
  covered most of the lore agent's and reviewer's input and about 45% of the
  narrator's.
- On the regenerate, the lore agent made no suggestions and the turn used the
  keyword fallback.
- The reviewer flagged nothing. It also missed a thought written in quotes.

Details are in [stage 3](03-marinara-integration.md#dsh-team-in-game-mode-2026-11-19).
These results come from scratch runs, not a browser or device test. No code
changed.

Not done: an unresolved-review case, a browser look at the panel, deployment.
Next action: a browser look at the Agent team panel and the remaining stage 3
views (crafting, the full war table, Companions, Campaign).

### 2026-11-22 — Campaign views in the Training panel

Claude Code session `s/a60d803335a9aa0a`, at Patch's choice to do the
remaining stage 3 views before the panel's browser look.

- Content: 11 workshop recipes (`content/pack/crafting/`, new `recipe` type).
  The build writes `dist/campaign.json`, and the installer stores it on the
  game; `--refresh-campaign` updates an existing game.
- Marinara `fitness/module` `0a5e04786` (fetched as a branch into den-lore's
  `Marinara-Custom`, not deployed):
  - The panel has tabs: Today, War table, Companions, Campaign and Journal.
  - All 14 pack projects are listed, and each opens with its act.
  - Workshop recipes go through Game Mode's inventory.
  - Project reports and what the workshop made reach the next turn's locked
    facts once. The act and the missions done reach every turn.
  - The placeholder projects are removed.
- Defaults are recorded in
  [stage 3](03-marinara-integration.md#campaign-views-2026-11-22).

Validation (scratch Marinara and mock game master only):

- `campaign-views.mjs` 16/16, `fitness-turn.mjs` 24/24 and
  `swipe-persistence.mjs` 15/15.
- `pnpm check` passed, and `content/build.mjs` reported 104 entries and 0 errors.

Not done:

- A browser look at the panel tabs. (The empty GM list seen earlier was a page
  loaded before the game was created and never reloaded; see the next entry.)
- Preparation resources tied to ruleset combat.
- War-table outcomes beyond the report.

Next action: confirm in a browser that an installed game opens and that the
tabs render, then connect preparation resources to combat.

### 2026-11-22 — Games list after an install (Claude Code `s/a60d803335a9aa0a`)

Scope: find why a hosted playtest page's GM tab showed "No games yet" for a game
the server listed.

Found on a scratch Marinara with headless Chromium (Playwright): a page opened
after `install.mjs` lists the game; a page already open keeps its old list,
because Marinara disables refetch on window focus except for the Home feed; and
the earlier session's F5 key presses through Playwright never reloaded the page.
A real reload lists the game. Details and the default are in
[stage 3](03-marinara-integration.md#campaign-views-2026-11-22).

Changed: `content/install.mjs` ends with a reminder to reload open Marinara
tabs; stage 6 reloads Lore's open tabs after installing. No Marinara change.

Validation: the reproduction above (an installer game shown in a fresh page;
absent in a page opened before a second install, also after a Playwright F5;
present after `page.reload()`). No application tests changed.

Next action: the browser look at the panel tabs, then preparation resources in
combat.

### 2026-11-23 — Browser look at the Training panel (Claude Code `s/a60d803335a9aa0a`)

Scope: look at the panel tabs in a browser and use their controls.

Done on a scratch Marinara with an installed game, the mock game master and
headless Chromium at desktop (1280×800) and phone (390×844, touch) size:
captured every tab, ordered a project, made two recipes, tried one without its
materials, ticked a mission and changed act. Everything worked. Fixes from what
it showed are in Marinara `ad286aa9e`: steady panel height, sticky tab bar that
fits a phone, "1 supply" plurals, material counts with short recipes greyed
out, a label on the icon-only Training button, and a Today row that wrapped
into its button. Details are in
[stage 3](03-marinara-integration.md#browser-look-2026-11-23). The branch is
fetched into den-lore's `C:\Dev\Marinara-Custom` as `fitness/module` only;
nothing is deployed.

Validation: the browser runs above (before and after the fixes) and `pnpm
check`. Server code did not change; the server checks were not rerun.

Not done: Lore's devices, the Agent team section in a browser, an
unresolved-review case, preparation resources in combat, deployment.

Next action: connect preparation resources and training to ruleset combat.

### 2026-11-23 — Preparation in fights (Claude Code `s/a60d803335a9aa0a`)

Scope: make level, training, supplies and equipment count in actual fights.

Found: installed games fought Marinara's classic battle (the installer never
set `combatDirector`), the Inquisitor started with no attributes, kit or
talents, talents had no fight mechanics, the healing potion could not be
drunk, and Seasoned would have counted twice on attacks.

Changed:

- Lore repo: `content/install.mjs` turns on ruleset fights and gives each class
  its attributes, trained skills, a worn kit and two potions; ruleset version 2
  (talent mechanics, `talent_attack`/`talent_dc`, Hidden, drinkable potion,
  Seasoned once); `campaign.json` `progression`; `harness/checks/combat-preparation.mjs`
  and `harness/mock-gm/combat-script.json`; the pending and potion counts in
  `campaign-views.mjs` allow for talents and the starting kit.
- Marinara `a4d81c963`: the sync grants class talents by level, once, with a
  locked-facts line; the battle stage shows the sheet's level. Fetched into
  den-lore's `C:\Dev\Marinara-Custom` as a branch only; nothing deployed.

Defaults are in [stage 3](03-marinara-integration.md#fights-2026-11-23).

Validation (scratch Marinara, mock game master): combat-preparation 20/20,
campaign-views 16/16, fitness-turn `--ruleset local/inquisition@2` 24/24,
swipe-persistence 15/15, fitness-recovery 12/12, `pnpm check`, rogue and mage
fight menus through the API, and a browser fight with the warrior.

Not done: a real-model fight, a level-up during play, the sheet in a browser, a
board fight, Lore's devices, war-table outcomes beyond the report, deployment.

Next action: a real-model fight on den-m5 with the installed game, checking the
Game Master names bestiary opponents and narrates the committed outcome.

### 2026-11-23 — Real-model fights (Claude Code `s/a60d803335a9aa0a`)

Scope: play into and through a fight with the real Game Master model.

Ran nine browser playthroughs on scratch Marinara with Gemma 4 26B A4B MTP on
den-m5. Found and fixed: companions without sheets (a refused fight left the
game stuck in combat), card names that did not match what the model calls the
companions, a malformed combat tag becoming an opponent, the Engine's level on
the battle stage, and generic loot. The last run: the model's tag named
bestiary opponents and two companions, both fought on their own sheets, the
party won, the aftermath followed the fight result, and the companions were
healed back at the keep. Details in
[stage 3](03-marinara-integration.md#real-model-fights-2026-11-23).

Changed: companion `class`/`abilities`/`kit`/`card` headers and their export;
the installer writes companion sheets and kits; ruleset guidance and loot
tables; combat-preparation check sections for companions and loot. Marinara
`abc6d41b2`: sheetless allies stay out, card-name matching, combat tag parsing,
refusal reason on screen, sheet level for generated parties, companion level
and talents in the sync. Fetched into den-lore's Marinara-Custom as a branch
only.

Validation: combat-preparation 26/26, campaign-views 16/16, fitness-turn
`--ruleset` 24/24, swipe 15/15, fitness-recovery 12/12, Marinara regressions
(combat conditions, tag attributes with the new case, parser bounds, ruleset
combat core and contests) and `pnpm check`. The final loot tables and rest
guidance are covered by the scripted check, not by another real-model run.

Not done: a level-up during play, the sheet in a browser, Lore's devices,
war-table outcomes beyond the report, deployment.

Next action: war-table outcomes beyond the report, or the stage 6 deployment
groundwork.
