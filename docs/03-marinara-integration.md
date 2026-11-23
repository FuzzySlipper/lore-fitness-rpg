# Stage 3 — Marinara campaign and DSH integration

Status: In progress; the Game Mode fitness module works end to end on scratch
Marinara (2026-11-18). Owner: Claude Code session `s/a60d803335a9aa0a`.
Updated: 2026-11-23.

Code: Marinara branch `fitness/module` at `a4d81c963` (talents and fights;
panel fixes `ad286aa9e`; campaign views `0a5e04786`; agent team `8b4bd6a5c`;
second pass `3d4a4bdf5`; first pass `2ee03fc13`), based on
`custom/agent-turn` `3050e9a40`. It exists in the den-agents copy
(`~/dev/lore-fitness-rpg-work/marinara-custom`) and was fetched into
`C:\Dev\Marinara-Custom` on den-lore as a branch only; that checkout's working
tree was not changed, and nothing is deployed to Lore's `Marinara-Engine`.
Next useful actions: a fight with a real model, war-table outcomes beyond the
report, and deployment in stage 6.

[Outline](implementation.md) · [Progress](progress.md) ·
[Previous: durable mechanics](02-durable-mechanics.md) ·
[Next: phone and watch](04-phone-and-watch.md)

## Outcome and dependencies

Connect the ledger from stage 2 to Marinara's Game Mode, the Inquisition ruleset
from stage 5, real dice, combat and desktop UI. Build the Game Mode path first;
add the optional DSH team once that path works end to end.

Recheck the [source map](references.md) and stage 1 findings. Read the custom
Marinara repository's instructions before changing its code. Track changes in
both repositories with concrete commit references in the handoff.

## Ownership

- This repository owns fitness mechanics, API contracts, the ruleset package,
  campaign content and adapter-facing support code that can live outside Marinara.
- Marinara owns host UI, game-state hooks, ruleset/character projection, dice
  persistence, combat handling and its generation integration.
- The existing DSH stage owns its narrative-team runtime. Establish its actual
  source/build workflow instead of editing an installed bundle without a source.

Put Marinara changes in a fitness module in the existing custom checkout where
practical. Patch accepts deeper Game Mode changes when the functionality needs
them, and upstreaming is not required. Do not copy Marinara into this repository
or replace its provider, speech or session customizations. Windows personal
server extensions are not the backend integration path.

## Work checklist

- [ ] Fitness module: grant retrieval, projection receipts, bonus-roll receipts
  and committed encounter outcomes against the stage 2 API. Done except
  committed encounter outcomes, which wait for the stage 5 ruleset's combat.
- [x] Write level and build changes into the game build
  (`chat.metadata.gameCharacterCards[].rulesetSheet`), never as turn-level live
  sheet changes. Record application status and avoid duplicate changes.
