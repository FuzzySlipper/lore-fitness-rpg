# Stage 6 — Stabilization, deployment and first playtest release

Status: Planned. Owner: Unassigned. Updated: 2026-11-15.

[Outline](implementation.md) · [Progress](progress.md) ·
[Previous: campaign season](05-campaign-season.md)

## Outcome and dependencies

Deliver the integrated first season and native companions as a reasonably stable,
maintainable installation on den-lore. All stages 1–5 must have their promised
features integrated before calling this Lore's first complete playtest release.

Testing is matched to the real claims: retained activity, consistent rewards,
working combat/campaign flow, usable devices and recoverable updates. Avoid
adding unrelated enterprise or hostile-user exercises to this household project.

## Windows deployment work

- [ ] Document the actual service install, build, start, stop and update commands.
- [ ] Deploy the fitness service on den-lore alongside custom Marinara and DSH.
- [ ] Use the selected separate data directory, with backups outside the source
  checkout and a documented restoration procedure.
- [ ] Configure the agreed Windows startup mechanism and normal restart recovery.
- [ ] Document ports, local configuration and how phone/watch clients find the
  service, without putting credentials or signing material in Git.
- [ ] Verify startup order and reconnect when Marinara or DSH starts later.
- [ ] Record compatible revisions of this project, Marinara, DSH, content packs
  and native apps.
- [ ] Provide readable diagnostics for queued data, import failures, pending
  rolls, campaign projection and narrative fallback.

The checkout is `C:\Dev\lore-fitness-rpg`; the proposed runtime data root is
`C:\Dev\Lore-Fitness-RPG-Data`. Replace proposals with the observed final setup
in the release runbook. Keep existing Marinara/DSH customizations intact.

## Integrated acceptance scenarios

Run a representative seven-day engineering soak with recorded results. Include:

- [ ] Normal activity import, manual check-ins and app-recorded workouts.
- [ ] Duplicated delivery, delayed import and overlapping step/workout sources.
- [ ] A corrected/backdated activity and a visible, sensible reward adjustment.
- [ ] Phone/watch restart, lost connection and a week of queued activity.
- [ ] den-lore/service restart and temporary Marinara/DSH unavailability.
- [ ] Loss of acknowledgment after a resolved dice roll or applied grant.
- [ ] Chat regeneration, swipes, checkpoint restore and campaign branching.
- [ ] A complete activity → reward → preparation → combat → saved result loop.
- [ ] A full first-season playthrough including important companion choices.
- [ ] Recovery days, several missed days and resuming after a break.
- [ ] Backup restoration with consistent activity and campaign state.
- [ ] A real update/migration with existing saves, pairing and pending entries.

For each scenario record the build/commit, environment, steps, expected result,
actual result and remaining gap. Use small reusable synthetic repros for defects.
Do not claim a soak or physical-device test based on accelerated fixtures alone.

## Device quality

- [ ] Measure release-build battery cost against a comparable baseline.
- [ ] Record expected/observed sync and interaction latency; distinguish scheduled
  background imports from immediate user actions.
- [ ] Check readable phone/watch UI, tap targets, folded/unfolded phone behavior,
  ambient watch presentation, notifications and quiet hours.
- [ ] Confirm permission changes and unavailable optional sensors leave a useful
  manual path with clear status.

Set battery/latency acceptance targets from observed devices and record the
chosen targets. Do not invent measurements or claim all OHealth metrics exist.

## Packaging and distribution

- [ ] Produce reproducible phone/watch release artifacts and engineering-install
  instructions, with versioning that permits in-place updates.
- [ ] Keep package identity and signing compatible between paired modules.
- [ ] Select the distribution route; the current recommendation is direct APKs
  for engineering and Play Console internal testing for convenient private updates.
- [ ] If using Play, complete the actual account/health-data/platform setup and
  verify the current requirements in the [official references](references.md).
- [ ] Document what is in the public companion versus the separately loaded
  campaign pack before any wider store publication.
- [ ] Write release notes with known limitations and rollback/recovery steps.

This plan does not record a Play enrollment or purchase as completed. Public
production publication is a later decision with separate platform requirements.

## Release completion

- [ ] Stage statuses and evidence links accurately reflect the delivered features.
- [ ] No unresolved defect loses accepted activity, duplicates grants, rerolls a
  saved reward or breaks the primary campaign flow.
- [ ] Remaining limitations are explicit and have useful handling where possible.
- [ ] Another agent can find the runtime, diagnose a failed sync, update the
  installation and restore data using repository Markdown.
- [ ] Post the release location, compatible revisions, validation summary and
  known limitations to crew thread `den-01M6WSZV8VFGDJPDSXTE1QS7YF`.

Update [progress.md](progress.md) with the finished release and the next work.
Future feedback and fixes continue in repository Markdown with major updates
on that crew thread, not a new Den task backlog.
