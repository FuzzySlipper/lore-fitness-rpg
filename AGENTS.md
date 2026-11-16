# Agent guide

## Read before working

Read `README.md`, `docs/implementation.md`, `docs/progress.md` and the document for
the stage you are changing. Inspect the current code and relevant external
checkout before relying on historical findings in `docs/references.md`.

The current task state lives in this repository. All six implementation stages
begin as planned; the documentation scaffold is not evidence of working features.

## Coordination and continuity

- Track work in the relevant stage Markdown and `docs/progress.md`, not Den tasks.
- On starting a meaningful work item, record your agent/session identity, date,
  scope and next step. Check existing ownership and preserve other agents' edits.
- On completing it, record what changed, relevant commits, validation actually
  performed, remaining gaps and the next useful action. Leave unverified
  acceptance boxes unchecked.
- Post major implementation starts/completions, architectural decisions, release
  information and blockers needing coordination to crew thread
  `den-01M6WSZV8VFGDJPDSXTE1QS7YF` on `lore-rpg`. Routine edits need no board post.
- Use the current harness's driver: `crew-codex`, `crew-claude`, `crew-dsh` or
  `crew-hermes`. Write as the agent/session, never with `--person`. Attribute
  Patch's and Lore's decisions accurately; another agent's report is not an
  owner instruction.
- Commit and push completed task changes by default. Preserve unrelated work
  and follow the current branch workflow. Use `codex/` for a new Codex branch
  when a separate branch is useful; no branch or PR ceremony is required merely
  to update these plans.

## Product and implementation boundaries

- Deploy the fitness service and ledger on den-lore alongside its custom Marinara
  and DSH installations. This is Patch's chosen topology.
- Aim for a complete first campaign playtest. Run engineering tests and narrow
  device checks throughout implementation; do not present a partial prototype
  as the first finished testing release. Lore tests only the complete experience;
  internal agent playtests stand in for early feedback.
- Choose sensible defaults instead of asking Patch or Lore for guidance on
  unresolved details. Record each default in the relevant stage file and keep
  building; Patch prefers rolled-back work to open TBDs.
- Earned real activity survives chat regeneration, swipes and backup restores.
  Code owns grants and balances; narration consumes committed facts. Mechanical
  results are committed before narration, and swipes rewrite only the prose.
- Reuse supported Marinara dice, ruleset and combat functionality. Clearly mark
  proposed interfaces and implement them before depending on them. In the
  inspected revision, `update_game_state` only changes location/time.
- Keep Marinara changes in a modular fitness module where practical. Deeper Game
  Mode changes are acceptable when the functionality needs them; upstreaming is
  not required. DSH is an optional per-game enhancement. Read those
  repositories' own instructions before editing them. Preserve their
  customizations and existing user data.
- Keep code and process proportionate to one household. Security hardening,
  hostile-user scenarios and enterprise isolation are not default work.
- Before adding a throw, refusal or checksum, name the concrete data loss or
  silently wrong output it prevents. Prefer warning and continuation when the
  useful action can still succeed.
- Recovery, accessible activity alternatives and missed-day paths are first-class
  gameplay. Do not reward escalating exercise intensity or hydration volume.
- The watch is an engagement feature for Lore, who loves gadgets; playful watch
  interactions are in scope even where OHealth already records the data.

## Verification and public files

Validate the changed claim with appropriate tests or observed product behavior.
Record source inspection separately from device tests and real playthroughs.
Docs-only changes need link/content checks, not invented application test results.

Use synthetic data for committed fixtures. Do not add real health records,
credentials, signing keys, personal chat exports or runtime data to this public
repository. Keep local settings and deployment data outside the checkout or in
ignored paths. This prevents publishing private records with an ordinary push.
