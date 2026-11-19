# Campaign content

Season one of the Lore fitness RPG: the Inquisition ruleset and the campaign
pack. Everything here is **compact, structured material the Game Master model
expands at play time**, not pre-written story prose. A good entry is a short
paragraph of facts, voice and hooks; the model writes the scenes.

| Path | What it is |
| --- | --- |
| [`ruleset/inquisition.json`](ruleset/inquisition.json) | Marinara Game Mode ruleset (sheet, checks, talents, opponents, items, combat) |
| [`pack/`](pack/) | Campaign source files, one Markdown file per entry |
| `dist/` | Built, importable files (generated; see Building) |

## Rules every entry follows

- **Canon point:** after the Inquisition settles at Skyhold and before the march
  on Adamant. Corypheus is active and undefeated. No Trespasser content.
- **Original words.** Never quote or closely paraphrase game dialogue or codex
  text; this repository is public. Names of canon people and places are fine.
- **The Inquisitor is the player.** Never decide their feelings, choices or race
  in an entry. Race-specific material goes only in `pack/race/`.
- **Secrets stay secret.** Solas's identity, Blackwall's past and Iron Bull's
  Ben-Hassrath reports appear only under `Revelations`, with the condition that
  unlocks them. Knowledge limits say what each character does and does not know.
- **Mechanics are the runtime's.** Never promise XP, levels, stats or items. A
  reward a scene may give is narrative, an item from the ruleset's quartermaster
  catalog, or a war-table outcome. Opponents use ids from the ruleset's
  `opponents` catalog.
- **Fitness framing.** Real activity is training and preparation for the
  Inquisition. Characters may notice it and react; they never nag, guilt,
  scold missed days or demand more. Recovery is honoured as part of soldiering.
- **Length.** Lorebook text 60–250 words. Dialogue examples are 1–2 sentences.

## File format

Each file starts with a header block between `---` lines: one `key: value` per
line; lists are written `[a, b, c]`. The body is Markdown with the `##`
sections listed for that type, in that order. Sections not listed are ignored
by the build.

### `type: companion` (`pack/companions/<id>.md`)

Header: `id`, `type`, `name`, `keys` (words that bring the entry into a scene).

Sections: `Summary` (who they are at this point in the story), `Personality`,
`Voice` (speech patterns, vocabulary, what they never say), `Dialogue examples`
(4–6 original lines as a list), `With the Inquisition` (role, loyalties, what
they want from the Inquisitor), `Training role` (how they show up around
preparation, drills and rest), `Reacting to effort` (accomplishments, setbacks,
recovery days, a long gap and a return: one line each, never guilt),
`Scene hooks` (3–5 one-line seeds), `Knowledge limits`, `Revelations` (each:
condition → what may come out).

### `type: npc`, `type: location`, `type: faction` (`pack/world/<id>.md`)

Header: `id`, `type`, `name`, `keys`. Sections: `Summary`, `Details`
(60–200 words), `Scene hooks` (2–4 lines). Locations add `When to use`
(timeline consistency: what the place is like at this story point).

### `type: mission` (`pack/missions/<id>.md`)

Header: `id`, `type`, `name`, `act` (1–3, or `any` for repeatable operations),
`kind` (`story`, `operation`, `companion`, `recovery`), `location`,
`companions` (ids), `requires` (mission ids or `none`), `keys`.

Sections: `Premise` (2–3 sentences), `Stakes`, `Beats` (3–5 numbered beats, each
a situation, not a script), `Choices` (2–3 real decisions and what each
changes), `Encounters` (encounter ids, or `none`), `Outcomes` (what the world
remembers; narrative and war-table only), `Low-energy version` (how to play it
as talk, planning or a short scene for a recovery or tired day).

### `type: encounter` (`pack/encounters/<id>.md`)

Header: `id`, `type`, `name`, `tier` (`skirmish`, `dangerous`, `boss`),
`opponents` (ruleset opponent ids with counts, e.g. `[shade x3, wraith x1]`),
`location`, `keys`. Sections: `Setup` (terrain and situation), `Twist` (one
complication mid-fight), `Preparation pays off` (how unspent supplies, training,
scouting or a war-table project changes the fight), `Aftermath`.

### `type: project` (`pack/war-table/<id>.md`)

Header: `id`, `type`, `name`, `advisor` (`cullen`, `leliana` or `josephine`),
`cost` (e.g. `supplies 3` or `training 2`), `act`, `keys`. Sections: `Order`
(what the Inquisitor commits to), `Report` (what the advisor reports back, as
facts the Game Master narrates), `Unlocks` (missions or scene hooks it opens).

### `type: race` (`pack/race/<race>.md`)

Header: `id`, `type`, `race`. Sections: `How the world sees them`, `Companion
reactions` (one line per companion id), `Address and titles`, `Backstory hooks`.

### `type: watch` (`pack/watch/<id>.md`)

Header: `id`, `type`, `companion`. Sections: `Raven notes` (short in-character
notification lines, under 90 characters each), `Drill cues`, `Dice flavor`.

## Building

`node content/build.mjs` reads `pack/` and writes `dist/`: lorebooks in
SillyTavern world-info format (which Marinara imports), one race lorebook per
race, the Game Mode setup JSON for `POST /api/game/setup/apply-json`, and a
manifest with the pack version and the ruleset it needs.
