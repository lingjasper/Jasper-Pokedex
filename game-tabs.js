(() => {
  'use strict';

  /* v1.1.1 — registry-driven game navigation. data/games.json remains the
   * single source of truth for game identity, visibility, availability and artwork. */
  const REGISTRY_URL = 'data/games.json';
  const VISIBLE_GAMES = [
    'pokemon-legends-z-a',
    'pokemon-sun',
    'pokemon-alpha-sapphire',
    'pokemon-white-2'
  ];

  let registry = null;

  const escapeHtml = value => String(value ?? '').replace(/[&<>'"]/g, char => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    "'": '&#39;',
    '"': '&quot;'
  }[char]));

  const iconPath = game => `Game Icons/${game.icon || 'Unknown.png'}`;

  const renderGame = game => `
    <button class="tab-btn game-nav-button${game.enabled ? '' : ' disabled'}" type="button"
      data-game="${escapeHtml(game.id)}"${game.enabled ? '' : ' disabled'}
      aria-pressed="false"${game.enabled ? '' : ' aria-disabled="true"'}>
      <img class="game-icon" src="${escapeHtml(iconPath(game))}" width="32" height="32" alt="">
      <span class="game-name">${escapeHtml(game.name || game.id)}</span>
    </button>`;

  const renderDesktop = container => {
    const games = VISIBLE_GAMES
      .map(id => registry.games.find(game => game && game.id === id))
      .filter(Boolean);

    container.className = 'tabs-container game-navigation';
    container.innerHTML = `
      <div class="game-navigation-scroll">
        ${games.map(renderGame).join('')}
      </div>`;

    syncActive();
  };

  const renderMobile = container => {
    const games = VISIBLE_GAMES
      .map(id => registry.games.find(game => game && game.id === id && game.enabled === true))
      .filter(Boolean);
    container.className = 'tabs-container';
    container.innerHTML = games.map(game => `
      <button class="tab-btn" type="button" data-game="${escapeHtml(game.id)}" aria-pressed="false">
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

  const handleClick = event => {
    const button = event.target.closest('.game-nav-button[data-game]');
    if (!button || button.disabled) return;
  };

  const boot = async () => {
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
      .desktop-title-tabs .game-nav-button {
        display:flex;
        width:229px;
        min-height:46px;
        padding:6px;
        align-items:center;
        gap:8px;
        border-radius:6px;
        border:2px solid #CBD5E1;
        background:#F8FAFC;
        color:#0f172a;
        cursor:pointer;
        text-align:left;
        box-sizing:border-box;
        transition:border-color .15s ease,background .15s ease,opacity .15s ease;
      }
      .desktop-title-tabs .game-nav-button:hover:not(:disabled):not(.active) {
        border-color:#60A5FA;
        background:#EFF6FF;
      }
      .desktop-title-tabs .game-nav-button.active,
      .desktop-title-tabs .game-nav-button.active:hover {
        border-color:#60A5FA;
        background:linear-gradient(90deg,#2563EB 0%,#5B9CFF 100%);
        color:#fff;
        cursor:pointer;
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
        width:32px;
        height:32px;
        flex:0 0 32px;
        aspect-ratio:1/1;
        object-fit:cover;
        border-radius:4px;
        border:2px solid #FFF;
        background:#d3d3d3;
        box-sizing:border-box;
      }
      .desktop-title-tabs .game-name {
        min-width:0;
        flex:1 1 auto;
        overflow:hidden;
        text-overflow:ellipsis;
        white-space:nowrap;
        font-size:14px;
        font-weight:600;
        line-height:1.2;
      }
      html[data-theme="dark"] .desktop-title-tabs .game-nav-button {
        border-color:#343A46;
        background:#242831;
        color:#f8fafc;
      }
      html[data-theme="dark"] .desktop-title-tabs .game-nav-button:hover:not(:disabled):not(.active) {
        border-color:#4979B6;
        background:#242831;
      }
      html[data-theme="dark"] .desktop-title-tabs .game-nav-button.active,
      html[data-theme="dark"] .desktop-title-tabs .game-nav-button.active:hover {
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
      html[data-theme="dark"] .desktop-title-tabs .game-icon {
        border-color:#FFF;
      }
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
