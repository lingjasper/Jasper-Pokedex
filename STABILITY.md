# Beta v0.9 — Stability Pass

Beta v0.9 is a stabilization/rework release. It is intentionally separate from the user-facing Beta v0.8.5 release and does not introduce new visual features.

## Stable baseline

- Beta v0.8.5 remains the current user-facing baseline.
- Existing Pokémon progress data in `save.json` is not modified by this stability pass.
- The GitHub token workflow is not changed during the baseline audit.

## Current application structure

- `index.html` contains the core page markup, Pokémon/box data, base styling, and the core Box/List/Search interaction logic.
- `github-sync.js` contains GitHub authentication, remote save/load, automatic save scheduling, sync status UI, progress-banner support, and desktop/mobile layout construction.
- `beta071.js` is a later compatibility/fix layer that loads `beta071-base.js`, applies the Beta 0.8.x desktop layout/fixes, and provides additional Sync Pill and Dex cleanup behavior.
- `beta071-base.js` contains additional desktop layout, Bulk Mode, version-label, and styling logic.
- `save.json` contains the synchronized Pokémon progress state and is treated as user data rather than application source.

## Stabilization goals

1. Establish a single source of truth for UI/layout initialization so the desktop and mobile layers do not compete with one another.
2. Keep Pokémon/Dex data separate from application behavior where practical.
3. Keep GitHub synchronization isolated from rendering and layout code.
4. Reduce duplicate observers, initialization paths, and repeated event handlers.
5. Preserve the existing mobile experience while stabilizing the desktop implementation.
6. Investigate the brief stale-version flash during page refresh without changing behavior blindly.
7. Keep every stabilization change independently reversible.

## Release discipline

- Make the smallest safe change first.
- Inspect the current GitHub file state before every source edit.
- Do not replace a large source file from an incomplete/truncated copy.
- Do not modify `save.json` as part of application-code stabilization.
- Verify desktop and mobile behavior after each functional stabilization change.
- Keep Beta v0.8.5 available as the rollback baseline until the Beta v0.9 stabilization pass is complete.
