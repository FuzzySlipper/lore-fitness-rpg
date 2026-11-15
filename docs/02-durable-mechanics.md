# Stage 2 — Durable activity and progression mechanics

Status: Planned. Owner: Unassigned. Updated: 2026-11-15.

[Outline](implementation.md) · [Progress](progress.md) ·
[Previous: platform contract](01-platform-contract.md) ·
[Next: Marinara integration](03-marinara-integration.md)

## Outcome and dependencies

Build the fitness service, journal and progression rules against the verified
stage 1 contracts. Run the service on den-lore. Real activity and earned rewards
must survive ordinary restart, retry, correction and narrative rewind.

Use a small TypeScript service with a SQLite ledger as the starting design.
Keep mechanics independent of the campaign's prose and presentation.

## Work checklist

- [ ] Create the service, versioned API schema, configuration example and
  synthetic fixture runner; document actual install/run/check commands.
- [ ] Implement activity ingestion, durable acknowledgment and duplicate handling.
- [ ] Represent manual and imported sources, intervals, units, timezone,
  revisions and unavailable optional fields explicitly.
- [ ] Implement journal reads, corrections, backdating and undo with a visible
  explanation of resulting reward adjustments.
- [ ] Implement configurable progression rules and persisted grant receipts.
- [ ] Implement pending bonus-roll requests and replay-safe result receipt.
- [ ] Implement campaign grant projection and acknowledgment contracts.
- [ ] Add backup/migration support appropriate to the ledger's real data shape.
- [ ] Expose useful sync/processing status for the desktop, phone and watch.

## Data responsibilities

Keep activity records, their source mappings, earned grants, stored bonus rolls
and campaign application receipts distinguishable. An ordinary transaction and
clear tables are sufficient; a general event-processing platform is not required.

Persist accepted data before reporting durable acceptance to a client. Store
client/source identity and revisions so retransmission updates or acknowledges
the existing event. Use an explicit pending-delivery record when a downstream
component is unavailable; reconnect must not require the player to re-enter work.

Activity-to-grant rules have a recorded version. A rules update must not silently
reroll old rewards or reinterpret the entire history. Provide a deliberate
recalculation/migration path if a future change needs one.

Corrections should preserve what changed and why. Decide how reversing an
incorrect grant interacts with already-spent campaign rewards, and document a
player-visible resolution. Do not erase journal history or silently invent
negative catch-up obligations.

## Progression behavior

Qualifying effort earns guaranteed base recognition. Extra dice may select a
bonus, discovery or scene; a low roll does not invalidate completed activity.
Separate permanent development from preparation resources and bounded bonuses.

Support walks/general movement, workouts/strength, mobility, chosen meal habits,
hydration and recovery. Allow adjustable goals and equivalent accessible
alternatives. Activity supports the chosen class rather than determining it.
Avoid unlimited progression from repeated water entries or increasing intensity.

Do not add overlapping step totals, workout duration and duplicated Health
Connect records as independent rewards for the same accomplishment. This is
correct accounting, not an anti-cheat system. Manual entries are a normal path.

When a bonus needs Marinara's dice, assign its stable request/grant identity
before dispatch. The adapter must persist the resulting roll before
acknowledgment and return it on retry. Base XP remains available while that
bonus is pending. Stage 3 implements the Marinara side of this contract.

## Campaign rewind semantics

Real activity and earned grants are player history. Campaign spending and
fictional choices belong to the campaign save. A checkpoint records enough
projection/spending state to rebuild its view without awarding an activity twice.

Specify branch behavior, restore behavior and resynchronization after replacing
either the ledger or the campaign from backup. Use explicit reconciliation status
when those snapshots disagree rather than silently discarding one side.

## Deliverables and acceptance

- [ ] Runnable service with documented commands and synthetic examples.
- [ ] A journal entry and explainable receipt for every accepted fixture event.
- [ ] Duplicate/reordered delivery and a restarted client/service produce the
  intended single event and grant.
- [ ] Imported copies and overlapping sources do not multiply rewards.
- [ ] Late arrival, timezone/day boundaries, corrections and undo have recorded,
  repeatable outcomes.
- [ ] Replaying the same accepted input and stored rolls yields the same grants.
- [ ] Changing prose or restoring a campaign does not delete activity or generate
  another grant/roll.
- [ ] Ledger backup/restore and one representative schema migration retain the
  journal and receipts.
- [ ] Missing optional measurements leave useful manual logging available.

Record actual fixtures, commands, results, commit references and unresolved
accounting decisions here and in [progress.md](progress.md). Post completion or
material rule/contract changes to the crew thread.
