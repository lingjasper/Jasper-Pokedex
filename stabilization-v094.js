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

    const boxButton = document.getElementById('boxViewBtn');
    if (boxButton) {
      boxButton.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1.9-2-2-2zm0 4h-4.5V5H19v2zM12.5 5v2H8.5V5h4zM7 5v2H5V5h2zM5 9h2v3.5H5V9zm4.5 0h4v3.5h-4V9zm6 0H19v3.5h-3.5V9zM19 19h-3.5v-4.5H19V19zm-5.5 0h-4v-4.5h4V19zm-6 0H5v-4.5H7V19z"/></svg><span>Box view</span>';
    }

    const listButton = document.getElementById('listViewBtn');
    if (listButton) {
      listButton.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 10.5c-.83 0-1.5.67-1.5 1.5s.67 1.5 1.5 1.5 1.5-.67 1.5-1.5-.67-1.5-1.5-1.5zm0-6c-.83 0-1.5.67-1.5 1.5S3.17 7.5 4 7.5 5.5 6.83 5.5 6s-.67-1.5-1.5-1.5zm0 12c-.83 0 1.5.68 1.5 1.5s.68 1.5 1.5 1.5 1.5-.68 1.5-1.5-.67-1.5-1.5-1.5zM7 19h14v-2H7v2zm0-6h14v-2H7v2zm0-8h14V3H7v2z"/></svg><span>List view</span>';
    }
  };

  const injectRefinementStyles = () => {
    if (document.getElementById('stabilization094Styles')) return;
    const style = document.createElement('style');
    style.id = 'stabilization094Styles';
    style.textContent = `
      #boxContainer .cell .checkbox { margin-top: 4px !important; }
      .list-row > .checkbox,
      .search-result-item > .checkbox { flex-shrink: 0; }
      #boxContainer .box-title { position: relative; padding-right: 4.5rem; }
      #boxContainer .box-completion-counter { position: absolute; right: 0; top: 0; white-space: nowrap; }
      #boxContainer .grid { grid-template-rows: repeat(5, minmax(58px, auto)) !important; }
      #boxContainer .cell { min-width: 0; min-height: 58px; overflow: hidden; }
      #boxContainer .cell .name { min-width: 0; max-width: 100%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    `;
    document.head.appendChild(style);
  };

  normalizeInitialShell();
  injectRefinementStyles();
})();
