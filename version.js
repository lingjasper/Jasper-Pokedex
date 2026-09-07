(() => {
  'use strict';
  // SINGLE SOURCE OF TRUTH for the website release moniker.
  window.JASPER_POKEDEX_VERSION = 'Release v1.1.0';
  // Load v1.0.3 sprite presentation after the core release bootstrap has been defined.
  const load = () => {
    if (document.getElementById('jasperV103SpriteCard')) return;
    const s = document.createElement('script');
    s.id = 'jasperV103SpriteCard';
    s.src = 'sprite-card-v103.js';
    s.defer = true;
    document.head.appendChild(s);
  };
  const loadPokedexOverlay = () => {
    if (document.getElementById('jasperPokedexButtonOverlay')) return;
    const s = document.createElement('script');
    s.id = 'jasperPokedexButtonOverlay';
    s.src = 'pokedex-button-overlay.js';
    s.defer = true;
    document.head.appendChild(s);
  };
  const loadPokeApi = () => {
    if (document.getElementById('jasperPokeApi')) return;
    const s = document.createElement('script');
    s.id = 'jasperPokeApi';
    s.src = 'pokeapi.js';
    s.defer = true;
    document.head.appendChild(s);
  };
  const loadPokedexApiUi = () => {
    if (document.getElementById('jasperPokedexApiUi')) return;
    const s = document.createElement('script');
    s.id = 'jasperPokedexApiUi';
    s.src = 'pokedex-api-ui.js';
    s.defer = true;
    document.head.appendChild(s);
  };
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', load, { once: true });
    document.addEventListener('DOMContentLoaded', loadPokedexOverlay, { once: true });
    document.addEventListener('DOMContentLoaded', loadPokeApi, { once: true });
    document.addEventListener('DOMContentLoaded', loadPokedexApiUi, { once: true });
  } else {
    load();
    loadPokedexOverlay();
    loadPokeApi();
    loadPokedexApiUi();
  }
})();
