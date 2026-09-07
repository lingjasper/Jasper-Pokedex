(() => {
  'use strict';

  /* v1.1.1 — registry-driven game navigation. data/games.json is the single
   * source of truth for game identity, generation, availability and artwork. */
  const REGISTRY_URL = 'data/games.json';
  const FAVORITES_KEY = 'jasper_pokedex_favorite_games';
  const GENERATIONS = [10, 9, 8, 7, 6, 5, 4, 3, 2, 1];

  let registry = null;
  let favorites = new Set();

  const loadFavorites = () => {
    try {
      const value = JSON.parse(localStorage.getItem(FAVORITES_KEY) || '[]');
      favorites = new Set(Array.isArray(value) ? value.filter(id => typeof id === 'string') : []);
    } catch (_) {
      favorites = new Set();
    }
  };

  const saveFavorites = () => {
    try {
      localStorage.setItem(FAVORITES_KEY, JSON.stringify([...favorites]));
    } catch (_) {}
  };

  const escapeHtml = value => String(value ?? '').replace(/[&<>'"]/g, char => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    "'": '&#39;',
    '"': '&quot;'
  }[char]));

  const iconPath = game => `Game Icons/${game.icon || 'Unknown.png'}`;

  const renderPin = game => `
    <button class="game-pin" type="button" data-pin-game="${escapeHtml(game.id)}"
      aria-label="${favorites.has(game.id) ? 'Remove' : 'Add'} ${escapeHtml(game.name)} ${favorites.has(game.id) ? 'from' : 'to'} favourites"
      title="${favorites.has(game.id) ? 'Remove from' : 'Add to'} Favourites">
      <img class="game-pin-light" src="Icons/pin-black.svg" width="14" height="14" alt="">
      <img class="game-pin-dark" src="Icons/pin-white.svg" width="14" height="14" alt="">
    </button>`;

  const renderGame = game => `
    <div class="game-nav-item${favorites.has(game.id) ? ' is-pinned' : ''}">
      <button class="tab-btn game-nav-button${game.enabled ? '' : ' disabled'}" type="button"
        data-game="${escapeHtml(game.id)}"${game.enabled ? '' : ' disabled'}
        aria-pressed="false"${game.enabled ? '' : ' aria-disabled="true"'}>
        <img class="game-icon" src="${escapeHtml(iconPath(game))}" width="16" height="16" alt="">
        <span class="game-name">${escapeHtml(game.name || game.id)}</span>
      </button>
      ${game.enabled ? renderPin(game) : ''}
    </div>`;

  const renderAccordion = (generation, games, open = generation === 10) => {
    const panelId = `game-generation-${generation}`;
    return `
      <section class="game-generation${open ? ' is-open' : ''}" data-generation="${generation}">
        <button class="generation-toggle" type="button" aria-expanded="${open ? 'true' : 'false'}" aria-controls="${panelId}">
          <span>Generation ${generation}</span>
          <img class="generation-chevron" src="Icons/Chevron_South.svg" width="16" height="16" alt="">
        </button>
        <div class="generation-games" id="${panelId}"${open ? '' : ' hidden'}>
          ${games.map(renderGame).join('')}
        </div>
      </section>`;
  };

  const renderDesktop = container => {
    const games = registry.games.filter(game => game && game.id && Number.isInteger(game.generation));
    const byGeneration = generation => games.filter(game => game.generation === generation);
    const favoriteGames = [...favorites]
      .map(id => games.find(game => game.id === id))
      .filter(game => game && game.enabled === true);

    container.className = 'tabs-container game-navigation';
    container.innerHTML = `
      <div class="game-navigation-scroll">
        ${favoriteGames.length ? `
          <section class="game-favorites is-open">
            <button class="generation-toggle favorites-toggle" type="button" aria-expanded="true" aria-controls="game-favorites-list">
              <span>Favourites</span>
              <img class="generation-chevron" src="Icons/Chevron_South.svg" width="16" height="16" alt="">
            </button>
            <div class="generation-games" id="game-favorites-list">
              ${favoriteGames.map(renderGame).join('')}
            </div>
          </section>` : ''}
        ${GENERATIONS.map(generation => renderAccordion(generation, byGeneration(generation))).join('')}
      </div>`;

    syncActive();
  };

  const renderMobile = container => {
    const enabledGames = registry.games.filter(game => game && game.id && game.enabled === true);
    container.className = 'tabs-container';
    container.innerHTML = enabledGames.map(game => `
      <button class="tab-btn${game.enabled ? '' : ' disabled'}" type="button" data-game="${escapeHtml(game.id)}"
        ${game.enabled ? '' : 'disabled'} aria-pressed="false">
        ${escapeHtml(game.name || game.id)}
      </button>`).join('');
    syncActive();
  };

  const syncActive = () => {
    const active = window.JASPER_ACTIVE_GAME || registry?.defaultGame;
    document.querySelectorAll('.tabs-container .tab-btn[data-game]').forEach(button => {
      const selected = button.dataset.game === active;
      button.classList.toggle('active', selected);
      button.setAttribute('aria-pressed', selected ? 'true' : 'false');
    });
  };

  const render = () => {
    if (!registry) return;
    const containers = [...document.querySelectorAll('.tabs-container')];
    if (!containers.length) return;
    const desktop = matchMedia('(min-width: 641px)').matches;
    containers.forEach(container => desktop ? renderDesktop(container) : renderMobile(container));
  };

  const toggleAccordion = button => {
    const section = button.closest('.game-generation, .game-favorites');
    if (!section) return;
    const panel = section.querySelector('.generation-games');
    const open = button.getAttribute('aria-expanded') === 'true';
    button.setAttribute('aria-expanded', open ? 'false' : 'true');
    section.classList.toggle('is-open', !open);
    if (panel) panel.hidden = open;
  };

  const handleClick = event => {
    const accordion = event.target.closest('.generation-toggle');
    if (accordion) {
      event.preventDefault();
      toggleAccordion(accordion);
      return;
    }

    const pin = event.target.closest('.game-pin[data-pin-game]');
    if (pin) {
      event.preventDefault();
      event.stopPropagation();
      const id = pin.dataset.pinGame;
      if (!registry?.games.some(game => game.id === id && game.enabled === true)) return;
      if (favorites.has(id)) favorites.delete(id);
      else favorites.add(id);
      saveFavorites();
      render();
    }
  };

  const boot = async () => {
    loadFavorites();
    try {
      const response = await fetch(REGISTRY_URL, { cache: 'no-store' });
      if (!response.ok) throw new Error(`Registry load failed (${response.status}).`);
      registry = await response.json();
      if (!Array.isArray(registry.games) || !registry.games.length) throw new Error('Registry is empty.');
      render();
    } catch (_) {
      // Leave the established static shell intact if the registry cannot load.
    } finally {
      document.querySelectorAll('.tabs-container').forEach(container => {
        container.style.visibility = 'visible';
      });
    }
  };

  document.addEventListener('click', handleClick);
  window.addEventListener('jasper:pokedex-game-changed', syncActive);
  window.addEventListener('jasper:desktop-sidebar-ready', render);
  window.addEventListener('resize', render);

  const style = document.createElement('style');
  style.id = 'v111GameNavigationStyles';
  style.textContent = `
    @media (min-width:641px) {
      .desktop-title-tabs .game-navigation {
        display:block!important;
        width:229px;
        margin:0!important;
        padding:0!important;
      }
      .desktop-title-tabs .game-navigation-scroll {
        display:flex;
        flex-direction:column;
        gap:8px;
        width:229px;
        max-height:calc(100vh - 150px);
        overflow-y:auto;
        overflow-x:hidden;
        padding-right:0;
      }
      .desktop-title-tabs .game-generation,
      .desktop-title-tabs .game-favorites {
        width:229px;
        flex:0 0 auto;
      }
      .desktop-title-tabs .generation-toggle {
        width:229px;
        min-height:28px;
        padding:4px 6px;
        display:flex;
        align-items:center;
        justify-content:space-between;
        gap:8px;
        border:0;
        background:transparent;
        color:#475569;
        font-size:.82rem;
        font-weight:700;
        cursor:pointer;
      }
      .desktop-title-tabs .generation-chevron {
        width:16px;
        height:16px;
        flex:0 0 16px;
        display:block;
        transition:transform .15s ease;
      }
      .desktop-title-tabs .game-generation:not(.is-open) .generation-chevron,
      .desktop-title-tabs .game-favorites:not(.is-open) .generation-chevron {
        transform:rotate(-90deg);
      }
      .desktop-title-tabs .generation-games {
        display:flex;
        flex-direction:column;
        gap:6px;
      }
      .desktop-title-tabs .generation-games[hidden] {
        display:none;
      }
      .desktop-title-tabs .game-nav-item {
        position:relative;
        width:229px;
        min-height:34px;
      }
      .desktop-title-tabs .game-nav-button {
        display:flex;
        width:229px;
        min-height:34px;
        padding:6px;
        align-items:center;
        gap:8px;
        border-radius:4px;
        border:1px solid #CBD5E1;
        background:#FAFAFA;
        color:#0f172a;
        cursor:pointer;
        text-align:left;
        box-sizing:border-box;
        transition:border-color .15s ease,background .15s ease,opacity .15s ease;
      }
      .desktop-title-tabs .game-nav-button:hover:not(:disabled) {
        border-color:#60A5FA;
        background:#FAFAFA;
      }
      .desktop-title-tabs .game-nav-button.active {
        border-color:#60A5FA;
        background:linear-gradient(90deg,#2563EB 0%,#5B9CFF 100%);
        color:#fff;
      }
      .desktop-title-tabs .game-nav-button.disabled,
      .desktop-title-tabs .game-nav-button:disabled {
        border-color:#CBD5E1;
        background:#CACACA;
        color:#64748b;
        cursor:not-allowed;
        opacity:1;
      }
      .desktop-title-tabs .game-icon {
        width:16px;
        height:16px;
        flex:0 0 16px;
        aspect-ratio:1/1;
        object-fit:cover;
        border-radius:2px;
        border:1px solid #FFF;
        background:#d3d3d3;
      }
      .desktop-title-tabs .game-name {
        min-width:0;
        flex:1 1 auto;
        overflow:hidden;
        text-overflow:ellipsis;
        white-space:nowrap;
        font-size:.82rem;
        font-weight:600;
        line-height:1.2;
      }
      .desktop-title-tabs .game-pin {
        position:absolute;
        top:50%;
        right:6px;
        width:14px;
        height:14px;
        padding:0;
        margin:0;
        transform:translateY(-50%);
        display:flex;
        align-items:center;
        justify-content:center;
        border:0;
        background:transparent;
        cursor:pointer;
        opacity:0;
        z-index:3;
      }
      .desktop-title-tabs .game-nav-item:hover .game-pin,
      .desktop-title-tabs .game-nav-item.is-pinned .game-pin {
        opacity:1;
      }
      .desktop-title-tabs .game-pin img {
        width:14px;
        height:14px;
        flex-shrink:0;
        aspect-ratio:1/1;
        display:block;
      }
      .desktop-title-tabs .game-pin-dark { display:none; }
      html[data-theme="dark"] .desktop-title-tabs .generation-toggle { color:#cbd5e1; }
      html[data-theme="dark"] .desktop-title-tabs .game-nav-button {
        border-color:#343A46;
        background:#242831;
        color:#f8fafc;
      }
      html[data-theme="dark"] .desktop-title-tabs .game-nav-button:hover:not(:disabled) {
        border-color:#4979B6;
        background:#242831;
      }
      html[data-theme="dark"] .desktop-title-tabs .game-nav-button.active {
        border-color:#4979B6;
        background:linear-gradient(90deg,#2563EB 0%,#5B9CFF 100%);
        color:#fff;
      }
      html[data-theme="dark"] .desktop-title-tabs .game-nav-button.disabled,
      html[data-theme="dark"] .desktop-title-tabs .game-nav-button:disabled {
        border-color:#343A46;
        background:#414141;
        color:#a1a1a1;
      }
      html[data-theme="dark"] .desktop-title-tabs .game-pin-light { display:none; }
      html[data-theme="dark"] .desktop-title-tabs .game-pin-dark { display:block; }
      html[data-theme="dark"] .desktop-title-tabs .game-icon { border-color:#FFF; }
    }

    @media (max-width:640px) {
      .tabs-container .tab-btn {
        display:flex;
        align-items:center;
        gap:8px;
      }
    }
  `;
  document.head.appendChild(style);

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
  else boot();
})();
