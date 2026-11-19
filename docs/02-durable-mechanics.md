# Stage 2 — Durable activity and progression mechanics

Status: In progress. Owner: Claude Code session `s/a60d803335a9aa0a` (started
2026-11-18). Updated: 2026-11-18.

Current work (2026-11-18): the service under [`service/`](../service/) — SQLite
ledger, ingestion with duplicate/revision handling, daily check-ins, grants,
corrections, resources, rerolls, bonus-roll receipts, projection contract,
backup/migration and the synthetic history generator — so the stage 6 harness
can feed persona histories to a scratch ledger. Next step after that: wire the
harness to it.

[Outline](implementation.md) · [Progress](progress.md) ·
[Previous: platform contract](01-platform-contract.md) ·
[Next: Marinara integration](03-marinara-integration.md)

## Outcome and dependencies

Build the fitness service, journal and progression rules. Run the service on
den-lore. Real activity and earned rewards must survive ordinary restart, retry,
correction and narrative rewind. Start now from the defaults in the
[implementation outline](implementation.md); adjust when stage 1 checks report.

Use a small TypeScript service with a SQLite ledger. Keep mechanics independent
of the campaign's prose and presentation. The ledger is authoritative for XP,
level and preparation-resource balances; Marinara displays and uses them.

## Work checklist

- [ ] Create the service, versioned API schema, configuration example and
  synthetic fixture runner; document actual install/run/check commands.
- [ ] Implement activity ingestion, durable acknowledgment and duplicate handling.
- [ ] Represent manual and imported sources, intervals, units, timezone,
  revisions and unavailable optional fields explicitly.
- [ ] Implement daily category check-ins derived from activity records.
- [ ] Implement journal reads, corrections, backdating and undo with a visible
  explanation of resulting reward adjustments.
- [ ] Implement configurable progression rules, XP/level and persisted grant receipts.
- [ ] Implement preparation-resource balances and spend records for committed
  UI actions (war table, expedition preparation, crafting).
- [ ] Implement the reroll resource earned on recovery days and its spend record.
- [ ] Implement pending bonus-roll requests and replay-safe result receipt.
- [ ] Implement campaign grant projection and acknowledgment contracts.
- [ ] Implement a synthetic activity-history generator for internal playtests:
  ordinary weeks, busy weeks, illness, missed days and returns after a break.
- [ ] Add backup/migration support appropriate to the ledger's real data shape.
- [ ] Expose useful sync/processing status for the desktop, phone and watch.

## Default reward model

Each category earns at most one check-in per local day:

| Category | Default qualifying evidence |
| --- | --- |
| Moved | A walk or other movement session, or a daily step total above Lore's chosen goal |
| Strength | A strength workout or manual strength entry |
| Mobility | A stretching/mobility session or manual entry |
| Meal habit | A manual check-in against Lore's chosen meal habit |
| Hydration | Lore's chosen daily hydration goal met; more water earns nothing extra |
| Rest/recovery | A declared recovery day or recovery activity; earns the reroll resource |

An earned check-in grants fixed base XP plus one bonus roll with Marinara's
dice. Several sources for the same category and day (steps, an OHealth
workout, a watch drill, a manual entry) collapse into one check-in; the journal
still lists each source. A daily cap on base XP and diminishing returns on
preparation resources prevent long-term power creep. Starting numbers are
placeholders to tune during internal playtests, not fitness advice; record the
tuned values and rule version here.

The day boundary is Lore's local midnight at the activity's recorded timezone.
Backdated entries earn the check-in for their own day if that day's category is
still unearned.

## Data responsibilities

Keep activity records, their source mappings, check-ins, earned grants, stored
bonus rolls, resource spends and campaign application receipts distinguishable.
An ordinary transaction and clear tables are sufficient; a general
event-processing platform is not required.

Persist accepted data before reporting durable acceptance to a client. Store
client/source identity and revisions so retransmission updates or acknowledges
the existing event. Use an explicit pending-delivery record when a downstream
component is unavailable; reconnect must not require the player to re-enter work.

Activity-to-grant rules have a recorded version. A rules update must not silently
reroll old rewards or reinterpret the entire history. Provide a deliberate
recalculation/migration path if a future change needs one.

Corrections preserve what changed and why. Default for reversing a grant that
was already spent: keep the spend, record a small negative balance on the
affected resource that later check-ins fill first, and explain it in the
journal. Never claw back XP-derived level, never erase journal history and never
create catch-up obligations.

## Campaign rewind semantics

Real activity, check-ins, grants and resource spends are player history.
Narrated fictional state belongs to the campaign save. Mechanical results are
committed before narration (see stage 3), so swipes, regeneration and
continuation never award, roll or spend twice.

Checkpoint restore is out of scope because Game Mode has no restore UI. After
restoring either the ledger or Marinara from backup, compare projection receipts
with the game build and show an explicit reconciliation status rather than
silently discarding one side.

## Deliverables and acceptance

- [ ] Runnable service with documented commands and synthetic examples.
- [ ] A journal entry and explainable receipt for every accepted fixture event.
- [ ] Duplicate/reordered delivery and a restarted client/service produce the
  intended single event, check-in and grant.
- [ ] Imported copies and overlapping sources collapse into one daily check-in.
- [ ] Late arrival, timezone/day boundaries, corrections and undo have recorded,
  repeatable outcomes.
- [ ] Replaying the same accepted input and stored rolls yields the same grants.
- [ ] Changing prose or swiping does not delete activity or generate another
  grant, roll or spend.
- [ ] Ledger backup/restore and one representative schema migration retain the
  journal and receipts.
- [ ] Missing optional measurements leave useful manual logging available.
- [ ] The synthetic history generator produces several weeks of varied activity
  for the internal playtest.

Record actual fixtures, commands, results, commit references and tuned rules
here and in [progress.md](progress.md). Post completion or material rule/contract
changes to the crew thread.
