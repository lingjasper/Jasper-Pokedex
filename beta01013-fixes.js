(() => {
  'use strict';

  // Beta v0.10.1.3 stability fixes. Release text itself lives only in version.js.
  const STATE_KEY = 'b2w2_living_dex_saved_state';
  const GAME_STATE_PREFIX = 'jasper_pokedex_state_';
  const DEFAULT_GAME = 'White2';
  let lastStateSignature = '';

  const getState = () => {
    try { return JSON.parse(localStorage.getItem(STATE_KEY) || '{}'); }
    catch { return {}; }
  };

  const getActivePokemon = () => window.JASPER_POKEDEX?.pokemon || [];

  const migrateState = () => {
    const pokemon = getActivePokemon();
    if (!pokemon.length) return {};
    const game = window.JASPER_ACTIVE_GAME || DEFAULT_GAME;
    const key = `${GAME_STATE_PREFIX}${game}`;
    let current = {};
    try { current = JSON.parse(localStorage.getItem(key) || '{}'); } catch {}
    const legacy = getState();
    if (Object.keys(current).length === 0 && Object.keys(legacy).length) {
      current = legacy;
      localStorage.setItem(key, JSON.stringify(current));
    }
    return current;
  };

  const updateBoxCounters = () => {
    document.querySelectorAll('#boxContainer .pc-box').forEach(box => {
      const title = box.querySelector('.box-title');
      if (!title) return;
      let counter = title.querySelector('.box-completion-counter');
      if (!counter) {
        counter = document.createElement('span');
        counter.className = 'box-completion-counter';
        title.appendChild(counter);
      }
      const occupied = box.querySelectorAll('.cell:not(.empty)').length;
      const completed = box.querySelectorAll('.cell:not(.empty).completed').length;
      counter.textContent = `${completed}/${occupied}`;
    });
  };

  const updateBanner = () => {
    const banner = document.getElementById('dexProgressBanner');
    const text = banner?.querySelector('.dex-progress-text');
    const pokemon = getActivePokemon();
    if (!text || !pokemon.length) return;

    const state = migrateState();
    const total = pokemon.length;
    const registered = pokemon.filter(p => state[p.id] === true).length;
    const remaining = total - registered;
    const percent = Math.round((registered / Math.max(1, total)) * 100);
    text.textContent = `${registered} of ${total} Pokémon registered · ${remaining} remaining · ${percent}% complete`;
  };

  const refreshUI = () => {
    updateBoxCounters();
    updateBanner();
  };

  const stateSignature = () => {
    try {
      return JSON.stringify({
        legacy: localStorage.getItem(STATE_KEY) || '',
        game: localStorage.getItem(`${GAME_STATE_PREFIX}${window.JASPER_ACTIVE_GAME || DEFAULT_GAME}`) || ''
      });
    } catch { return ''; }
  };

  const watchForSyncedData = () => {
    const refreshIfChanged = () => {
      const signature = stateSignature();
      if (!signature || signature === lastStateSignature) return;
      lastStateSignature = signature;
      if (window.JASPER_POKEDEX_REFRESH) {
        Promise.resolve(window.JASPER_POKEDEX_REFRESH()).then(refreshUI).catch(() => refreshUI());
      } else {
        refreshUI();
      }
    };

    window.addEventListener('jasper:pokedex-state-synced', () => {
      lastStateSignature = '';
      refreshIfChanged();
      setTimeout(refreshIfChanged, 50);
      setTimeout(refreshIfChanged, 250);
    });

    window.addEventListener('storage', refreshIfChanged);
    setInterval(refreshIfChanged, 250);
  };

  const boot = () => {
    watchForSyncedData();
    refreshUI();
    setTimeout(refreshUI, 100);
    setTimeout(refreshUI, 500);
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
  else boot();
})();
