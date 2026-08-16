# Beta v0.9.1 — Architecture Audit

This document records the Stage A architecture baseline for Jasper's Pokédex. It intentionally does not change Pokémon progress, GitHub authentication, or user-facing behavior.

## Stable reference

- User-facing baseline: Beta v0.8.5.
- Stabilization branch: `beta-v0.9.1-architecture`.
- `save.json` is user progress and is not modified by Stage A.

## Current file responsibilities

### `index.html`

The primary user-facing application document. It currently contains the core page structure, base CSS, Pokémon/box data, and core Box/List/Search interaction behavior. It is currently the largest source file and therefore should not be rewritten from partial copies.

### `github-sync.js`

The GitHub synchronization layer. It handles GitHub token/authentication state, loading and saving the remote progress, synchronization status, automatic save behavior, Sync UI support, progress-banner behavior, and some layout construction. Its layout responsibilities are a stabilization concern because synchronization and presentation should eventually be isolated.

### `beta071-base.js`

A compatibility/fix layer from the Beta 0.7.x/0.8.x development history. It currently contains desktop layout behavior, Bulk Mode behavior, version-label behavior, and related styling. It should be treated as transitional code until its responsibilities can be consolidated safely.

### `beta071.js`

A second compatibility/fix layer that builds on `beta071-base.js` and applies additional Beta 0.8.x desktop, Sync Pill, and Dex cleanup behavior. The presence of two Beta-specific layers is a primary architecture risk because initialization and UI ownership can overlap.

### `save.json`

Synchronized user progress. It is data, not application logic. Stage A must not modify it. Future multi-game work must keep game-specific progress isolated rather than using Pokémon names as globally unique save keys.

### `STABILITY.md`

The v0.9 stabilization plan and release discipline document. It is project documentation, not runtime code.

### `ARCHITECTURE.md`

This document. It records the architecture audit, ownership boundaries, risks, and the target direction for the v0.9 stabilization series.

## Current architecture risks

1. `index.html` contains multiple concerns that should eventually be separable: document structure, styling, Pokémon data, and application behavior.
2. `beta071-base.js` and `beta071.js` are layered compatibility files whose responsibilities can overlap.
3. `github-sync.js` currently owns both synchronization behavior and some presentation/layout work, creating coupling between saving and rendering.
4. Multiple initialization paths, observers, and event handlers must be audited before they are consolidated; changing them blindly could recreate the historical desktop freezing/non-clickable behavior.
5. Version labels are not yet represented by a single application-wide source of truth.
6. Box/List/Search and progress calculations need to consume one Pokémon dataset so that mobile and desktop cannot drift into different Pokémon lists.
7. The data model must become game-aware before Alpha Sapphire and Sun are introduced. A Pokémon name alone must never be the global identity of a saved entry.

## Target ownership model

The eventual architecture should conceptually separate these responsibilities:

```text
Application shell
├── UI/layout
│   ├── desktop presentation
│   └── mobile presentation
├── Pokémon/game data
│   ├── White 2
│   ├── Alpha Sapphire
│   └── Sun
├── user progress
│   └── save.json
└── GitHub synchronization
    ├── authentication
    ├── load
    ├── save
    └── Bulk Mode
```

The exact file structure will be decided after the source audit rather than forcing a premature rewrite.

## Multi-game data requirement

Game-specific data must be independently addressable. The same Pokémon name appearing in multiple games is expected and must not be treated as a duplicate error.

Conceptually:

```text
Game
└── Dex / storage definition
    └── Pokémon entry
        └── boxable forms
```

A canonical Pokémon identity may be shared for reference, but progress and boxable forms must be scoped to the game. This also prevents non-boxable forms from being accidentally rendered as additional entries.

## Stage A completion criteria

Before Stage B begins, the following must be understood and documented:

- Which file owns each major runtime responsibility.
- Which initialization paths run at page load.
- Which observers and event listeners are installed and where.
- Which code owns desktop versus mobile behavior.
- Which code owns Pokémon data and how Box/List/Search consume it.
- Which code owns GitHub synchronization and how it interacts with local state.
- Where version labels are defined.
- Which legacy compatibility code can eventually be consolidated without changing behavior.

Stage B should not begin by adding Alpha Sapphire/Sun data blindly. It should use the architecture established here to define a game-scoped data model first.
