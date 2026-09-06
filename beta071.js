(() => {
  'use strict';

  /* Beta v0.13.5.3 compatibility entry point.
   * This file only boots the established presentation layers.
   * Version, Pokémon rendering, counters, search, selection, Sync state,
   * theme state, and Mobile presentation remain dedicated owners elsewhere. */
  if (window.__JASPER_BETA071_BOOTED__) return;
  window.__JASPER_BETA071_BOOTED__ = true;

  /* v1.0.1 branch-safe dataset routing.
   * The engine's historical raw-data URL points at main, which is not correct
   * while testing an unmerged branch. Route those dataset requests to the
   * repository-relative Pokedexes/ path so Alpha Sapphire and Sun load from
   * the exact branch being tested. */
  const nativeFetch = window.fetch.bind(window);
  const MAIN_POKEDEX_ROOT = 'https://raw.githubusercontent.com/lingjasper/Jasper-Pokedex/main/Pokedexes/';
  window.fetch = (input, init) => {
    const url = typeof input === 'string' ? input : input?.url || '';
    if (url.startsWith(MAIN_POKEDEX_ROOT)) {
      const dataset = decodeURIComponent(url.slice(MAIN_POKEDEX_ROOT.length));
      return nativeFetch(`Pokedexes/${dataset}`, init);
    }
    return nativeFetch(input, init);
  };

  /* Prevent the static legacy tab shell from flashing disabled future games
   * while the registry-driven tab layer replaces it. game-tabs.js reveals the
   * tabs after the authoritative registry has been applied. */
  const tabStyle = document.createElement('style');
  tabStyle.id = 'v101GameTabsBootStyle';
  tabStyle.textContent = '.tabs-container{visibility:hidden}';
  document.head.appendChild(tabStyle);

  const load = (src, done) => {
    const script = document.createElement('script');
    script.src = src;
    script.onload = () => done && done();
    script.onerror = () => done && done();
    document.head.appendChild(script);
  };
  const loadTheme = done => {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = 'theme.css?v=0.13.5.2';
    link.onload = () => done && done();
    link.onerror = () => done && done();
    document.head.appendChild(link);
  };

  // Load the established owners in dependency order. Mobile presentation loads
  // last so it can adapt the established shell without affecting Desktop.
  load('version.js', () => load('beta071-base.js', () => loadTheme(() => load('theme-toggle.js', () => load('mobile-overhaul-v133.js?v=0.13.5.2', () => load('beta1353-bugfix.js?v=0.13.5.3', () => load('game-tabs.js')))))));
})();
