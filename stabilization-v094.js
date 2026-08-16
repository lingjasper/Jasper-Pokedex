(() => {
  'use strict';

  /*
   * Beta v0.10 compatibility shim.
   *
   * v0.9.4's visual spacing refinements remain useful, but its DOM form
   * injection and MutationObserver are intentionally retired. Pokedexes are
   * now rendered exclusively from Pokedexes/<game> by pokedex-engine.js.
   */
  if (window.__JASPER_STABILIZATION_094__) return;
  window.__JASPER_STABILIZATION_094__ = true;

  const injectRefinementStyles = () => {
    if (document.getElementById('stabilization094Styles')) return;
    const style = document.createElement('style');
    style.id = 'stabilization094Styles';
    style.textContent = `
      #boxContainer .cell .checkbox { margin-top: 4px !important; }
      .list-row > .checkbox,
      .search-result-item > .checkbox { flex-shrink: 0; }
    `;
    document.head.appendChild(style);
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', injectRefinementStyles, { once: true });
  } else {
    injectRefinementStyles();
  }
})();
