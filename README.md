Since: August 15, 2026

Jasper's Pokédex

A visual Pokémon collection and storage tracker designed to help organize and keep track of Pokémon obtained in-game.

Major Features 
... as per Release v1.0.0, August 28, 2026

Pokémon Collection Tracking — Organize and track your Pokémon collection, and check off Pokémon as you obtain them in-game. Browse, manage, and track your progress. Manage Pokémon according to their respective supported game and storage system.
Box View — View and manage your collection using a familiar Pokémon storage-box layout.
List View — Switch to a streamlined list-based view for quickly browsing and managing your collection.
Bulk Storage Management — Add multiple Pokémon to your storage boxes at once using Bulk Mode.
Collection Progress — Track your overall Pokémon collection and see your progress toward completing it.
Light and Dark Mode — A clean light interface for daytime and bright environments, and a dark-themed interface for comfortable viewing in low-light environments.
Desktop & Mobile Support — Responsive interfaces designed for use across desktop and mobile devices.

Future Feature Roadmap
... In no particular order.

Additional Games — Add support for additional Pokémon games and their respective storage systems.
Collection Dashboard — Provide an overview of collection progress and completion statistics.
Regional / National Dex Filter — Filter the collection by Regional Dex or National Dex.
Wild Locations — View where Pokémon can be encountered in the wild directly in the tracker.

Project Structure

The site is static and has no build step. GitHub Pages serves the files as they are.

index.html — The page shell: top bar, game list, search, the empty containers for boxes and list, and the icon set (inlined from /Icons).
app.css — Every style, light and dark theme, and the phone / tablet / desktop layouts.
js/app.js — Rendering and interaction: boxes, list, search, Manage PC, the Pokédex panel.
js/core.js — Pure data logic: dataset parsing, entry ids, save migration, search, sprite names, type matchups.
js/sync.js — GitHub sync: token, load, save, conflict handling.
js/pokedex.js — Pokédex details read from PokéAPI.
data/games.json — The game registry. A game appears when it is `visible`, and opens when it is `enabled`.
Pokedexes/ — One Markdown table per game. Each row becomes a storage entry.
saves/ — One save file per game, written by the site through the GitHub API.
Sprites/, Game Icons/, Icons/ — Artwork. A sprite is found by name: `Sprites/<name>.png` or `Sprites/<name>-<form>.png`.

Development

Run locally: `python3 -m http.server` in the repository folder, then open http://localhost:8000.
Run the tests: `node --test tests/app.test.mjs` (Node 20 or newer, no install needed).
Demo mode: add `data-demo` to the `<html>` tag to run without sync, PokéAPI or artwork. Manage PC then saves to the browser only.

Things to keep true when changing the site:

The browser owns the viewport. The page scrolls as a normal document; do not lock `html`/`body` scrolling or size anything from JavaScript viewport measurements.
Entry ids are `<dex number>-<name>[-<form>]`, for example `016-unfezant-male`. They are the keys in localStorage and in saves/, so they must not change.
Nothing is injected after load. Markup that is always on screen lives in index.html, and styles live in app.css.