- [ ] Locked results: commit dice, grants and outcomes before narration on every
  mechanical turn; swipe, regenerate and continue rewrite only the prose. Extend
  the existing pre-thrown dice queue guarantee and show a lock marker on locked
  turns. Done for fitness results (locked turn facts) and dice (the module turns
  on Marinara's sighted dice pool), with a lock badge on locked replies;
  war-table outcomes beyond the spend itself wait for stage 5 content.
- [x] Reroll resource: a visible action that spends one recovery-earned reroll
  to re-resolve a locked result, recorded in the ledger.
- [ ] Committed UI actions for spending preparation resources, war-table
  operations and crafting, recorded in the ledger rather than narrated turns.
  Done: war-table projects and workshop recipes from the campaign pack (see
  [Campaign views](#campaign-views-2026-11-22)).
- [x] Persist bonus rolls by the stable request identity from stage 2; reconnect
  and acknowledgment loss must return the already-resolved roll.
- [x] Implement Today, Journal, Character, Companions, War Table and Campaign
  views appropriate to the existing Marinara interface, with reward receipts.
  All six are tabs of the Game Mode Training panel (Character is on Today).
  Verified with scripted checks and a browser look at desktop and phone width
  (see [Browser look](#browser-look-2026-11-23)); not yet on Lore's devices.
  Reward receipts are covered by the scripted checks, not the browser look.
- [x] Connect preparation resources and training progression to actual ruleset
  combat benefits, choices and equipment rather than only narrative claims.
  Verified with a scripted check and a browser fight on scratch (see
  [Fights](#fights-2026-11-23)); not yet with a real model.
- [x] Handle regeneration, swipes, restart, continuation and backup restore
  explicitly; retain the existing behavior for unaffected chats.
- [x] Expose useful status when the fitness service, DSH or optional narration is
  unavailable while preserving completed journal/mechanical work. Fitness
  service and DSH verified on scratch; the panel reports a failed or unresolved
  team turn.
- [x] Record a Marinara update procedure: how to merge an upstream release into
  the custom branch with the fitness module and other local patches (see
  [Marinara update procedure](#marinara-update-procedure)).
- [ ] DSH (after the Game Mode path works): a per-game toggle that sends DSH the
  committed facts for a turn and keeps Game Mode's structured output. The
  reviewer checks prose against committed results and companion knowledge limits.
  Plumbing done and verified with a scripted provider (see
  [DSH team in Game Mode](#dsh-team-in-game-mode-2026-11-19)); a real-model run
  passed on 2026-11-22. An unresolved-review case and a browser look at the
  panel remain.

## Recorded defaults (2026-11-18)

| Item | Default |
| --- | --- |
| Where the code lives | `packages/server/src/services/fitness/`, `routes/fitness.routes.ts` (`/api/fitness`), a 16-line hook in `generate.routes.ts` before the GM format reminder, `components/game/GameFitnessPanel.tsx`, `hooks/use-fitness.ts`, a Training button in `GameNarration.tsx` |
| Ledger address | `FITNESS_LEDGER_URL`, default `http://127.0.0.1:7900`; 4 s timeout per call |
| Per-game switch | Chat metadata `fitness.enabled`, turned on from the Training panel. Off by default, so other chats are unaffected |
| Sheet fields | The module writes `level`, `xp`, `supplies`, `training` and `rerolls` into `build.fields` of the card whose name matches the game's persona. Absolute values, rewritten on every sync, so swipes cannot rewind them and a stale Edit Sheet save is corrected next sync. The stage 5 ruleset declares these ids |
| No player card | Level and resources still reach the Game Master in the turn facts; the panel says no card matched |
| Locked turn facts | Committed under the answered player message id in chat metadata `fitness.turns` (last 60 kept) on the first generation for that message; regenerate, swipe and continue reuse the record. They cover check-ins, withdrawals, bonus rolls, spends and level-ups since the previous turn, plus current level and resources, and tell the Game Master to state them as fact without guilt or obligation |
| First turn after enabling | Facts and the panel's "new" list start from the moment the module is turned on; earlier rewards are acknowledged as seen |
| Dice | Enabling the module turns on Marinara's one-request dice with the sighted pool, so retellings face the same dice. Bonus rolls are thrown with `rollDieSecurely` and recorded by the ledger; only the ledger's stored result is ever shown, so no separate Marinara receipt is kept |
| Ledger down | The turn goes ahead without fitness facts and nothing is locked for it; the panel says the journal is unreachable |
| Second chance | Panel button, enabled with at least one reroll. Only for the latest reply, once per reply, and only when that turn was dealt a dice pool (refusals name why). Spends one reroll in the ledger (idempotent by key), rethrows that reply's sighted pool in place, then runs the game's own retry-turn regenerate. Fitness facts stay as committed; the new dice lock again |
| Lock badge | A lock icon with an explanation in the reply's action row when the player message it answers has locked fitness facts |
| Ledger restored from an older backup | Detected when the ledger's newest journal entry is older than one this game already saw. The module stops writing the card and adding facts and shows a warning; "Continue from the journal as it is now" resumes from the restored ledger. Restoring the newer ledger backup instead clears the condition by itself |
| Marinara restored from an older backup | Nothing special: the next sync rewrites the card from the ledger and the next turn's facts cover everything since the restored game last saw |
| War table | The campaign pack's projects (14 in season one), replacing the three placeholders; see [Campaign views](#campaign-views-2026-11-22) |

## Validation (2026-11-18)

- [`harness/checks/fitness-turn.mjs`](../harness/checks/fitness-turn.mjs), 16/16 on
  scratch Marinara with a ledger seeded from the `steady` persona and the mock
  game master. It covers projection onto the player's card only, the sighted
  pool, old rewards marked seen, facts reaching the game master, a check-in
  logged between generations of one turn leaving regenerate and continue
  unchanged, the next turn reporting it once with its Marinara-thrown roll, the
  ledger holding exactly one check-in and one resolved roll, and the card
  following the ledger. It also passed 15/15 inside a hosted playtest session.
- The stage 1 swipe check still passes (15/15) on the modified Marinara.
- `pnpm check` (localization, formatting, type checks, production build) passed
  before the final change, which marks old rewards as seen on enabling;
  after it, the server typecheck, Prettier check and server build passed.
- Browser, in a hosted playtest session: the Training button appears in the
  game toolbar; the panel showed the persona card's level 6, the XP bar,
  resources, new rewards, today's six categories (Strength ticked from a logged
  check-in) and the journal; "Send scouts ahead" recorded a 2-supply spend for
  that chat in the ledger and showed the confirmation.
- Second pass (2026-11-18): `fitness-turn.mjs` grew to 23 checks (a plain
  regenerate faces the same `<dice_pool>`; a second chance spends exactly one
  reroll, is idempotent, is refused a second time and on an earlier turn; the
  retelling faces new dice with unchanged fitness facts; the new dice lock
  again) and passed 23/23. New
  [`fitness-recovery.mjs`](../harness/checks/fitness-recovery.mjs) passed 12/12:
  with the scratch ledger stopped, a turn generated without facts and locked
  nothing, and the panel reported it unreachable; after restoring the ledger
  from an older backup, the game flagged it, kept the card, and on acceptance
  followed the restored journal, with facts resuming next turn.
- Real model: `real-turn.mjs --fitness` with Gemma 4 26B A4B on den-nimo's
  Lemonade (loaded for this run) and the module on. The opener mentioned "a
  pleasant, dull ache from your own morning routine"; after a mobility
  check-in, the next turn opened with "the lingering warmth of your recent
  training session". No numbers, no guilt, Game Mode tags and choices intact.
  10–14 s per turn after a 40 s first turn.
- Not tested: mobile layout, the second-chance and restore flows through the
  browser (exercised through the same routes the panel calls), Lore's Windows
  install.
- `pnpm check` passed on the final `3d4a4bdf5` (localization, formatting, type
  checks, production build).

## DSH team in Game Mode (2026-11-19)

Owner: Claude Code session `s/a60d803335a9aa0a`. Marinara branch
`fitness/module` (commit in [progress](progress.md)); dsh-stage source in
`~/dev/experiments/roleplay/dsh-stage` on den-agents.

Direction (Patch, 2026-11-19): the DSH team is how Lore's campaign gets an
explorable wiki; trigger lorebooks stay the floor for plain Game Mode. See
[stage 5](05-campaign-season.md#lore-delivery-triggers-and-wiki-2026-11-19).

What changed:

- **Marinara gate.** The existing team turn (`custom/agent-turn`) now also runs
  for `game` chats with `teamTurn: true`, on the same path as roleplay: not for
  continue, impersonate, a separate Game tool connection or turns with model
  tools attached. Fitness games qualify because one-request dice withdraw the
  auto-attached dice tool. The game-start narration has no player message, so
  it stays a normal call.
- **Per-turn notes.** Game Mode merges its format reminder and depth-0 blocks
  (the locked `<fitness_facts>`, the dice pool) into the player's message.
  `splitGamePrompt` (`services/team-turn/team-request.ts`) cuts them off at the
  reminder's opening line and any trailing XML blocks, and sends them as
  `turnNotes`. The player's words alone become the chat line, so the persistent
  lore agent's and reviewer's contexts grow only by story. System messages after
  the conversation starts also go to the notes.
- **dsh-stage `mode: "game"` and `turnNotes`.** Backward compatible; absent, a
  turn is unchanged. The narrator gets the notes after the lore suggestions (the
  stable prefix stays cacheable) and a game brief: follow the output format
  exactly, and narrate committed results as given. The reviewer gets the notes
  and a `committed` note kind, and is told never to flag the game's markup. The
  lore agent never sees the notes. A change of mode starts fresh workers.
- **Output.** The approved text goes through Game Mode's own post-processing
  (speaker canonicalisation, GM verbs, sighted dice, skill-check tags) exactly
  as a single call's would. Mechanics were committed before the team ran, so a
  team failure or an odd reply cannot change them.
- **Wiki.** `team-wiki.ts` turns an entry's closing "See also: Title; Title"
  line into page links. The content build writes those lines, readable titles
  and one-line summaries ([stage 5](05-campaign-season.md#lore-delivery-triggers-and-wiki-2026-11-19)).
- **Toggle and status.** The Training panel has an "Agent team" button
  (`POST /api/fitness/chats/:id/team`), shown when the server has a team engine
  folder or the team is on. The panel reports the last team turn from the
  instance's `logs/turns.jsonl`: time taken, fell back, or reviewer notes
  unresolved. Off by default.

Recorded defaults:

| Item | Default |
| --- | --- |
| Engine folder | `MARINARA_TEAM_DSH_DIR`, else `C:\dev\Marinara-DSH` on Windows (unchanged) |
| Review | On, two revisions (the existing team defaults); `teamTurnReview: false` turns it off |
| Models | Every role uses the game's own connection and settings, as for roleplay |
| Turn notes size | Sent whole (about 18.7k characters on a pinned ruleset game: sheet blocks and format). Kept whole after the 2026-11-22 real-model run: from the second turn about two-thirds of the reviewer's input and over 90% of the lore agent's came from the prompt cache, and about 45% of the narrator's |
| Opening turn | Written by the normal single call, not the team: the startup trigger has no player line for the lore agent to work from. The team takes over from the first player turn |
| Test instance | `harness/scripts/serve-dsh-stage.sh`: npm `@deepseek-ai/dsh@0.2.2-alpha.2` (the release on den-lore) with the plugin built from source, port 3181 |

Deploying the plugin change to den-lore is stage 6 work: copy the built
`lib/` into `C:\Dev\Marinara-DSH\stage` and run `stage\windows\install.ps1`
(see the stage's `docs/harness.md`). Roleplay turns are unchanged by it.

Validation (2026-11-19), scripted provider only: `harness/checks/team-turn.mjs`
against scratch Marinara (fitness game, pinned ruleset, persona `steady`) with
its connection pointed at the dsh-stage mock provider and the local alpha.2
instance. 12/12 with the engine up: the team wrote the turn (lore, narrator,
reviewer, one revision); narrator and reviewer had the format and locked facts
as turn notes; the lore agent never saw them; the player's line was clean;
regenerate handed the team identical locked facts; the panel showed the turn.
5/5 with the engine stopped: the turn was saved by the normal call, the team
log recorded the failure, and the panel said so. The dsh-stage
`connection-test.mjs` passes on alpha.2 with the change (roleplay unchanged).
`pnpm build` and the server type check pass.

Real-model run (2026-11-22): a scratch Marinara whose game connection was
Gemma 4 26B A4B MTP on den-m5 (reasoning off), the same local alpha.2 DSH
instance, a fresh season-one game (human warrior, persona `steady`), one
mobility check-in, then an opening, two player turns and a regenerate.
These results come from scratch runs, not a browser or device test.

- Every player turn was written by the team (`team_lore`, `team_writing`,
  `team_review` phases) and passed review on the first round. It took 40 s on
  the first turn, then 27 s, then 24 s for the regenerate. The opening took 13 s
  through the normal call.
- Game Mode's markup survived: `[bg]`, `[ambient]`, the
  `[Name] [main] [expression]` lines and `[choices]` were all parsed as usual.
- The locked fitness facts (the mobility check-in's XP, the training and the
  bonus roll) were in the narrator's turn notes. The prose did not mention
  them. That fits the "mention lightly" brief, but it means the team adds
  nothing visible for the check-in on that turn.
- Prompt caching: on turn 2 the reviewer had 11.4k of its 17.5k input tokens
  cached, the narrator 4.9k of 11k, and the lore agent 11k of 12k.
- The lore agent suggested the right pages (Cullen, Drill the Garrison) on the
  first two turns. On the regenerate it produced no suggestions, so the turn
  used the keyword fallback (`fallbackLore: true`). The turn was still fine.
- The reviewer answered "none" every time, so a turn with notes still
  unresolved after the revisions has not been seen with a real model.
- Turn 1 put one of Cullen's thoughts in quotes and in the third person ("She's
  looking for the cracks…"). That is a narrator style slip that the reviewer
  did not catch.

Not yet done: an unresolved-review case, a browser look at the panel, and
deployment to den-lore.

## Campaign views (2026-11-22)

The Training panel now has tabs: Today (character, second chance, new rewards,
check-ins, agent team), War table (projects and the workshop), Companions,
Campaign and Journal.

| Item | Default |
| --- | --- |
| Where the choices come from | `content/build.mjs` writes `dist/campaign.json` (projects, recipes, companions, acts, missions); `content/install.mjs` stores it on the game chat as metadata `fitnessCampaign`. `install.mjs --chat ID --refresh-campaign` rewrites it after a pack update without touching progress |
| Where progress lives | Metadata `fitnessCampaignState` (act, missions done, projects done, things made, pending results), written only by the module. Without a pack the tabs say none is installed |
| War-table projects | Shown when their act is at or before the current act (`act: any` always). Each one is done once: the ledger spend comes first (idempotent by key), then the project is recorded. Ordering it again, or a later act's project, is refused |
| Project results | The project's Report and Unlocks text, with pack ids turned into names, waits as a pending line. The next turn's locked facts carry it once; a regenerate of that turn reads the same facts; the line is then cleared |
| Workshop | Recipes in `content/pack/crafting/` (11 in season one) make quartermaster items from supplies, some also using materials (elfroot, iron). Materials are checked in the Inquisitor's own pack before anything is spent. Then supplies are spent in the ledger, and the materials are taken and the item added through Game Mode's own inventory change, in the same write as the record. If the materials vanished between the check and the write (another change got there first), the item is still made and a warning is logged, because the supplies are already spent |
| Recipe costs | Supplies only, 1–2 per recipe, so the workshop draws on the same resource whose unspent amount gives extra health in fights |
| Acts and missions | The Campaign tab sets the current act (any act, so mistakes can be undone) and ticks missions done. Every turn's facts state the act, missions done and projects done. Story progress is never gated by activity |
| Companions tab | Each companion's summary, role and training line from the pack, with their missions open so far and a tick on those done. No approval score: the pack defines none and stage 5 left approval to the story |

Validation (2026-11-22), scratch Marinara with the mock game master and the
`steady` persona ledger:
[`harness/checks/campaign-views.mjs`](../harness/checks/campaign-views.mjs)
passed 16/16. The checks were:

- The pack was on the game, and the game started in act 1.
- A project spent its cost once. A retry with the same key spent nothing.
- A repeat order and a later act's project were refused (409).
- Two recipes put Elfroot and then Healing potions into the inventory, using up
  one Elfroot.
- Chainmail without iron was refused with supplies unchanged.
- The next turn's facts carried the report and what the workshop made. A
  regenerate read the same facts, and the pending results were then cleared.
- After setting act 2 and ticking a mission, the next turn stated both and did
  not repeat the report. An act 2 project then opened.

`fitness-turn.mjs` (24/24) and `swipe-persistence.mjs` (15/15) still pass, and
`pnpm check` (localization, formatting, lint, types, production build) passes.

The panel tabs are not yet seen in a browser.

**Games list after an install (resolved 2026-11-22).** In an earlier hosted
playtest session the sidebar's GM tab showed "No games yet" for a game created
through the API, although the server's chat API and the Home feed listed it.
Reproduced on a scratch Marinara with headless Chromium:

- A page opened after `install.mjs` lists the game in the GM tab.
- A page already open when the installer runs keeps its old list. Marinara
  turns off React Query's refetch on window focus (`main.tsx`); only the Home
  feed turns it back on, which is why Home showed the game and the sidebar did
  not.
- Pressing F5 through Playwright, which is what the earlier session did, does
  not reload the page, so those "reloads" never happened. A real reload lists
  the game.

Default: no Marinara change. The installer now ends by telling the operator to
reload any open Marinara tab, and stage 6 reloads Lore's open tabs after
installing.

### Browser look (2026-11-23)

Scratch Marinara on the built `fitness/module` client, a game from
`install.mjs`, the mock game master, and headless Chromium driven by Playwright
at 1280×800 and at 390×844 in phone mode (touch). The script went through
Marinara's normal flow: open the game from the GM list, Start Game, the
premise's Continue, the opening narration, then the Training button. It
captured every tab, then ordered Audit the Stores, made Elfroot and then
healing potions from it, tried Forge chainmail without iron, ticked The
Waystation and moved to act 2.

All five tabs render the pack's content at both sizes, with no horizontal page
scroll. Every control made the expected request and the panel showed the
result: the order became Done with its report, the made items reached the
inventory, the act 2 summary and missions replaced act 1's. Supplies ran from
15 to 11 (2 for the order, 1 for each recipe).

Fixed in Marinara `ad286aa9e` after the first pass:

- The panel changed height, and moved, with every tab. It now keeps one height
  (85% of the screen) while the tabs show.
- The tab bar scrolled away on long tabs, and on the phone Journal was cut off.
  It now stays at the top, and narrower padding below the `sm` breakpoint fits
  all five tabs at 390 px.
- Costs read "1 Supplies". They use plural keys: "1 supply", "2 supplies",
  "2 training".
- Recipes whose materials were missing looked orderable until the server
  refused them. Each material now shows how many the pack holds ("2 × Iron (you
  have 0)"), counted with Game Mode's own name matching, and such recipes are
  greyed out with an amber line. The server's refusal stays as the guard. The
  count updates after crafting (Elfroot 2, then 1 after the potions).
- On a phone the Training button is only an icon and had no accessible name. It
  now has the label "Training".
- "Rest and recovery" ran into its Log button on the phone; the row now wraps.

Not covered: Lore's actual devices (stage 6 device quality), a real model, the
Agent team section (needs a team engine), and the reward receipts list (no
unapplied grants in this run; the scripted checks cover it). Server code did not
change, so the server checks were not rerun; `pnpm check` passed.

## Fights (2026-11-23)

Before this, every fight in an installed game was Marinara's classic battle: the
installer never turned on the combat director, so the Inquisitor fought at
"Lv.1" with Engine numbers and nothing from the ledger counted. Now a fight is
resolved by the Inquisition ruleset, and the sheet the fitness module writes is
what it fights with.

What reaches a fight, all through supported Marinara ruleset combat:

| From the journal | In a fight |
| --- | --- |
| Level | Seasoned on every attack, save and initiative roll (the ruleset's check `adjust`, which a fight applies), +5 health per level, focus 1/2/3, and the class talents of each level reached |
| Unspent training | Drilled: +1 to attacks at 4, +2 at 8 |
| Unspent supplies | Provisioned: +4/+8/+12 health at 5/10/15 |
| Workshop and war table | Made weapons, armor and potions are Game Mode inventory; worn armor adds to Defense, a worn weapon is an attack, a potion is drunk from the Items menu and used up |

Spending supplies or training at the war table lowers Provisioned or Drilled in
the next fight, so it is a choice between readiness and campaign progress.

Defaults recorded (Patch prefers defaults to questions):

- **Fights are ruleset fights.** The installer sets the game's `combatDirector`
  (and the classic presentation, no board). Opponents come from the ruleset's
  bestiary when the Game Master's `[combat: enemies="…"]` names them, and
  Marinara's own fallback otherwise.
- **Class builds at install** (each sums to 7): warrior STR 3, DEX 1, MAG 0,
  CUN 0, WIL 1, CON 2, trained in Athletics, Intimidation, Survival and
  Fortitude; rogue STR 0, DEX 3, MAG 0, CUN 2, WIL 1, CON 1, trained in Stealth,
  Acrobatics, Perception and Reflex; mage STR 0, DEX 1, MAG 3, CUN 1, WIL 2,
  CON 0, trained in Arcana, Lore, Field medicine and Resolve.
- **Starting kit, worn:** warrior longsword, heater shield and chainmail; rogue
  paired daggers and scout leathers, with a longbow carried; mage staff and
  scout leathers. Every class starts with two healing potions.
- **Talents come with level.** On every sync the module adds each class talent
  whose level the journal's level has reached (campaign pack `progression`,
  built from the ruleset's `talent_trees`) to the sheet's talent list, marked
  `talent_trees/<id>` as the sheet's own picker marks a row, and the next turn's
  locked facts say "New talent at level N: …" once. Granted talents are
  recorded in the campaign state, so one the player removes is not added back.
- **Ruleset version 2** (`local/inquisition@2`): every talent has fight
  mechanics (attacks, saves for half, Guarded, Weakened, Knocked down, Marked,
  Chilled, Hidden with advantage on the next attack; Rally, Flurry of a
  Thousand Cuts and Chain Lightning spend focus). Talents roll with
  `talent_attack` (best of STR, DEX and MAG, plus Seasoned) and are saved
  against `talent_dc` (10 + that). The healing potion heals 2d8 + 4 for an
  action and is used up. Seasoned is applied once, through the check `adjust`;
  version 1 also listed it as a fight bonus, which counted it twice on
  attacks.
- **The battle stage shows the sheet's level** (Marinara `a4d81c963`) instead of
  the Engine's "Lv.1".

Validation on scratch Marinara with the mock game master
(`harness/mock-gm/combat-script.json`, where "I draw my sword" starts a fight
against a Venatori Gladiator):

- [`combat-preparation.mjs`](../harness/checks/combat-preparation.mjs) 20/20 for
  a level 6 warrior with 15 supplies and 10 training: health 70 (with
  Provisioned 12) and Defense 16 (shield and chainmail); longsword and Mighty
  Blow roll +4 (Strength 3 and Seasoned 1) with Drilled +2; the potion is on
  the menu with two left and drinking one leaves one; after spending 2
  supplies and 4 training the next fight has health 66 and Drilled +1; four
  talents granted and announced once, and a removed one stays removed.
- Rogue and mage installs, read through the fight API: rogue health 62,
  Defense 14, paired daggers and four rogue talents; mage health 58, Defense
  12, staff and four mage talents.
- A browser fight (headless Chromium, 1280×800) through Marinara's normal flow:
  the Game Master's reply opens the battle screen, the menu lists the
  longsword, the four talents with their focus cost and the potion with "2
  left", and the log shows the arithmetic ("15 + 4 + 1 (Drilled …) + 1
  (Drilled …) = 21 against Defense 13, a hit"), the potion ("Healing potion: 1
  of 2 left") and Mighty Blow knocking the gladiator down.
- `campaign-views.mjs` 16/16 (its pending count and potion count now allow for
  the talents and the starting potions), `fitness-turn.mjs --ruleset
  local/inquisition@2` 24/24, `swipe-persistence.mjs` 15/15,
  `fitness-recovery.mjs` 12/12, and `pnpm check`.

Not covered: a real model choosing bestiary names and narrating the outcome, a
level-up during play (the persona's level is fixed; the grant is the same code
path at any level), the character sheet in a browser, a positioned (board)
fight, and Lore's devices.

## Marinara update procedure

The fitness module is ordinary commits on a local branch; it is merged, not
patched in. Lore's running copy is `C:\Dev\Marinara-Engine` on
`local/cartesia-2.4.6`; development happens in `C:\Dev\Marinara-Custom` (and
its den-agents copy) on `fitness/module`, which is `custom/agent-turn` plus the
fitness commits.

1. Back up `C:\dev\Marinara-Data`, Marinara-Engine's `.env`, and the ledger
   (`node src/cli.ts backup`).
2. In the development checkout, merge the intended upstream stable release into
   `custom/agent-turn` first, following that fork's `LOCAL-PATCHES.md` (Cartesia,
   OpenCode sessions, custom-provider settings, Add spice, Conversation
   playback, the DSH agent turn). Then merge `custom/agent-turn` into
   `fitness/module`.
3. Expected conflict points for the fitness module, all small:
   `packages/server/src/routes/generate.routes.ts` (the 16-line hook before
   `injectCharacterAdvancedPrompts()` and one import), `routes/index.ts` (one
   import and one `register`), `config/runtime-config.ts` (one getter),
   `GameSurface.tsx` and `GameNarration.tsx` (props, the Training button, the
   lock badge, one `useMemo`), the English locale catalog (sorted keys) and
   `CHANGELOG.md`. Everything else is in new files. If upstream renames the Game
   Mode prompt assembly, re-place the hook so it still runs after the player
   message is saved and before the final format reminder.
4. Validate: `pnpm check`; then on a scratch instance
   (`harness/scripts/serve-scratch-marinara.sh --persona steady`) run
   `harness/checks/swipe-persistence.mjs`, `fitness-turn.mjs` and
   `fitness-recovery.mjs`, and `real-turn.mjs --fitness` against a LAN model.
5. Deploy by merging `fitness/module` into Marinara-Engine's
   `local/cartesia-2.4.6` (or fast-forwarding that checkout to it), `pnpm install`,
   `pnpm build`, set `FITNESS_LEDGER_URL` in its `.env` if the ledger is not on
   `127.0.0.1:7900`, and restart Marinara. Stage 6 owns the first deployment.

## Dice, combat and narrative

Use Marinara's real dice service and persist the result in both the host receipt
and the ledger's corresponding grant. A natural-language report of a roll is not
evidence that the engine performed it.

Combat runs through the Inquisition ruleset's resolver. Keep companion tactics,
abilities, defenses, preparation and encounter rewards consistent with it, and
describe the mechanics actually supplied rather than claiming an official
tabletop system.

With DSH enabled, adapt the integration around committed mechanical results; do
not pass plain team prose through a game parser and assume every state update
survived. DSH's lore keeper, narrator and reviewer improve scenes and continuity.
They do not own XP math, inventory balances or whether an activity counted.
Preserve bounded review and fallback; surface unresolved review accurately.
Default: DSH is off for a new game until it passes the acceptance items below.

## Deliverables

- A documented integration contract and compatible revisions for this project,
  Marinara and the DSH stage.
- Working desktop campaign surfaces and integration fixtures.
- A source-owned Marinara patch, plus any DSH changes and their build procedure.
- A recorded complete flow: activity → check-in → grant → real bonus roll →
  companion scene → preparation choice → encounter → saved campaign result.

## Acceptance evidence

- [ ] UI receipts match the actual journal, grant and dice records.
- [ ] The character sheet and combat resolver use the promised benefits.
- [ ] Repeating delivery, generation, swipe or continue does not award, roll or
  spend twice, and locked results stay the same.
- [ ] Spending the reroll resource changes the result once and is recorded.
- [ ] A committed encounter survives restart and produces its intended result.
- [ ] Game choices/commands remain functional with DSH enabled.
- [ ] DSH failure preserves the useful existing fallback and committed rewards.
- [ ] Representative unrelated chats still follow their existing behavior.
- [ ] Relevant repository checks and visible UI/playthrough evidence are recorded.

Update [progress.md](progress.md) and post major integration milestones to the
crew thread. Describe what is working and what remains unverified, especially
when host code exists but no complete user-visible flow has been exercised.
