# Season one content inventory

The authoritative list of entries, ids and links. Writers create exactly these
files, following [README.md](README.md) and the exemplars
(`pack/companions/cullen.md`, `pack/missions/a1-tampered-ledger.md`,
`pack/encounters/a1-lower-gate-ambush.md`, `pack/war-table/drill-the-garrison.md`,
`pack/world/skyhold.md`, `pack/race/elf.md`, `pack/watch/cullen.md`) and the
spine in `pack/season-one.md`. ✓ marks entries already written.

## Companions (`pack/companions/`)

✓ cullen · solas · cassandra · leliana · dorian · sera · iron-bull · blackwall

Leliana and Cullen are war-table advisors who also join scenes. Iron Bull leads
Bull's Chargers. Blackwall presents as a Grey Warden; his past is a Revelation.
Solas is an apostate elf and Fade expert; his true identity is never revealed
in season one (Revelations may only hint at unusual knowledge).

## World (`pack/world/`)

- npc: josephine (Josephine Montilyet), varric (Varric Tethras), corypheus, aurelian-tharsis (Magister Aurelian Tharsis), ilse-varn (Knight-Captain Ilse Varn), hadley-brisk (Quartermaster Hadley Brisk)
- location: ✓ skyhold, hinterlands, storm-coast, frostback-passes, fallow-mire, exalted-plains, emerald-graves, western-approach, redcrag-quarry (Varn's red lyrium quarry-fortress, original), tharsis-watchtower (ruined Tevinter watchtower in the Western Approach, original)
- faction: venatori, red-templars, grey-wardens, bulls-chargers

## Missions (`pack/missions/`)

| id | name | act | kind | location | companions | requires | encounters |
| --- | --- | --- | --- | --- | --- | --- | --- |
| ✓ a1-tampered-ledger | The Tampered Ledger | 1 | story | skyhold | cullen, leliana | none | a1-lower-gate-ambush |
| a1-frostback-pass | Smugglers in the Pass | 1 | story | frostback-passes | cassandra, solas | a1-tampered-ledger | a1-frostback-smugglers |
| a1-hinterlands-refugees | Bread for the Crossroads | 1 | operation | hinterlands | blackwall, cassandra | none | a1-hinterlands-rift |
| a1-storm-coast-chargers | The Chargers' Price | 1 | companion | storm-coast | iron-bull | none | a1-storm-coast-cove |
| a1-friends-of-red-jenny | A Note Under the Door | 1 | companion | skyhold | sera | a1-tampered-ledger | none |
| a1-first-drill | First Drill | 1 | recovery | skyhold | cullen, blackwall | none | none |
| a1-courier-network | The Waystation | 1 | story | hinterlands | cassandra, iron-bull, sera | a1-frostback-pass | a1-waystation-raid |
| a2-red-road | The Red Road | 2 | story | exalted-plains | cassandra, dorian | a1-courier-network | a2-red-road-convoy |
| a2-dorian-letters | Letters from Minrathous | 2 | companion | skyhold | dorian | a1-courier-network | none |
| a2-blackwall-recruits | Steel and Straw | 2 | companion | hinterlands | blackwall | a1-courier-network | none |
| a2-missing-scouts | Lost in the Mire | 2 | operation | fallow-mire | iron-bull, solas | a1-courier-network | a2-mire-despair |
| a2-old-comrade | The Knight-Captain | 2 | companion | skyhold | cullen | a2-red-road | none |
| a2-graves-supply | Timber and Trust | 2 | operation | emerald-graves | sera, solas | a2-red-road | none |
| a2-solas-rift | Echoes at the Rift | 2 | companion | exalted-plains | solas | a2-red-road | op-rift |
| a2-quarry-siege | Redcrag | 2 | story | redcrag-quarry | cullen, cassandra, iron-bull | a2-red-road | a2-quarry-gates, a2-quarry-heart |
| a3-staging-camps | Fire in the Camps | 3 | story | western-approach | blackwall, dorian | a2-quarry-siege | a3-camp-raid |
| a3-turned-agent | One of Ours | 3 | companion | skyhold | leliana | a2-quarry-siege | none |
| a3-seeker-archive | What the Seekers Kept | 3 | companion | western-approach | cassandra | a2-quarry-siege | none |
| a3-merchant-princes | A Table Set for Allies | 3 | story | skyhold | dorian, sera | a2-quarry-siege | none |
| a3-watchtower-assault | The Watchtower | 3 | story | tharsis-watchtower | cassandra, iron-bull, dorian | a3-staging-camps | a3-watchtower-gate, a3-tharsis |
| a3-banners-raised | Banners Raised | 3 | recovery | skyhold | solas, cassandra, leliana, cullen, dorian, sera, iron-bull, blackwall | a3-watchtower-assault | none |
| op-rift-closing | Close the Rift | any | operation | hinterlands | solas | none | op-rift |
| op-supply-run | Supply Run | any | operation | frostback-passes | blackwall | none | none |
| rec-tavern-night | A Night at the Herald's Rest | any | recovery | skyhold | iron-bull, sera, dorian | none | none |
| rec-garden-hour | An Hour in the Garden | any | recovery | skyhold | solas, cassandra | none | none |

For a3-watchtower-assault, say in the mission that any companions may be
swapped in for the three listed.

## Encounters (`pack/encounters/`)

Opponent ids come from the ruleset catalog: shade, wraith, despair-demon,
rage-demon, venatori-gladiator, venatori-spellbinder, red-templar,
red-templar-horror, red-templar-behemoth, venatori-magister (used for Tharsis).

| id | tier | opponents |
| --- | --- | --- |
| ✓ a1-lower-gate-ambush | skirmish | venatori-gladiator x2, venatori-spellbinder x1 |
| a1-frostback-smugglers | skirmish | venatori-gladiator x2, venatori-spellbinder x1 |
| a1-hinterlands-rift | skirmish | shade x3, wraith x2 |
| a1-storm-coast-cove | skirmish | venatori-gladiator x3 |
| a1-waystation-raid | dangerous | venatori-gladiator x2, venatori-spellbinder x2 |
| a2-red-road-convoy | skirmish | red-templar x3 |
| a2-mire-despair | dangerous | despair-demon x1, shade x2 |
| a2-quarry-gates | dangerous | red-templar x2, red-templar-horror x1 |
| a2-quarry-heart | boss | red-templar-behemoth x1 |
| a3-camp-raid | dangerous | rage-demon x1, shade x3 |
| a3-watchtower-gate | dangerous | venatori-gladiator x2, red-templar-horror x1 |
| a3-tharsis | boss | venatori-magister x1, wraith x2 |
| op-rift | skirmish | shade x2, wraith x1 |

## War-table projects (`pack/war-table/`)

| id | name | advisor | cost | act |
| --- | --- | --- | --- | --- |
| ✓ drill-the-garrison | Drill the Garrison | cullen | training 2 | any |
| audit-the-stores | Audit the Stores | josephine | supplies 2 | 1 |
| scout-frostback-passes | Scout the Passes | leliana | supplies 2 | 1 |
| hinterlands-relief | Relief for the Crossroads | josephine | supplies 3 | 1 |
| fortify-skyhold | Fortify the Walls | cullen | supplies 4 | any |
| storm-coast-patrols | Coast Patrols | cullen | training 2 | 1 |
| tevinter-correspondence | Quiet Correspondence | josephine | supplies 2 | 2 |
| trace-lyrium-wagons | Trace the Wagons | leliana | supplies 3 | 2 |
| mire-search-parties | Search Parties | cullen | training 3 | 2 |
| starve-the-quarry | Starve Redcrag | cullen | supplies 4 | 2 |
| sway-merchant-princes | Sway the Merchants | josephine | supplies 3 | 3 |
| western-approach-camps | Camps in the Approach | cullen | supplies 4 | 3 |
| sweep-the-network | Sweep the Network | leliana | training 2 | 3 |
| feast-for-the-hold | A Feast for the Hold | josephine | supplies 2 | any |

## Race (`pack/race/`)

✓ elf · human · dwarf · qunari

## Watch text (`pack/watch/`)

✓ cullen · solas · cassandra · leliana · dorian · sera · iron-bull · blackwall
