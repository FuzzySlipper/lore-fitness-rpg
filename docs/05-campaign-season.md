# Stage 5 — Inquisition ruleset and complete campaign

Status: Planned. Owner: Unassigned. Updated: 2026-11-16.

[Outline](implementation.md) · [Progress](progress.md) ·
[Previous: phone and watch](04-phone-and-watch.md) ·
[Next: stabilization and release](06-stabilization-and-release.md)

## Outcome and dependencies

Author the Inquisition ruleset and a complete first season that makes
activity-driven progression worth returning to. Start now: the ruleset uses
Marinara's supported ruleset schema, and canon research, character design and
scene authoring need no client. Final import and playthrough use stages 2–3's
real progression, dice and combat behavior.

Keep this a versioned campaign pack, with explicit content dependencies and
migrations. The same fitness/transport foundation should support later regions
and campaigns without replacing a player's activity history.

## Inquisition ruleset package

Write a Game Mode ruleset package against Marinara's ruleset schema
(`docs/extending/writing-rulesets.md` and `docs/extending/ruleset.schema.json`
in the Marinara checkout). It is the supported home for campaign mechanics and
needs no fork changes.

- [ ] Classes (Warrior, Rogue, Mage) and specializations, with a sheet layout,
  attributes, skills, resources (including a focus-style resource) and level table.
- [ ] Abilities and talents that training progression unlocks.
- [ ] Items, equipment slots, crafting materials and war-table resources.
- [ ] Enemies and encounter stat blocks: Venatori, Red Templars, demons and
  Corypheus's forces.
- [ ] Ruleset-resolved combat, with preparation resources mapped to concrete
  combat benefits.
- [ ] A difficulty ladder and dice notation used by checks and reward rolls.

Describe the mechanics actually supplied; this is a Dragon Age-themed ruleset,
not an implementation of an official tabletop system.

## Canon defaults

Use these unless Patch says otherwise; record any change here.

| Choice | Default |
| --- | --- |
| Timeline | After the Inquisition settles at Skyhold and before the assault on Adamant; Corypheus is active and undefeated |
| Lore's character | The Inquisitor, played directly (Lore's choice, relayed by Patch on 2026-11-16) |
| Inquisitor race | Human, elf, dwarf or Qunari (Vashoth), chosen at onboarding and changeable later from a setting without restarting the campaign or touching the ledger |
| Inquisitor class and name | Class comes from the ruleset (Warrior, Rogue, Mage) and is chosen at onboarding; name, appearance notes and pronouns are free-form |
| Companion secrets | Solas's identity, Blackwall's past and Iron Bull's Ben-Hassrath ties stay hidden unless a companion arc's conditions reveal them; no Trespasser content in season one |
| Romance | Not a default campaign track; companion relationships are friendship and loyalty |
| Alternate history | None by default; any deliberate divergence is recorded in the content pack |

## Original deliverables to retain

- [ ] Importable playable character card and RPG framework.
- [ ] Fitness-to-progression rules that match the implemented mechanics.
- [ ] Supported dice notation, thresholds and reward behavior.
- [ ] Combat configuration using the ruleset and actual Marinara functionality.
- [ ] Detailed lorebook entries for Sera, Cullen Rutherford, Dorian Pavus,
  the Iron Bull and Blackwall.
- [ ] An immersive opening at Skyhold that establishes Lore's character and
  the approaching conflict with Corypheus.

## Full-season work

- [ ] Separate authored canon, campaign choices, played-event memory and mechanics.
- [ ] Make Inquisitor race a single campaign variable. Key race-specific
  content to it: companion reactions (for example Sera and Solas with an elven
  Inquisitor, Iron Bull with a Vashoth one, Cassandra and Leliana on a human
  noble), NPC address and prejudice, backstory hooks, and any ruleset traits.
  Changing the race swaps those entries and the character build's race line;
  it never alters activity, grants or past session summaries.
- [ ] Author all eight requested companions: Solas, Cassandra, Leliana, Cullen,
  Dorian, Sera, Iron Bull and Blackwall.
- [ ] Build Skyhold as a returning hub with training, companion scenes,
  preparation/crafting and war-table decisions.
- [ ] Author three complete acts with meaningful choices and a first-season
  conclusion; account for branches without requiring an endless generated plot.
- [ ] Provide approximately 20–30 authored mission/scene templates and 10–15
  encounter templates, with deliberate variation and repeatable operations.
- [ ] Provide recovery-day, low-activity, missed-day and returning-after-a-break
  content that remains enjoyable and useful.
- [ ] Write in-character text for watch features: raven notifications, drill
  cues and dice-roll flavor per companion.
- [ ] Build the content manifest/import/export path and preserve an independently
  importable character card alongside the complete campaign pack.
- [ ] Connect presentation assets/theme and optional voice choices through the
  supported host tools; record where assets came from and how to regenerate them.

## Companion and lore entry structure

Each companion needs background, motivations, personality, speech patterns,
dialogue examples, relationship to the Inquisition, player interactions, training
role and reactions to both accomplishments and setbacks. Add scene hooks,
knowledge limits and the conditions under which revelations become available.

Write dialogue examples as original lines in each character's voice, not quotes
from the game; this repository is public.

Relationships advance through fictional choices and conversation as well as
activity milestones. Do not reduce every companion to a differently worded
fitness reminder. Let humor and disagreement coexist with encouragement.

Use the chosen timeline to determine character knowledge and location states.
Including a secret in the lorebook must not reveal it to every NPC immediately.
Skyhold, Haven, the Hinterlands, Val Royeaux and the Storm Coast should appear
only in ways consistent with the selected story point and established world.

## Mechanics and pacing

Write around actual committed check-ins, grants, rolls, sheets and encounter
outcomes. Content should never promise a skill, item or stat change that the
runtime does not apply. Replace placeholder numbers with tuned rules before
shipping.

Activity recognition remains guaranteed; dice enrich consequences. Give Lore
decisions about preparation, routes, companions, tactics and resource use.
Offer meaningful play without requiring a fresh workout before every scene.
The fictional campaign progresses through sessions and chosen milestones rather
than penalizing elapsed real-world days.

## Deliverables and acceptance

- [ ] Inquisition ruleset package that installs in Marinara and drives sheets,
  checks and combat.
- [ ] Complete versioned content pack and its importer/setup instructions.
- [ ] All original requested deliverables present and usable in Marinara.
- [ ] An internal full run from character setup and Skyhold introduction through
  the season conclusion, with companion choices and real combat (see stage 6).
- [ ] A content matrix mapping activities, preparation, companions, locations,
  encounters and recovery paths to concrete examples.
- [ ] Representative dialogue checks for voice, continuity, timeline knowledge
  and unearned revelation of secrets.
- [ ] Saved/restarted campaign play preserves choices and progression.
- [ ] Repeated activity logs produce enough scene variety without contradicting
  accepted events or inventing mechanical rewards.
- [ ] Recovery, missed days and changing goals remain welcoming and playable.

Record the content inventory, completed playthroughs, remaining gaps and commit
references in this stage and [progress.md](progress.md). Post the major campaign
milestones to the crew thread before handing off for the complete release pass.
