(() => {
  'use strict';

  /* Beta v0.13.5.3 compatibility entry point.
   * This file only boots the established presentation layers.
   * Version, Pokémon rendering, counters, search, selection, Sync state,
   * theme state, and Mobile presentation remain dedicated owners elsewhere. */
  if (window.__JASPER_BETA071_BOOTED__) return;
  window.__JASPER_BETA071_BOOTED__ = true;

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
  load('version.js', () => load('beta071-base.js', () => loadTheme(() => load('theme-toggle.js', () => load('mobile-overhaul-v133.js?v=0.13.5.2', () => load('beta1353-bugfix.js?v=0.13.5.3'))))));
})();
