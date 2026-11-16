# Stage 3 — Marinara campaign and DSH integration

Status: Planned. Owner: Unassigned. Updated: 2026-11-16.

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
  and committed encounter outcomes against the stage 2 API.
- [ ] Write level and build changes into the game build
  (`chat.metadata.gameCharacterCards[].rulesetSheet`), never as turn-level live
  sheet changes. Record application status and avoid duplicate changes.
- [ ] Locked results: commit dice, grants and outcomes before narration on every
  mechanical turn; swipe, regenerate and continue rewrite only the prose. Extend
  the existing pre-thrown dice queue guarantee and show a lock marker on locked
  turns.
- [ ] Reroll resource: a visible action that spends one recovery-earned reroll
  to re-resolve a locked result, recorded in the ledger.
- [ ] Committed UI actions for spending preparation resources, war-table
  operations and crafting, recorded in the ledger rather than narrated turns.
- [ ] Persist bonus rolls by the stable request identity from stage 2; reconnect
  and acknowledgment loss must return the already-resolved roll.
- [ ] Implement Today, Journal, Character, Companions, War Table and Campaign
  views appropriate to the existing Marinara interface, with reward receipts.
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
