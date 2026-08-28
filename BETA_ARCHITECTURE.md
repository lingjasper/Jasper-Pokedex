# Jasper's Pokédex — Beta Architecture Notes

## Purpose

This document records architectural lessons and constraints identified during the Beta development cycle. It does not affect the website itself and is not tied to a Beta release number.

## Mobile Viewport Ownership — Critical Rule

**The browser/document owns the Mobile viewport and vertical scrolling.**

Mobile presentation JavaScript must not recreate or calculate a replacement viewport.

### Do not reintroduce

Mobile code should not introduce a viewport architecture based on:

- `html, body { overflow: hidden }` for Mobile scrolling
- a fixed `.main-content` used as a replacement viewport
- JavaScript-calculated `100vh` / `100dvh` content heights
- JavaScript-calculated `top` / `bottom` boundaries for the Mobile content viewport
- artificial bottom offsets intended to compensate for iOS Safari viewport behavior

These patterns were responsible for a Mobile iOS bottom-region / viewport issue encountered during Beta. The issue was resolved in **Beta v0.13.5.2 — Mobile Viewport Ownership Correction** by returning viewport ownership to the browser/document.

### What is allowed

The following remain valid Mobile patterns when appropriate:

- Normal document flow
- A controlled content scroll region when required by the UI architecture
- `position: sticky` for elements such as the Mobile header
- Local horizontal scrolling, such as the individual 6×5 Pokémon Box viewport
- Local overflow containers that serve a specific component rather than replacing the page viewport

`position: fixed` is not universally prohibited, but it should not be used to construct a second Mobile application viewport without a documented architectural reason and iOS regression testing.

## Why This Rule Exists

The previous Mobile implementation combined root overflow locking, a fixed `.main-content`, JavaScript-calculated viewport dimensions, and viewport-unit sizing. On iOS Safari, this produced a visible bottom region after JavaScript initialized.

A particularly useful diagnostic was the refresh behavior:

1. The page initially rendered at full screen.
2. Mobile JavaScript initialized.
3. The Mobile viewport architecture was applied.
4. A bottom background region appeared.

Disabling JavaScript prevented the issue, confirming that the Mobile initialization layer was responsible for triggering the problematic layout architecture.

The lesson is broader than an iOS-specific CSS workaround:

> **Do not solve Mobile layout problems by taking ownership of the physical browser viewport unless there is a compelling architectural reason to do so.**

Prefer structural CSS layout and normal browser viewport behavior over JavaScript-driven viewport calculations.

## Mobile Regression Requirements

Any future release that changes Mobile layout, scrolling, headers, navigation, themes, search, Boxes, or Mobile initialization should verify the following before committing.

### Viewport

- [ ] iOS refresh remains full-screen after JavaScript initializes.
- [ ] No bottom background region appears.
- [ ] No full-screen → constrained-screen transition occurs after Mobile initialization.
- [ ] Safari browser UI appearing/disappearing does not create a layout gap.
- [ ] Mobile code does not recreate the browser viewport with JavaScript-calculated dimensions.
- [ ] Mobile code does not lock `html`/`body` scrolling without an explicitly documented reason.

### Scrolling

- [ ] Vertical scrolling behaves normally.
- [ ] The Mobile header remains correctly positioned.
- [ ] Individual Pokémon Boxes retain their horizontal scrolling behavior.
- [ ] No unintended nested-scroll trap is introduced.

### Feature regression

- [ ] Header / Moniker / Dark Mode / Sync remain correct.
- [ ] Tabs remain correct.
- [ ] Progress banner remains correct.
- [ ] Search and Search Results remain correct.
- [ ] Box/List controls remain correct.
- [ ] Pokémon form names remain correct.
- [ ] 6×5 Box geometry remains unchanged.
- [ ] Desktop behavior remains unaffected.

## JavaScript Ownership

Mobile JavaScript is a **presentation and interaction layer**, not a replacement browser layout engine.

Preferred relationship:

```text
Browser / iOS
    ↓
Browser viewport + document layout
    ↓
Mobile presentation layer
    ↓
Components / Boxes / interactions
```

Avoid recreating:

```text
Browser / iOS
    ↓
Mobile JavaScript
    ↓
Artificial fixed viewport
    ↓
JS-calculated dimensions
    ↓
iOS viewport edge cases
```

This ownership rule should be considered during future HTML/JavaScript restructuring, particularly the planned **v0.13.6 HTML/JS** work.

## HTML/JS Restructuring Audit

When the application is eventually restructured, explicitly document ownership of:

| Responsibility | Intended Owner |
|---|---|
| Browser viewport | Browser |
| Document vertical scrolling | Document / layout system |
| Mobile presentation | Mobile presentation layer |
| Desktop presentation | Desktop/base presentation layer |
| Individual Box horizontal scrolling | Box container |
| Theme state | Theme system |
| View state | Shared application state |
| Pokémon/data | Application/data layer |
| Overlays | Explicit overlay owner |

The restructuring should preserve these boundaries rather than reintroducing competing layout owners.

## Release Process Rule

Before committing a future Mobile change, inspect whether it modifies or depends on:

- `html`
- `body`
- `.main-content`
- `overflow`
- `position`
- `height` / `min-height`
- `100vh`, `100svh`, `100lvh`, or `100dvh`
- `env(safe-area-inset-*)`
- JavaScript viewport measurements
- JavaScript-written CSS viewport dimensions

If a change touches these areas, perform a viewport-ownership review before committing.

**Core principle:**

> **Browser owns the viewport. CSS owns layout. Mobile JavaScript owns Mobile presentation and behavior — not the physical viewport.**
