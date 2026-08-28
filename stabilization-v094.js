(() => {
  'use strict';

  /*
   * Beta v0.13.1 — rendering and initialization stability.
   *
   * This compatibility layer keeps the existing v0.9-era HTML shell visually
   * aligned with the current pokedex-engine output until the v0.14 HTML
   * Application Shell Refactor. It does not own Pokémon data or application
   * state.
   */
  if (window.__JASPER_STABILIZATION_094__) return;
  window.__JASPER_STABILIZATION_094__ = true;

  const normalizeInitialShell = () => {
    const title = document.querySelector('body > h1');
    if (title && window.matchMedia('(min-width: 641px)').matches) {
      title.style.display = 'none';
    }

    const input = document.getElementById('searchInput');
    if (input) {
      input.placeholder = 'Search...';
      input.autocomplete = 'off';
    }

    // Icon artwork is owned by icon-system.js/pokedex-engine.js. This compatibility
    // layer must never recreate SVG path data; leave the controls as text placeholders
    // until the shared renderer paints the canonical assets.
    const boxButton = document.getElementById('boxViewBtn');
    if (boxButton) boxButton.textContent = 'Box view';

    const listButton = document.getElementById('listViewBtn');
    if (listButton) listButton.textContent = 'List view';
  };

  const injectRefinementStyles = () => {
    if (document.getElementById('stabilization094Styles')) return;
    const style = document.createElement('style');
    style.id = 'stabilization094Styles';
    style.textContent = `
      .list-row > .checkbox,
      .search-result-item > .checkbox { flex-shrink: 0; }
      #boxContainer .box-title { position: relative; padding-right: 4.5rem; }
      #boxContainer .box-completion-counter { position: absolute; right: 0; top: 0; white-space: nowrap; }
      #boxContainer .grid { grid-template-rows: repeat(5, minmax(58px, auto)) !important; }
      #boxContainer .cell { min-width: 0; min-height: 58px; overflow: hidden; gap: 0; }
      #boxContainer .cell .name { min-width: 0; max-width: 100%; height: 20px; margin-top: 0; margin-bottom: 0; line-height: 1.5; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    `;
    document.head.appendChild(style);
  };

  const loadMobileOverhaul = () => {
    if (document.getElementById('mobileOverhaulV133')) return;
    const script = document.createElement('script');
    script.id = 'mobileOverhaulV133';
    script.src = 'mobile-overhaul-v133.js?v=0.13.4.1';
    document.head.appendChild(script);
  };

  normalizeInitialShell();
  injectRefinementStyles();
  loadMobileOverhaul();
})();