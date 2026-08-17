(() => {
  'use strict';

  /* Beta v0.11.0.1 compatibility entry point.
   * This file only boots the established desktop/Bulk presentation layer.
   * Version, Pokémon rendering, counters, search, selection, and Sync state
   * have dedicated owners elsewhere. */

  const load = (src, onload) => {
    const existing = [...document.scripts].find(s => s.src.includes(src));
    if (existing) { onload?.(); return; }
    const script = document.createElement('script');
    script.src = src;
    script.onload = () => onload?.();
    document.head.appendChild(script);
  };

  // version.js is the only moniker source. The renderer waits for it before booting.
  load('version.js', () => load('beta071-base.js'));
})();
