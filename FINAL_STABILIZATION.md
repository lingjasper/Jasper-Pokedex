# Beta v0.9.4 — Final Stabilization

## Purpose

Beta v0.9.4 is the final stabilization stage of the Beta v0.9 series. It is intended to verify the architecture and data foundations before normal feature development resumes.

## Release requirements

- Preserve Beta v0.8.5 as the behavioral/reference baseline.
- Keep user progress in `save.json` intact; do not migrate or rewrite it without a validated migration plan.
- Keep Pokémon data separate from user progress.
- Keep game identity separate from Pokémon name so the same Pokémon can exist independently in White 2, Alpha Sapphire, and Sun.
- Keep forms game-specific and expose only boxable forms as storage entries.
- Ensure Box View and List View consume the same intended game dataset and do not maintain separate Pokémon lists.
- Keep desktop-specific presentation independent from the mobile presentation while sharing the same underlying data/state.
- Keep GitHub synchronization state separate from layout/rendering responsibilities.
- Do not silently overwrite local progress when a remote load, write conflict, or authentication error occurs.

## Outstanding user-facing fixes to validate

1. Increase the gap between Pokémon name and checkmark to 4px.
2. Resolve the Mobile/Desktop Pokémon-name disparity so both views use the same intended entries, including correct handling of non-boxable forms and preventing duplicate Genesect/form entries.
3. Dark Mode remains intentionally deferred until after the v0.9 stabilization pass.

## Refresh / loading investigation

The brief appearance of an older version during refresh should be treated as a loading/cache investigation rather than assumed to be a data problem. Verify normal refresh, hard refresh, and a fresh browser/device before introducing cache-busting changes.

## Regression checklist

- [ ] Desktop loads without freezing.
- [ ] Mobile loads without freezing.
- [ ] Box View works.
- [ ] List View works.
- [ ] Search and partial search work.
- [ ] Jump-to behavior works.
- [ ] Pokémon progress can be changed normally.
- [ ] Bulk Mode does not automatically commit.
- [ ] Bulk Mode Cancel discards pending changes.
- [ ] Bulk Mode Commit saves pending changes.
- [ ] Sync failure does not discard local changes.
- [ ] Existing save data remains readable.
- [ ] White 2 data remains independent of future games.
- [ ] Box View and List View contain matching intended Pokémon entries.
- [ ] No known non-boxable forms appear as storage entries.
- [ ] No duplicate form entries appear because of separate rendering paths.
- [ ] Version display is consistent across the application.

## Completion rule

Beta v0.9.4 should be considered complete only after the implementation has been tested against this checklist. Beta v0.9.5 can then return to controlled backlog/features work.