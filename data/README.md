# Game-Scoped Pokédex Data

This directory defines the data model introduced during **Beta v0.9.2 — Multi-Game Data Architecture**.

## Core rule

A Pokémon name is **not** a globally unique save key.

The same Pokémon is expected to exist in multiple games. For example, Genesect in Pokémon White 2 and Genesect in Pokémon Alpha Sapphire are separate game entries and must have separate progress states.

The intended hierarchy is:

```text
Game
└── Dex / storage definition
    └── Pokémon entry
        └── Boxable forms
```

## Game identity

Every game has a stable machine-readable `id`:

- `pokemon-white-2`
- `pokemon-alpha-sapphire`
- `pokemon-sun`

The human-readable name is presentation data and must not be used as the primary identity.

## Pokémon identity

A canonical Pokémon identity may be shared between games for reference, but a game-specific entry must contain the information that can differ by game, including:

- regional Dex number
- storage/box placement
- whether the entry is boxable
- which forms are boxable
- display name/form label
- game-specific progress

## Forms

Forms are also game-scoped. A form existing in the Pokémon species data does **not** automatically mean that form should appear as a boxable entry in every game.

This prevents non-boxable forms from becoming accidental duplicate entries.

## Progress

User progress must be keyed by a game-scoped entry rather than by Pokémon name alone. Conceptually:

```text
pokemon-white-2 → entry-id → completed
pokemon-alpha-sapphire → entry-id → completed
pokemon-sun → entry-id → completed
```

The existing `save.json` is intentionally **not migrated in Beta v0.9.2 yet**. A save migration should only happen after the new entry identifiers and the full White 2 dataset have been audited against the current working application.

## Current game registry

`games.json` is the registry for the three planned game pages. White 2 is enabled; Alpha Sapphire and Sun are registered but disabled until their data is introduced in a later release.

## Migration rule

Do not add Alpha Sapphire or Sun data by copying the White 2 Pokémon list and changing names. Each game must have its own dataset and storage definition, even when Pokémon overlap.
