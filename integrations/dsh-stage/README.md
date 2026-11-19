# dsh-stage changes for Game Mode

`game-turn.patch` is this project's change to the dsh-stage plugin (the DSH
team behind Marinara's agent-team turn). It adds a `mode: "game"` turn with
per-turn `turnNotes` and a `committed` review note kind. Turns without those
fields behave exactly as before.

The plugin's source lives unversioned on den-agents in
`~/dev/experiments/roleplay/dsh-stage`, where the patch is already applied; this
copy keeps the change reviewable and reapplicable. Apply it from that folder
with `patch -p1 < game-turn.patch`, then build:

```bash
. scripts/env.sh && node node_modules/tsdown/dist/run.mjs --config tsdown.config.ts --tsconfig tsconfig.json
```

`harness/scripts/serve-dsh-stage.sh` runs the built plugin on the DSH release
that den-lore has. Deploying to den-lore's `C:\Dev\Marinara-DSH` belongs to
stage 6; see [stage 3](../../docs/03-marinara-integration.md#dsh-team-in-game-mode-2026-11-19).
