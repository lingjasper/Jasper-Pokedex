(() => {
  'use strict';

  /* Beta v0.12 compatibility entry point.
   * This file only boots the established presentation layers.
   * Version, Pokémon rendering, counters, search, selection, and Sync state
   * remain dedicated owners elsewhere. */

  const load = (src, onload) => {
    const existing = [...document.scripts].find(s => s.src.includes(src));
    if (existing) { onload?.(); return; }
    const script = document.createElement('script');
    script.src = src;
    script.onload = () => onload?.();
    document.head.appendChild(script);
  };

  const loadTheme = (onload) => {
    if (!document.querySelector('link[data-jasper-theme]')) {
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = 'theme.css';
      link.dataset.jasperTheme = 'true';
      link.onload = () => onload?.();
      document.head.appendChild(link);
    } else {
      onload?.();
    }
  };

  // version.js remains the only moniker source. Existing presentation boots
  // first; the theme layer is applied afterward so it can safely override
  // legacy presentation colors without changing functional ownership.
  load('version.js', () => load('beta071-base.js', () => loadTheme(() => load('theme-toggle.js'))));
})();
