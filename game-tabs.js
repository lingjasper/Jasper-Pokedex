(() => {
  'use strict';

  /* v1.0.1 — registry-driven game tabs. The games registry is the single
   * source of truth for which titles exist and whether their tabs are enabled. */
  const REGISTRY_URL = 'data/games.json';

  const renderGameTabs = async () => {
    const containers = [...document.querySelectorAll('.tabs-container')];
    if (!containers.length) return;

    try {
      const response = await fetch(REGISTRY_URL, { cache: 'no-store' });
      if (!response.ok) throw new Error(`Registry load failed (${response.status}).`);
      const registry = await response.json();
      const games = Array.isArray(registry.games) ? registry.games.filter(game => game && game.id) : [];
      if (!games.length) return;

      containers.forEach(container => {
        const fragment = document.createDocumentFragment();
        games.forEach(game => {
          const button = document.createElement('button');
          button.type = 'button';
          button.className = `tab-btn${game.enabled ? '' : ' disabled'}`;
          button.dataset.game = game.id;
          button.textContent = game.name || game.id;
          button.disabled = game.enabled !== true;
          button.setAttribute('aria-pressed', game.id === registry.defaultGame ? 'true' : 'false');
          fragment.appendChild(button);
        });
        container.replaceChildren(fragment);
      });

      const active = window.JASPER_ACTIVE_GAME || registry.defaultGame;
      document.querySelectorAll('.tabs-container .tab-btn[data-game]').forEach(button => {
        const selected = button.dataset.game === active;
        button.classList.toggle('active', selected);
        button.setAttribute('aria-pressed', selected ? 'true' : 'false');
      });
    } catch (_) {
      // Leave the established static shell intact if the registry cannot load.
    }
  };

  const reveal = () => document.querySelectorAll('.tabs-container').forEach(container => {
    container.style.visibility = 'visible';
  });

  const boot = () => renderGameTabs().finally(reveal);
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
  else boot();
})();
