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

  const escapeHtml = value => String(value ?? '').replace(/[&<>'\"]/g, char => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '\"': '&quot;'
  }[char]));

  const iconPath = game => `Game Icons/${game.icon || 'Unknown.png'}`;

  const renderGame = game => `
    <button class="tab-btn game-nav-button${game.enabled ? '' : ' disabled'}" type="button"
      data-game="${escapeHtml(game.id)}"${game.enabled ? '' : ' disabled'}
      aria-pressed="false"${game.enabled ? '' : ' aria-disabled="true"'}>
      <img class="game-icon" src="${escapeHtml(iconPath(game))}" width="32" height="32" alt="">
      <span class="game-name">${escapeHtml(game.name || game.id)}</span>
    </button>`;

  const getGames = () => VISIBLE_GAMES
    .map(id => registry.games.find(game => game && game.id === id))
    .filter(Boolean);

  const renderDesktop = container => {
    const games = getGames();
    container.className = 'tabs-container game-navigation';
    container.innerHTML = `<div class="game-navigation-scroll">${games.map(renderGame).join('')}</div>`;
    syncActive();
  };

  const renderMobile = container => {
    const games = getGames();
    container.className = 'tabs-container mobile-game-navigation';
    container.innerHTML = `
      <button class="mobile-game-selector" type="button" aria-expanded="false" aria-controls="mobileGameMenu">
        <img class="mobile-game-selector-icon" src="Icons/Cartridge.svg" width="20" height="20" alt="">
        <span class="mobile-game-selector-label">Games</span>
        <span class="mobile-game-selector-chevron" aria-hidden="true">⌄</span>
      </button>
      <div id="mobileGameMenu" class="mobile-game-menu" hidden>
        ${games.map(renderGame).join('')}
      </div>`;

    const selector = container.querySelector('.mobile-game-selector');
    const menu = container.querySelector('#mobileGameMenu');
    selector?.addEventListener('click', event => {
      event.stopPropagation();
      const open = selector.getAttribute('aria-expanded') === 'true';
      selector.setAttribute('aria-expanded', open ? 'false' : 'true');
      menu.hidden = open;
    });
    document.addEventListener('click', event => {
      if (!container.contains(event.target)) {
        selector?.setAttribute('aria-expanded', 'false');
        if (menu) menu.hidden = true;
      }
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
    document.querySelectorAll('.mobile-game-navigation').forEach(container => {
      const selected = container.querySelector('.tab-btn[data-game].active');
      const label = container.querySelector('.mobile-game-selector-label');
      if (label) label.textContent = selected?.querySelector('.game-name')?.textContent || 'Games';
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
      document.querySelectorAll('.tabs-container').forEach(container => { container.style.visibility = 'visible'; });
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
      .desktop-title-tabs .game-navigation { display:block!important; width:229px; margin:0!important; padding:0!important; }
      .desktop-title-tabs .game-navigation-scroll { display:flex; flex-direction:column; gap:8px; width:229px; max-height:calc(100vh - 150px); overflow-y:auto; overflow-x:hidden; padding-right:0; }
      .desktop-title-tabs .game-nav-button { display:flex; width:229px; min-height:46px; padding:6px; align-items:center; gap:8px; border-radius:6px; border:2px solid #CBD5E1; background:#F8FAFC; color:#0f172a; cursor:pointer; text-align:left; box-sizing:border-box; transition:border-color .15s ease,background .15s ease,opacity .15s ease; }
      .desktop-title-tabs .game-nav-button:hover:not(:disabled):not(.active) { border-color:#60A5FA; background:#EFF6FF; }
      .desktop-title-tabs .game-nav-button.active,.desktop-title-tabs .game-nav-button.active:hover { border-color:#60A5FA; background:linear-gradient(90deg,#2563EB 0%,#5B9CFF 100%); color:#fff; cursor:pointer; }
      .desktop-title-tabs .game-nav-button.disabled,.desktop-title-tabs .game-nav-button:disabled { border-color:#CBD5E1; background:#CACACA; color:#64748b; cursor:not-allowed; opacity:1; }
      .desktop-title-tabs .game-icon { width:32px; height:32px; flex:0 0 32px; aspect-ratio:1/1; object-fit:cover; border-radius:4px; border:2px solid #FFF; background:#d3d3d3; box-sizing:border-box; }
      .desktop-title-tabs .game-name { min-width:0; flex:1 1 auto; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; font-size:14px; font-weight:600; font-family:inherit; line-height:1.2; text-transform:none; letter-spacing:normal; }
      html[data-theme="dark"] .desktop-title-tabs .game-nav-button { border-color:#343A46; background:#242831; color:#f8fafc; }
      html[data-theme="dark"] .desktop-title-tabs .game-nav-button:hover:not(:disabled):not(.active) { border-color:#4979B6; background:#1D3150; }
      html[data-theme="dark"] .desktop-title-tabs .game-nav-button.active,html[data-theme="dark"] .desktop-title-tabs .game-nav-button.active:hover { border-color:#4979B6; background:linear-gradient(90deg,#2563EB 0%,#5B9CFF 100%); color:#fff; }
      html[data-theme="dark"] .desktop-title-tabs .game-nav-button.disabled,html[data-theme="dark"] .desktop-title-tabs .game-nav-button:disabled { border-color:#343A46; background:#414141; color:#a1a1a1; }
      html[data-theme="dark"] .desktop-title-tabs .game-icon { border-color:#FFF; }
    }

    @media (max-width:640px) {
      .tabs-container.mobile-game-navigation { position:relative; width:auto!important; margin:0!important; padding:0!important; overflow:visible!important; flex:0 0 34px!important; }
      .mobile-game-selector { width:34px; height:34px; min-width:34px; display:inline-flex; align-items:center; justify-content:center; position:relative; padding:0; border:1px solid #cbd5e1; border-radius:999px; background:#f8fafc; color:#475569; box-shadow:0 2px 8px rgba(15,23,42,.08); cursor:pointer; }
      .mobile-game-selector-icon { width:20px; height:20px; display:block; }
      .mobile-game-selector-label { position:absolute; width:1px; height:1px; overflow:hidden; clip:rect(0 0 0 0); white-space:nowrap; }
      .mobile-game-selector-chevron { display:none; }
      .mobile-game-selector[aria-expanded="true"] { border-color:#60A5FA; background:#EFF6FF; }
      .mobile-game-menu { position:fixed; top:58px; left:8px; right:8px; z-index:12500; display:flex; flex-direction:column; gap:8px; width:auto; max-width:none; padding:12px; box-sizing:border-box; border:1px solid #cbd5e1; border-radius:12px; background:#fff; box-shadow:0 16px 36px rgba(15,23,42,.2); }
      .mobile-game-menu[hidden] { display:none!important; }
      .mobile-game-menu .game-nav-button { display:flex; align-items:center; gap:8px; width:100%; min-height:46px; padding:6px; border-radius:6px; border:2px solid #CBD5E1; background:#F8FAFC; color:#0f172a; box-sizing:border-box; font-size:14px; font-weight:600; font-family:inherit; line-height:1.2; letter-spacing:normal; text-transform:none; cursor:pointer; text-align:left; }
      .mobile-game-menu .game-nav-button:hover:not(:disabled):not(.active) { border-color:#60A5FA; background:#EFF6FF; }
      .mobile-game-menu .game-nav-button.active,.mobile-game-menu .game-nav-button.active:hover { border-color:#60A5FA; background:linear-gradient(90deg,#2563EB 0%,#5B9CFF 100%); color:#fff; }
      .mobile-game-menu .game-nav-button.disabled,.mobile-game-menu .game-nav-button:disabled { border-color:#CBD5E1; background:#CACACA; color:#64748b; cursor:not-allowed; opacity:1; }
      .mobile-game-menu .game-icon { width:32px; height:32px; flex:0 0 32px; aspect-ratio:1/1; object-fit:cover; border-radius:4px; border:2px solid #FFF; background:#d3d3d3; box-sizing:border-box; }
      .mobile-game-menu .game-name { min-width:0; flex:1 1 auto; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; font-size:14px; font-weight:600; font-family:inherit; line-height:1.2; letter-spacing:normal; text-transform:none; }

      /* Mobile game-menu Dark SOT matches the established Desktop game-navigation SOT exactly. */
      html[data-theme="dark"] #mobileHeader .mobile-game-menu .game-nav-button { border-color:#343A46!important; background:#242831!important; color:#f8fafc!important; }
      html[data-theme="dark"] #mobileHeader .mobile-game-menu .game-nav-button:hover:not(:disabled):not(.active) { border-color:#4979B6!important; background:#1D3150!important; color:#f8fafc!important; }
      html[data-theme="dark"] #mobileHeader .mobile-game-menu .game-nav-button.active,
      html[data-theme="dark"] #mobileHeader .mobile-game-menu .game-nav-button.active:hover { border-color:#4979B6!important; background:linear-gradient(90deg,#2563EB 0%,#5B9CFF 100%)!important; color:#fff!important; }
      html[data-theme="dark"] #mobileHeader .mobile-game-menu .game-nav-button.disabled,
      html[data-theme="dark"] #mobileHeader .mobile-game-menu .game-nav-button:disabled { border-color:#343A46!important; background:#414141!important; color:#a1a1a1!important; }
      html[data-theme="dark"] #mobileHeader .mobile-game-menu { border-color:#454C59!important; background:#242831!important; color:#f5f7fa!important; box-shadow:0 16px 36px rgba(0,0,0,.32)!important; }
      html[data-theme="dark"] #mobileHeader .mobile-game-selector { border-color:#343A46!important; background:#242831!important; color:#f5f7fa!important; }
      html[data-theme="dark"] #mobileHeader .mobile-game-selector[aria-expanded="true"] { border-color:#4979B6!important; background:#1D3150!important; }
    }
  `;
  document.head.appendChild(style);

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
  else boot();
})();