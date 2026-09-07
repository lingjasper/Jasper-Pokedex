(() => {
  'use strict';

  /* v1.1.1 — registry-driven game navigation. data/games.json remains the
   * single source of truth for game identity, visibility, availability and artwork. */
  const REGISTRY_URL = 'data/games.json';

  let registry = null;

  const escapeHtml = value => String(value ?? '').replace(/[&<>'"]/g, char => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    "'": '&#39;',
    '"': '&quot;'
  }[char]));

  const iconPath = game => `Game Icons/${game.icon || 'Unknown.png'}`;

  const visibleGames = () => {
    if (!registry?.games) return [];
    return registry.games.filter(game => game && game.id && game.visible === true);
  };

  const renderGame = game => `
    <button class="tab-btn game-nav-button${game.enabled ? '' : ' disabled'}" type="button"
      data-game="${escapeHtml(game.id)}"${game.enabled ? '' : ' disabled'}
      aria-pressed="false"${game.enabled ? '' : ' aria-disabled="true"'}>
      <img class="game-icon" src="${escapeHtml(iconPath(game))}" width="32" height="32" alt="">
      <span class="game-name">${escapeHtml(game.name || game.id)}</span>
    </button>`;

  const render = () => {
    if (!registry) return;
    const games = visibleGames();
    const containers = [...document.querySelectorAll('.tabs-container')];
    containers.forEach(container => {
      container.className = 'tabs-container game-navigation';
      container.innerHTML = games.map(renderGame).join('');
    });
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

  document.addEventListener('click', event => {
    const game = event.target.closest('.tabs-container .tab-btn[data-game]');
    if (!game || game.disabled) return;
    syncActive();
  });
  window.addEventListener('jasper:pokedex-game-changed', syncActive);
  window.addEventListener('jasper:desktop-sidebar-ready', render);
  window.addEventListener('resize', syncActive);

  const style = document.createElement('style');
  style.id = 'v111GameNavigationStyles';
  style.textContent = `
    @media (min-width:641px) {
      .desktop-title-tabs .game-navigation {
        display:flex!important;
        flex-direction:column;
        gap:6px;
        width:229px;
        margin:0!important;
        padding:0!important;
      }
      .desktop-title-tabs .game-nav-button {
        display:flex;
        width:229px;
        min-height:46px;
        box-sizing:border-box;
        padding:6px;
        align-items:center;
        gap:8px;
        border-radius:4px;
        border:1px solid #CBD5E1;
        background:#F8FAFC;
        color:#0f172a;
        cursor:pointer;
        text-align:left;
        transition:border-color .15s ease,background .15s ease;
      }
      .desktop-title-tabs .game-nav-button:hover:not(.active):not(:disabled) {
        border-color:#60A5FA;
        background:#FAFAFA;
      }
      .desktop-title-tabs .game-nav-button.active {
        border-color:#60A5FA;
        background:linear-gradient(90deg,#2563EB 0%,#5B9CFF 100%);
        color:#fff;
      }
      .desktop-title-tabs .game-nav-button.active:hover {
        border-color:#60A5FA;
        background:linear-gradient(90deg,#2563EB 0%,#5B9CFF 100%);
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
        font-size:14px;
        font-weight:600;
        line-height:1.2;
      }
      html[data-theme="dark"] .desktop-title-tabs .game-nav-button {
        border-color:#343A46;
        background:#242831;
        color:#f8fafc;
      }
      html[data-theme="dark"] .desktop-title-tabs .game-nav-button:hover:not(.active):not(:disabled) {
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
      html[data-theme="dark"] .desktop-title-tabs .game-icon { border-color:#FFF; }
    }

    @media (max-width:640px) {
      .tabs-container.game-navigation {
        display:flex;
        flex-direction:column;
        gap:6px;
      }
      .tabs-container.game-navigation .game-nav-button {
        display:flex;
        width:100%;
        min-height:46px;
        box-sizing:border-box;
        padding:6px;
        align-items:center;
        gap:8px;
        border-radius:4px;
      }
      .tabs-container.game-navigation .game-icon {
        width:32px;
        height:32px;
        flex:0 0 32px;
        object-fit:cover;
        border-radius:2px;
      }
      .tabs-container.game-navigation .game-name {
        font-size:14px;
      }
    }
  `;
  document.head.appendChild(style);

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
  else boot();
})();
