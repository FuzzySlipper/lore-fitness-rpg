# Stage 3 — Marinara campaign and DSH integration

Status: In progress; the Game Mode fitness module works end to end on scratch
Marinara (2026-11-18). Owner: Claude Code session `s/a60d803335a9aa0a`.
Updated: 2026-11-18.

Code: Marinara branch `fitness/module` at `2ee03fc13`, based on
`custom/agent-turn` `3050e9a40`. It exists in the den-agents copy
(`~/dev/lore-fitness-rpg-work/marinara-custom`) and was fetched into
`C:\Dev\Marinara-Custom` on den-lore as a branch only; that checkout's working
tree was not changed, and nothing is deployed to Lore's `Marinara-Engine`.
Next useful actions: the reroll ("second chance") action, a lock marker on
locked turns, backup-restore reconciliation, then DSH.

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
  on Marinara's sighted dice pool); war-table outcomes beyond the spend itself
  and the lock marker remain.
- [ ] Reroll resource: a visible action that spends one recovery-earned reroll
  to re-resolve a locked result, recorded in the ledger.
- [ ] Committed UI actions for spending preparation resources, war-table
  operations and crafting, recorded in the ledger rather than narrated turns.
  War-table spends done (three default projects); crafting waits for the stage 5
  item catalog.
- [x] Persist bonus rolls by the stable request identity from stage 2; reconnect
  and acknowledgment loss must return the already-resolved roll.
- [ ] Implement Today, Journal, Character, Companions, War Table and Campaign
  views appropriate to the existing Marinara interface, with reward receipts.
  Today, Journal, Character and War Table are in the Game Mode Training panel;
  Companions and Campaign wait for stage 5 content.
- [ ] Connect preparation resources and training progression to actual ruleset
  combat benefits, choices and equipment rather than only narrative claims.
- [ ] Handle regeneration, swipes, restart, continuation and backup restore
  explicitly; retain the existing behavior for unaffected chats.
- [ ] Expose useful status when the fitness service, DSH or optional narration is
  unavailable while preserving completed journal/mechanical work.
- [ ] Record a Marinara update procedure: how to merge an upstream release into
  the custom branch with the fitness module and other local patches.
- [ ] DSH (after the Game Mode path works): a per-game toggle that sends DSH the
  committed facts for a turn and keeps Game Mode's structured output. The
  reviewer checks prose against committed results and companion knowledge limits.

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
| War table | Three placeholder projects (send scouts: 2 supplies; drill the recruits: 2 training; provision the next expedition: 4 supplies) until stage 5 supplies real ones |

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
- Not tested: a real model with fitness facts, the ledger-down path, mobile
  layout, Lore's Windows install.

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
