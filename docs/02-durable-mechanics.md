# Stage 2 — Durable activity and progression mechanics

Status: Service implemented (2026-11-18); den-lore deployment and the swipe
acceptance through Marinara remain. Owner: Claude Code session
`s/a60d803335a9aa0a`. Updated: 2026-11-18.

The service lives in [`service/`](../service/README.md) with its commands, API
contract and the steps the stage 3 fitness module follows. Next useful actions:
the stage 3 module consumes `/v1/projection`, `/v1/bonus-rolls` and `/v1/spends`;
stage 4 maps Health Connect records onto the activity record; stage 6 installs
it on den-lore.

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

- [x] Create the service, versioned API schema, configuration example and
  synthetic fixture runner; document actual install/run/check commands.
- [x] Implement activity ingestion, durable acknowledgment and duplicate handling.
- [x] Represent manual and imported sources, intervals, units, timezone,
  revisions and unavailable optional fields explicitly.
- [x] Implement daily category check-ins derived from activity records.
- [x] Implement journal reads, corrections, backdating and undo with a visible
  explanation of resulting reward adjustments.
- [x] Implement configurable progression rules, XP/level and persisted grant receipts.
- [x] Implement preparation-resource balances and spend records for committed
  UI actions (war table, expedition preparation, crafting).
- [x] Implement the reroll resource earned on recovery days and its spend record.
- [x] Implement pending bonus-roll requests and replay-safe result receipt.
- [x] Implement campaign grant projection and acknowledgment contracts.
- [x] Implement a synthetic activity-history generator for internal playtests:
  ordinary weeks, busy weeks, illness, missed days and returns after a break.
- [x] Add backup/migration support appropriate to the ledger's real data shape.
- [x] Expose useful sync/processing status for the desktop, phone and watch.

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

- [x] Runnable service with documented commands and synthetic examples.
- [x] A journal entry and explainable receipt for every accepted fixture event.
- [x] Duplicate/reordered delivery and a restarted client/service produce the
  intended single event, check-in and grant.
- [x] Imported copies and overlapping sources collapse into one daily check-in.
- [x] Late arrival, timezone/day boundaries, corrections and undo have recorded,
  repeatable outcomes.
- [x] Replaying the same accepted input and stored rolls yields the same grants.
- [ ] Changing prose or swiping does not delete activity or generate another
  grant, roll or spend. The ledger side holds by construction (grants come only
  from activity; rolls resolve once; spends are keyed), but the end-to-end check
  needs the stage 3 module and stays open until then.
- [x] Ledger backup/restore and one representative schema migration retain the
  journal and receipts.
- [x] Missing optional measurements leave useful manual logging available.
- [x] The synthetic history generator produces several weeks of varied activity
  for the internal playtest.

## Rules version 1 and recorded defaults (2026-11-18)

Placeholders to tune in internal playtests; [`service/src/rules.ts`](../service/src/rules.ts)
is the source of truth.

| Item | Default |
| --- | --- |
| Check-in reward | 20 XP; daily cap 120 (all six categories), which only matters if later rules add XP |
| Level curve | Level L at 50 × L × (L − 1) XP (2 at 100, 5 at 1,000, 10 at 4,500), maximum 20. Level never goes down after a correction |
| Resources | `supplies` from Moved, Meal habit and Hydration; `training` from Strength and Mobility; `reroll` (the Fade-touched second chance) from Rest and recovery. One per check-in |
| Diminishing returns | A check-in grants no resource while that resource's unspent balance is at its soft cap: supplies 15, training 10, rerolls 3. The journal says to spend some at the war table |
| Bonus roll | 1d20 per check-in, rolled by Marinara's dice. 18–20 is a lucky find: +1 of the check-in's resource, within the soft cap |
| Steps | Default goal 6,000. The best single source's daily total counts, not the sum across devices, because phone and watch count the same walk |
| Hydration | Default goal 2,000 ml. Drinks add up across devices; a manual "goal met" entry also counts; extra water earns nothing |
| Meal habit | A manual check-in against the habit text in settings |
| Goal changes | Apply to evaluations from then on; an earned check-in is never revoked by a goal change alone |
| Unknown activity kinds | Kept in the journal without a category; they earn nothing until one is set |
| Corrections | Manual entries are edited in place with a revision. Imported records are not edited; the player removes them (removal survives re-import) and logs a manual entry. Restore undoes a removal |
| Withdrawn check-ins | Reversal grants for its XP, resource and bonus find; a pending bonus roll is cancelled; balances may go negative and later check-ins fill them first |
| Same revision, different content | The stored copy is kept with a warning; sources must raise the revision to change a record |
| Refusals | A spend larger than the balance (409; prevents a committed war-table action from overdrawing). A ledger with a newer schema than the service (prevents misreading or overwriting it). Bad individual records are rejected one by one with a reason while the rest of the batch is accepted |
| Day-level entries | A `YYYY-MM-DD` start belongs to that local date and is stored at local noon |
| Backups | One at every service start, last ten kept, plus `cli.ts backup` on demand |
| Access | LAN-only, no accounts (household service) |
| Runtime | Node ≥ 24 type stripping with `node:sqlite`; no runtime dependencies or native build |

## Validation (2026-11-18)

- `npm test`: 23 `node:test` tests pass — duplicates and revisions, overlapping
  sources, steps across devices, hydration, time-zone day boundaries,
  backdating, withdrawal with negative balances, level floor, bonus-roll
  idempotency, spend idempotency and refusal, rerolls and soft caps, projection
  receipts, manual edits, rejected records and warnings, rule-version retention,
  replay determinism, every persona history earning exactly its schedule under
  delivery noise, generator determinism, backup and reopen, v1 → v2 migration,
  newer-schema refusal, and an HTTP resend across a service restart.
- `npm run typecheck` clean.
- On den-lore (Windows 11, Node 25.9.0 from Lore's fnm install, run from
  `C:\Dev\lore-fitness-rpg\service` with nothing installed): 23/23 pass after
  `b50d37d` fixed a test's hard-coded `/tmp` path. Nothing was started or
  installed there.
- Manual run: `cli.ts seed` for all five personas with noise matched their
  schedules (steady 84/84, busy 21/21, illness 58/58, missed-days 15/15,
  returning 60/60); `main.ts` served the seeded ledger and `/v1/summary` and
  `/v1/journal` read back correctly.
- Not yet done: den-lore service install, real Health Connect payloads, Marinara module.

Record actual fixtures, commands, results, commit references and tuned rules
here and in [progress.md](progress.md). Post completion or material rule/contract
changes to the crew thread.
