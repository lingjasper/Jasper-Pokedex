# Icon System

This document is the semantic contract for the icon assets used by Jasper's Pokedex.

## Source of truth

- `Icons/` is the canonical source for icon artwork.
- UI code must not duplicate SVG path data for icons that exist in `Icons/`.
- UI code should request icons by semantic purpose/state through the shared icon layer rather than scattering asset filenames throughout components.
- This document records the relationship between each canonical icon asset and its intended UI purpose.

## State rules

### Box/List view toggle

- `box-fill.svg` — Box View selected.
- `box-outline.svg` — Box View unselected.
- `list-fill.svg` — List View selected.
- `list-outline.svg` — List View unselected.
- Selected/unselected is a UI view state, not Pokémon data.

### Pokémon completion

- `empty-circle.svg` — Pokémon unchecked/incomplete.
- `check-fill.svg` — Pokémon checked/complete.
- Unchecked Pokémon must use `empty-circle.svg`; do not recreate it with CSS, pseudo-elements, Unicode, or another SVG.
- `check-outline.svg` is not the default unchecked Pokémon indicator.

### Search and clear

- `search.svg` — Search affordance.
- `clear-outline.svg` — Default clear action.
- `clear-fill.svg` — Emphasized/active clear presentation.

### Theme

- `moon-fill.svg` / `moon-outline.svg` — Theme control in Light presentation; action is to switch to Dark Mode.
- `sun-fill.svg` / `sun-outline.svg` — Theme control in Dark presentation; action is to switch to Light Mode.
- Fill/outline represents interaction emphasis; it does not redefine the theme meaning.

### Sync

- `sync-inprogress-outline.svg` / `sync-inprogress-fill.svg` — Synchronization in progress. The icon must not spin.
- `sync-warn-outline.svg` / `sync-warn-fill.svg` — Synchronization warning/error.
- `sync-token-needed.svg` — Synchronization requires authentication/token input.
- `check-fill.svg` — Successful sync confirmation when a check is appropriate.
- Sync In Progress has an intentional `30 × 28` canvas and must not be distorted into a square.

### Bulk

- `bulk-mode-outline.svg` / `bulk-mode-fill.svg` — Global Bulk Mode control/pill.
- `bulk-pending-outline.svg` / `bulk-pending-fill.svg` — Per-Pokémon pending bulk-operation state.
- Bulk Mode and Bulk Pending are not interchangeable.

### Information

- `info-outline.svg` / `info-fill.svg` — Informational/status presentation. These are semantic information indicators, not Box/List selection equivalents.

## Theme and color

Monochrome black artwork is normalized to `currentColor`. Do not reintroduce hard-coded black fills into canonical monochrome assets. Intentional artwork colors must remain explicit.

## Rendering contract

The shared icon layer resolves a semantic request to the canonical file in `Icons/`. UI components own control meaning, state, size, placement, and accessible labels.

The icon layer must:

1. Resolve semantic icon requests to canonical files.
2. Preserve intrinsic aspect ratios.
3. Avoid clipping intentional artwork bounds.
4. Allow `currentColor` to inherit from the surrounding UI.
5. Fail safely when an unknown icon key is requested.

Desktop and Mobile consume the same semantic mapping. They may use different sizes, spacing, and placement, but never separate artwork or semantic mappings.

## Maintenance rules

When adding or changing an icon:

1. Add/update the canonical SVG in `Icons/`.
2. Add/update its semantic mapping in the shared icon layer.
3. Update this document with the UI purpose/state relationship.
4. Remove duplicated inline SVG/CSS/Unicode implementations of the same icon meaning.
5. Verify Light, Desktop Dark, and Mobile presentation as applicable.
6. Verify that legacy compatibility layers do not recreate or override the icon.

## Invariant

```text
Semantic UI state
        ↓
Shared icon mapping
        ↓
Icons/*.svg
        ↓
Theme / layout presentation
```

There should be one canonical artwork source and one semantic mapping layer.
