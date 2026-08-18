# Beta v0.13 — Mobile Foundation

This document defines the architectural contract for the Mobile Overhaul. It is intentionally a foundation checkpoint: it does not redesign the mobile UI and does not introduce a second data model.

## Core rule

**One source of truth, multiple presentations.**

Mobile should consume the established application data, state, and business logic. Desktop and Mobile may have different layouts and interaction patterns, but they should not independently redefine Pokémon data, forms, box membership, completion state, search rules, save state, or synchronization behavior.

## Ownership baseline

| System | Authoritative owner | Mobile responsibility |
|---|---|---|
| Pokémon/game data | `pokedex-engine.js` / existing data files | Consume the same dataset |
| Forms / boxable forms | Established Pokémon data model | Consume the same definitions |
| Box membership / dimensions | `pokedex-engine.js` | Adapt presentation only |
| Completion / progress | Established local progress state | Read/write the same state |
| Box + List rendering data | `pokedex-engine.js` | Use the same rendered records |
| Search | Established engine search | Use the same search dataset/rules |
| Save persistence | Existing local persistence | Do not create a mobile save store |
| GitHub Sync | `github-sync.js` | Use the same sync contract |
| Bulk Mode state/operations | `beta071-base.js` pending deeper extraction | Mobile UI must use the same underlying state |
| Release moniker | `version.js` | Display the shared moniker |
| Theme tokens | `theme.css` | Use shared tokens; mobile remains light unless separately scoped |

## Mobile may own

Mobile-specific implementation is appropriate for:

- navigation and tabs
- responsive layout
- touch targets and touch interactions
- mobile control placement
- mobile menus and action bars
- mobile-specific spacing and information density
- mobile presentation of shared state

## Mobile must not independently own

The overhaul should not introduce separate mobile versions of:

- Pokémon/form records
- box allocation rules
- completion calculations
- save schema
- synchronization schema
- search/filter business rules
- game identity

If a mobile-specific adapter is required, it should transform shared state for presentation rather than redefine the underlying state.

## Migration rule

For each legacy mobile implementation, classify it before changing it:

- **KEEP** — already aligned with the shared foundation.
- **SHARE** — replace a duplicate source with the established owner.
- **ADAPT** — retain the underlying logic but change the mobile presentation/interaction.
- **REPLACE** — legacy mobile implementation conflicts with the established foundation.
- **REMOVE** — obsolete code with no required consumer.

No legacy mobile code should be removed solely because it is old; its consumers must be traced first.

## Scope of this checkpoint

This foundation commit establishes the v0.13 ownership contract and updates the single release moniker source to **Beta v0.13**. It does not modify Pokémon data, user progress, Sync behavior, Desktop presentation, or the Mobile UI.
