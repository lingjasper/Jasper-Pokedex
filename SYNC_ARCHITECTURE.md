# Beta v0.9.3 — GitHub Sync Architecture

## Purpose

This document defines the synchronization contract for Jasper's Pokedex before the sync implementation is refactored. It is intentionally additive: this stage does not change the existing save format or user progress.

## Source of truth

- `save.json` remains the remote save for the current game until the multi-game save migration is completed.
- `localStorage` remains temporary browser state/cache, not the authoritative cloud save.
- The GitHub blob SHA is tracked locally so an update can target the version that was actually loaded.
- A successful GitHub response is the only event that moves the UI back to `Synced`.

## Required sync states

The Sync Pill should have one authoritative state at a time:

- `not-connected`: red X / not authenticated.
- `synced`: green check / local state matches the last successful remote save.
- `syncing`: blue rotating icon / a remote load or commit is in progress.
- `bulk`: blue rotating icon / Bulk Mode is active and changes are intentionally pending.
- `warning`: yellow warning / a remote operation failed or requires user attention.

The displayed label must derive from this state rather than being independently changed by unrelated UI handlers.

## Normal mode

1. User authenticates with a GitHub token.
2. The application loads the current remote save.
3. The loaded blob SHA is retained.
4. A Pokémon change updates local state immediately.
5. A normal save may be scheduled/debounced so rapid individual interactions do not create a commit for every click.
6. The save operation sends the current local state together with the known blob SHA.
7. On success, the returned blob SHA becomes the new tracked SHA and the Sync Pill becomes `Synced`.
8. On conflict/error, local changes are preserved and the Sync Pill becomes `Warning`; the application must not silently replace the user's local state with an older remote copy.

## Bulk Mode

1. User explicitly enables Bulk Mode from the Sync Pill.
2. The Sync Pill changes to `Bulk Mode` with the blue rotating icon.
3. Pokémon clicks update a pending-change collection only.
4. Pending entries receive the blue visual state instead of being treated as successfully synced.
5. No GitHub write is performed merely because a pending entry was clicked.
6. `Commit Bulk Entries` explicitly commits the pending state.
7. A successful commit clears the pending collection and returns the Pill to `Synced`.
8. `Cancel` clears all pending changes and restores the pre-Bulk state without a GitHub write.
9. Turning Bulk Mode off is equivalent to `Cancel`; it must never implicitly commit.

## Concurrency and race protection

- Only one remote write should be active at a time.
- A second commit request while a write is active must not create another write.
- A stale SHA / HTTP 409 conflict must not overwrite local progress.
- Loading remote state must suppress automatic save callbacks while the loaded state is being installed.
- Token invalidation must clear authentication state but must not erase the user's local progress.
- UI state must not be inferred solely from whether a token exists; a valid token and a successfully synchronized save are different conditions.

## Commit behavior

Normal commits should remain meaningful and limited. Bulk Mode is the explicit mechanism for a user who is making many changes. The synchronization layer should not attempt to infer whether the user is sorting boxes, documenting a new acquisition, or performing an initial bulk entry session.

## Save format compatibility

The existing `save.json` format must remain readable during v0.9.3. No migration is performed here. Multi-game save scoping belongs to v0.9.2's data architecture and will be integrated only after the current save format has been fully audited.

## Refactor rule

The existing `github-sync.js` contains UI injection, layout behavior, Pokémon cleanup, progress-banner updates, authentication, and GitHub persistence in one module. During v0.9.3 implementation, synchronization responsibilities should be isolated from presentation responsibilities. The final sync module should own authentication, load, save, conflict handling, and synchronization state; rendering code should consume that state rather than being embedded in the GitHub persistence layer.

## Regression requirements

Before this stage can be considered complete, verify:

- Existing White 2 progress loads unchanged.
- Existing tokens continue to authenticate.
- Invalid tokens do not erase local progress.
- Normal changes save successfully.
- Bulk Mode never auto-commits.
- Cancel never commits.
- Exiting Bulk Mode behaves exactly like Cancel.
- A failed save leaves local changes intact.
- A successful save updates the last-synced timestamp.
- Repeated clicks cannot cause simultaneous writes.
- The UI remains clickable throughout load and save operations.
