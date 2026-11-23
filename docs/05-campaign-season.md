# Stage 5 — Inquisition ruleset and complete campaign

Status: In progress. Owner: Claude Code session `s/a60d803335a9aa0a` (started
2026-11-18). Updated: 2026-11-18.

Current state (2026-11-18): the Inquisition ruleset
([`content/ruleset/inquisition.json`](../content/ruleset/inquisition.json)) and
a complete first-draft season pack of 93 entries
([`content/`](../content/README.md)) are written, linted, built and installed
into scratch Marinara. Content is compact structured material the Game Master
expands at play time, not pre-written story prose. This session wrote the
ruleset, format, build/install tooling, season spine and one exemplar per entry
type; five subagents (four Sonnet, one Haiku) drafted the bulk entries from those
templates and the id inventory in [`content/pack-plan.md`](../content/pack-plan.md),
and this session reviewed them. Next: internal playthroughs (stage 6 harness)
to tune numbers and tone, and the content matrix.

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

- [x] Classes (Warrior, Rogue, Mage) and specializations, with a sheet layout,
  attributes, skills, resources (including a focus-style resource) and level table.
- [x] Declare the number fields the stage 3 fitness module writes on the
  player's card (`build.fields`): `level`, `xp`, `supplies`, `training` and
  `rerolls`. The module writes these ids from the ledger on every sync; the
  ruleset decides how they display and what they unlock. Contract recorded
  2026-11-18 in [stage 3](03-marinara-integration.md#recorded-defaults-2026-11-18).
- [x] Abilities and talents that training progression unlocks.
- [x] Items, equipment slots, crafting materials and war-table resources.
- [x] Enemies and encounter stat blocks: Venatori, Red Templars, demons and
  Corypheus's forces.
- [x] Ruleset-resolved combat, with preparation resources mapped to concrete
  combat benefits.
- [x] A difficulty ladder and dice notation used by checks and reward rolls.

Describe the mechanics actually supplied; this is a Dragon Age-themed ruleset,
not an implementation of an official tabletop system.

## Ruleset version 1 (2026-11-18)

| Item | Default |
| --- | --- |
| Checks | d20 + attribute (+2 trained, +4 expert) against Routine 8, Hard 12, Daunting 16, Legendary 20; natural 1 and 20 count; advantage allowed |
| Attributes | DA:I's six: Strength, Dexterity, Magic, Cunning, Willpower, Constitution (−1 to 6) |
| Skills and saves | Ten skills (Arcana is −2 untrained) and three saves: Fortitude, Reflex, Resolve |
| Identity fields | Class (warrior, rogue, mage), specialization (nine canon specializations, chosen later), race, pronouns, background |
| Fitness fields | `level`, `xp`, `supplies`, `training`, `rerolls`, written by the stage 3 module |
| What fitness buys in play | Level: Seasoned (+1 at 4, +2 at 8, +3 at 12, +4 at 16) on every ability check, attack, save and initiative roll (through the check `adjust` only, from version 2), +5 health per level, focus 1/2/3 at levels 1/6/12. Unspent training: Drilled +1 at 4, +2 at 8 on attacks. Unspent supplies: +4/+8/+12 health at 5/10/15. Spending at the war table therefore trades a little fight readiness for progress elsewhere |
| Talents | 12 talents, four per class across canon trees, unlocking at levels 1, 3 and 6; descriptions are original. From version 2 each has fight mechanics, and the stage 3 module adds them to the sheet as the level is reached |
| Opponents | Shade, wraith, despair demon, rage demon, Venatori gladiator, spellbinder and magister, Red Templar, horror and behemoth, in skirmish/dangerous/boss tiers |
| Items | A Skyhold quartermaster list of weapons, armor, potions and crafting materials. Workshop recipes (2026-11-22) are pack files in `content/pack/crafting/`, used by the stage 3 Training panel |
| Rests | Rest at an Inquisition camp (full restore, clears conditions) and Catch your breath (stamina) |
| Known rough edge | NPC cards get the same sheet (Level 1, Race Human by default); harmless, tidy later |

## Content pack (2026-11-18)

Format, rules and tooling: [`content/README.md`](../content/README.md);
inventory: [`content/pack-plan.md`](../content/pack-plan.md).

| Type | Count | Notes |
| --- | --- | --- |
| Season spine | 1 | Three acts, Before Adamant; original antagonists Aurelian Tharsis and Ilse Varn, quartermaster Hadley Brisk |
| Companions | 8 | Summary, personality, voice, original dialogue examples, training role, reactions to effort (never guilt), hooks, knowledge limits, gated revelations |
| World | 20 | 6 NPCs, 10 locations (two original), 4 factions |
| Missions | 25 | 7 act one, 8 act two, 6 act three, 2 repeatable operations, 2 recovery; each with real choices and a low-energy version |
| Encounters | 13 | Opponents from the ruleset; each names how preparation pays off |
| War-table projects | 14 | Costs in supplies or training, spent through the Training panel |
| Race variants | 4 | Human, elf, dwarf, Qunari (Vashoth); one constant lorebook each |
| Watch text | 8 | Raven notes, drill cues and dice flavor per companion |

`content/build.mjs` lints every entry (sections, word counts, ids, opponent
ids, cross-references, XP/level promises) and builds a SillyTavern-format season
lorebook (81 entries), four race lorebooks and the Game Mode setup JSON.
`content/install.mjs` imports the ruleset and lorebooks, creates the persona and
game with the ruleset pinned, sets class and race, and turns on the fitness
module; `--set-race` swaps the race lorebook and the card's race field only.

Review of the drafted entries: secrets checked (Solas's identity absent;
Blackwall's only in his gated Revelation; Iron Bull's reporting open as in
canon), two mechanical promises removed ("supply gain" outcomes), Sera's lines
given her contractions, and the magister opponent renamed `venatori-magister` so
the finale fights Tharsis himself.

## First play test (2026-11-18)

`content/install.mjs` installed the pack into scratch Marinara (elf mage
"Evelyn Trevelyan", fitness module on, ledger seeded from the `steady` persona)
and [`harness/checks/campaign-play.mjs`](../harness/checks/campaign-play.mjs)
played the opening and three turns with Gemma 4 26B on den-nimo:

- Opening: a Skyhold courtyard scene with Cassandra and Cullen in voice,
  setting up the tampered ledger and scout reports, ending in four choices.
- The ledger: Hadley Brisk walked through the mission's beats (neat, plausible,
  wrong entries; grain, iron and herbs vanishing).
