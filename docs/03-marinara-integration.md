# Stage 3 — Marinara campaign and DSH integration

Status: Planned. Owner: Unassigned. Updated: 2026-11-15.

[Outline](implementation.md) · [Progress](progress.md) ·
[Previous: durable mechanics](02-durable-mechanics.md) ·
[Next: phone and watch](04-phone-and-watch.md)

## Outcome and dependencies

Connect the durable activity/grant contract from stage 2 to Marinara's campaign,
real dice, character progression, combat and desktop UI. Extend the existing DSH
team so the campaign retains lore-aware, character-driven narration.

Recheck the [source map](references.md) and stage 1 findings. Read the custom
Marinara repository's instructions before changing its code. Track changes in
both repositories with concrete commit references in the handoff.

## Ownership

- This repository owns fitness mechanics, API contracts, campaign content and
  adapter-facing support code that can live independently of Marinara.
- Marinara owns host UI, game-state commit hooks, ruleset/character projection,
  dice persistence, combat handling and its generation integration.
- The existing DSH stage owns its narrative-team runtime. Establish its actual
  source/build workflow instead of editing an installed bundle without a source.

Keep a focused patch in the existing custom checkout. Do not copy Marinara into
this repository or replace its provider, speech or session customizations.
Windows personal server extensions are not the backend integration path.

## Work checklist

- [ ] Define and implement supported host adapter operations for grant retrieval,
  bonus-roll receipts, campaign application and committed encounter outcomes.
- [ ] Persist bonus rolls by the stable request identity from stage 2; reconnect
  and acknowledgment loss must return the already-resolved roll.
- [ ] Apply grants through actual character/ruleset/storage interfaces, recording
  application status and avoiding duplicate changes.
- [ ] Integrate the journal and reward receipts into the campaign UI.
- [ ] Implement Today, Journal, Character, Companions, War Table and Campaign
  navigation appropriate to the existing Marinara interface.
- [ ] Connect preparation resources and training progression to actual combat
  benefits, choices and equipment rather than only narrative claims.
- [ ] Adapt DSH to the Game Mode turn protocol, preserving state updates, choices,
  saved dice, encounter transitions and normal provider fallback.
- [ ] Handle regeneration, swipes, restart, continuation and checkpoint restore
  explicitly; retain the existing behavior for unaffected chats.
- [ ] Expose useful status when the fitness service, DSH or optional narration is
  unavailable while preserving completed journal/mechanical work.

## Dice, combat and narrative

Use Marinara's real dice service and persist the result in both the host receipt
and the ledger's corresponding grant. A natural-language report of a roll is not
evidence that the engine performed it.

Reuse Game Mode's engine-resolved combat or its supported ruleset path. A
Dragon Age-themed rules package is not automatically an implementation of an
official tabletop system; describe the mechanics actually supplied. Keep
companion tactics, abilities, defenses, preparation and encounter rewards
consistent with the selected resolver.

The existing DSH integration currently accepts ordinary Roleplay turns and its
team produces prose. A Game Mode turn may also require structured commands and
choices. Adapt the integration around committed mechanical results; do not pass
plain team prose through a game parser and assume every state update survived.

Send DSH concise accepted activity and reward summaries. Its lore keeper,
narrator and reviewer improve scenes and continuity. They do not own XP math,
inventory balances or whether an already-completed activity counted. Preserve
bounded review and fallback; surface unresolved review accurately.

## Deliverables

- A documented integration contract and compatible revisions for this project,
  Marinara and the DSH stage.
- Working desktop campaign surfaces and integration fixtures.
- A source-owned Marinara patch, plus any DSH changes and their build procedure.
- A recorded complete flow: activity → grant → real bonus roll → companion
  scene → preparation choice → encounter → saved campaign result.

## Acceptance evidence

- [ ] UI receipts match the actual journal, grant and dice records.
- [ ] The character sheet and combat resolver use the promised benefits.
- [ ] Repeating delivery, generation or restore does not award or roll twice.
- [ ] A committed encounter survives restart and produces its intended result.
- [ ] Regeneration/swipes and checkpoint restore preserve real activity while
  handling fictional state as specified in stage 2.
- [ ] Game choices/commands remain functional through the adapted DSH path.
- [ ] DSH failure preserves the useful existing fallback and committed rewards.
- [ ] Representative unrelated chats still follow their existing behavior.
- [ ] Relevant repository checks and visible UI/playthrough evidence are recorded.

Update [progress.md](progress.md) and post major integration milestones to the
crew thread. Describe what is working and what remains unverified, especially
when host code exists but no complete user-visible flow has been exercised.