- Sera on the tavern roof: her "little people" network, lights on old mule
  trails and a "tingly" smell (red lyrium, unnamed) — lorebook-driven and
  spoiler-safe.
- A logged rest day: a quiet garden afternoon; Solas arrived and called rest
  "a necessary discipline". No guilt, no nagging.
- Slips: one "weirwood" (another franchise) in narration; Brisk was gendered
  "he", which is fine but unplanned.
- Speed: 130–175 s per turn with a 10.6k-token prompt; generation ran at
  5.7 tokens/s against ~70 two days earlier, because den-nimo was busy with
  Patch's background work. Lemonade reused no prompt cache between turns
  (`cache_tokens` 0); worth investigating in stage 6 for latency.

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

Version 2 (2026-11-23) adds fight mechanics to every talent, `talent_power`,
`talent_attack` and `talent_dc`, a Hidden condition (advantage on the next
attack), a drinkable healing potion (2d8 + 4, used up), and removes the
duplicate Seasoned fight bonus. Details and the class builds and starting kits
are in [stage 3](03-marinara-integration.md#fights-2026-11-23).

## Original deliverables to retain

- [ ] Importable playable character card and RPG framework.
- [ ] Fitness-to-progression rules that match the implemented mechanics.
- [ ] Supported dice notation, thresholds and reward behavior.
- [x] Combat configuration using the ruleset and actual Marinara functionality.
  The installer turns on ruleset fights; see
  [stage 3 Fights](03-marinara-integration.md#fights-2026-11-23).
- [x] Detailed lorebook entries for Sera, Cullen Rutherford, Dorian Pavus,
  the Iron Bull and Blackwall.
- [ ] An immersive opening at Skyhold that establishes Lore's character and
  the approaching conflict with Corypheus.

## Full-season work

- [ ] Separate authored canon, campaign choices, played-event memory and mechanics.
- [x] Make Inquisitor race a single campaign variable. Key race-specific
  content to it: companion reactions (for example Sera and Solas with an elven
  Inquisitor, Iron Bull with a Vashoth one, Cassandra and Leliana on a human
  noble), NPC address and prejudice, backstory hooks, and any ruleset traits.
  Changing the race swaps those entries and the character build's race line;
  it never alters activity, grants or past session summaries.
- [x] Author all eight requested companions: Solas, Cassandra, Leliana, Cullen,
  Dorian, Sera, Iron Bull and Blackwall.
- [ ] Build Skyhold as a returning hub with training, companion scenes,
  preparation/crafting and war-table decisions.
- [ ] Author three complete acts with meaningful choices and a first-season
  conclusion; account for branches without requiring an endless generated plot.
- [x] Provide approximately 20–30 authored mission/scene templates and 10–15
  encounter templates, with deliberate variation and repeatable operations.
- [x] Provide recovery-day, low-activity, missed-day and returning-after-a-break
  content that remains enjoyable and useful.
- [x] Write in-character text for watch features: raven notifications, drill
  cues and dice-roll flavor per companion.
- [ ] Build the content manifest/import/export path and preserve an independently
  importable character card alongside the complete campaign pack.
- [ ] Connect presentation assets/theme and optional voice choices through the
  supported host tools; record where assets came from and how to regenerate them.

## Lore delivery: triggers and wiki (2026-11-19)

Direction (Patch, 2026-11-19): an explorable wiki is the stronger tool once an
agent loop writes the turn, especially for the wider Dragon Age setting, where
details matter when the story turns toward a place rather than whenever a name
appears. Triggers stay the floor for plain single-call Game Mode, so a game is
always playable without the team.

- **One source, two forms.** `content/pack` builds both the trigger lorebooks
  and, through Marinara's team turn, the DSH wiki (one page per entry, an
  always-loaded index of one-line summaries, links).
- **Built now.** Each lorebook entry is titled `Name (type)`, carries a
  one-line summary as its description (Marinara never injects descriptions;
  the wiki index uses them) and ends with `See also:` naming up to 12 related
  entries: header links first (mission location, companions, prerequisites,
  encounters, project advisor, in both directions), then name mentions.
- **Deterministic floor.** Committed facts (fitness results, dice, spends),
  story state and secrets never depend on a lookup. They arrive as turn notes
  or constant entries.
- **Next, in order.** Visibility markers so Revelations and other secrets are
  Game Master-only pages, unlocked by story state, with the reviewer checking
  knowledge limits; wiki-only pages for the wider setting (regions, factions,
  history at the canon point), never built as triggers; measuring under- and
  over-lookup per model from the team log's reads and questions.

Reinstalling into an instance that already has the season lorebook reuses it,
so a pack change needs that lorebook deleted first (stage 6 installs once).

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
