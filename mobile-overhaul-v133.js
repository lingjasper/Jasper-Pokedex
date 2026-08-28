(() => {
  'use strict';

  /*
   * Beta v0.13.5.2 — Mobile Viewport Ownership Correction.
   *
   * This layer owns Mobile presentation only. Pokémon data, Box allocation,
   * forms, completion state, search logic, and GitHub sync remain owned by
   * their existing modules.
   *
   * Mobile viewport ownership is intentionally kept in normal document flow.
   * The header is sticky, while the page remains the browser's scroll surface.
   * This avoids a JS-calculated fixed viewport that is fragile on iOS Safari.
   */
  if (window.__JASPER_MOBILE_OVERHAUL_133__) return;
  window.__JASPER_MOBILE_OVERHAUL_133__ = true;

  const isMobile = () => window.matchMedia('(max-width: 640px)').matches;
  const stateKey = game => `jasper_pokedex_state_${game || 'White2'}`;
  const readState = game => {
    try { return JSON.parse(localStorage.getItem(stateKey(game)) || '{}'); }
    catch { return {}; }
  };

  const installStyles = () => {
    if (document.getElementById('v0133MobileStyles')) return;
    const style = document.createElement('style');
    style.id = 'v0133MobileStyles';
    style.textContent = `
      #mobileHeader { display:none; }
      @media (max-width:640px) {
        html, body { max-width:100%; overflow-x:hidden!important; }
        body { padding:0 8px!important; margin:0!important; }

        #mobileHeader {
          position:sticky; top:0; left:auto; right:auto; width:100%;
          box-sizing:border-box; display:flex; flex-direction:column;
          align-items:stretch; justify-content:flex-start;
          gap:0; padding:8px 0 0; margin:0!important;
          background:#fff; z-index:11900;
          box-shadow:0 1px 4px rgba(15,23,42,.08);
        }
        #mobileHeaderTop { display:flex; align-items:center; justify-content:space-between; gap:12px; min-width:0; }
        #mobileHeaderBrand { min-width:0; flex:1 1 auto; display:flex; flex-direction:column; align-items:flex-start; justify-content:center; gap:0; }
        #mobileHeaderTitle { margin:0; color:#0f172a; font-size:1.05rem; line-height:1.25; font-weight:700; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
        #mobileHeaderMoniker { margin:0; color:#475569; font-size:.78rem; line-height:1.2; font-weight:600; white-space:nowrap; }
        #mobileHeaderActions { display:flex; align-items:center; gap:8px; flex:0 0 auto; }
        #mobileDarkModePlaceholder { width:34px; height:34px; flex:0 0 34px; display:inline-flex; align-items:center; justify-content:center; padding:0; border:1px solid #cbd5e1; border-radius:999px; background:#f8fafc; color:#94a3b8; font-size:17px; line-height:1; cursor:not-allowed; opacity:.58; }
        #mobileHeader #githubSyncWrap { position:relative!important; top:auto!important; right:auto!important; flex:0 0 auto; }
        #mobileHeader #githubSyncPill { white-space:nowrap; }

        .tabs-container { width:100%!important; justify-content:flex-start!important; flex-wrap:nowrap!important; overflow-x:auto!important; overflow-y:hidden!important; -webkit-overflow-scrolling:touch; scrollbar-width:thin; padding:0 2px 4px!important; gap:8px!important; margin:14px 0 14px!important; box-sizing:border-box; }
        .tabs-container .tab-btn { flex:0 0 auto!important; white-space:nowrap!important; }

        #mobileProgressBanner { display:flex; align-items:center; gap:10px; width:100%; box-sizing:border-box; margin:0 0 14px; padding:11px 12px; background:#fff; border:1px solid #cbd5e1; border-radius:10px; box-shadow:0 2px 5px rgba(15,23,42,.05); color:#475569; font-size:.78rem; font-weight:600; }
        #mobileProgressBanner .mobile-progress-icon { width:20px; height:20px; flex:0 0 20px; display:inline-flex; align-items:center; justify-content:center; border-radius:50%; background:#e2e8f0; color:#475569; font-size:.75rem; font-weight:800; }
        #mobileProgressText { min-width:0; }

        .controls-container { width:100%!important; max-width:none!important; margin:0 0 14px!important; flex-direction:row!important; align-items:center!important; gap:8px!important; box-sizing:border-box; }
        .search-wrapper { width:auto!important; min-width:0!important; flex:1 1 auto!important; position:relative!important; }
        .search-input { font-size:16px!important; width:100%!important; }
        .search-results { left:0!important; right:auto!important; width:calc(100vw - 16px)!important; max-width:calc(100vw - 16px)!important; box-sizing:border-box!important; overflow-x:hidden!important; }
        .search-result-item { min-width:0!important; gap:8px!important; }
        .search-result-item .name { min-width:0!important; flex:1 1 auto!important; overflow:hidden!important; text-overflow:ellipsis!important; white-space:nowrap!important; }
        .search-jump { flex:0 0 auto!important; }

        .view-toggle { align-self:center!important; width:auto!important; display:flex!important; flex:0 0 auto!important; gap:8px!important; }
        .view-toggle .toggle-btn { width:80px!important; min-width:80px!important; height:34px!important; justify-content:center!important; padding:6px 8px!important; gap:5px!important; font-size:.78rem!important; }
        .view-toggle .toggle-btn svg { width:15px!important; height:15px!important; }

        .main-content { width:100%!important; max-width:none!important; min-width:0!important; margin:0!important; padding:0!important; box-sizing:border-box; position:static!important; left:auto!important; right:auto!important; top:auto!important; bottom:auto!important; height:auto!important; overflow:visible!important; }
        #boxContainer, #listContainer { width:100%!important; max-width:100%!important; min-width:0!important; }
        #boxContainer { overflow:visible!important; gap:8px!important; }
        #boxContainer .pc-box { width:100%!important; min-width:0!important; }
        #boxContainer .grid-wrapper { width:100%!important; max-width:100%!important; min-width:0!important; overflow-x:auto!important; overflow-y:hidden!important; -webkit-overflow-scrolling:touch; overscroll-behavior-x:contain; }
        #boxContainer .grid { min-width:670px!important; width:max-content!important; }

        #listContainer { overflow-x:hidden!important; }
        #listContainer .list-row { min-width:0!important; }
        #listContainer .list-info { min-width:0!important; flex:1 1 auto!important; }
        #listContainer .list-info .name { min-width:0!important; overflow:hidden!important; text-overflow:ellipsis!important; white-space:nowrap!important; }
        #boxContainer .cell .name { min-width:0!important; max-width:100%!important; height:auto!important; min-height:20px!important; margin-top:0!important; margin-bottom:0!important; line-height:1.2!important; overflow:visible!important; text-overflow:clip!important; white-space:normal!important; display:block!important; }
        #boxContainer .cell .name .form { display:block!important; }
        #boxContainer .cell { gap:0!important; }
      }
    `;
    document.head.appendChild(style);
  };

  const installHeader = () => {
    if (!isMobile() || document.getElementById('mobileHeader')) return;
    const header = document.createElement('header');
    header.id = 'mobileHeader';
    header.innerHTML = `
      <div id="mobileHeaderTop">
        <div id="mobileHeaderBrand">
          <div id="mobileHeaderTitle">Jasper's Pokédex</div>
          <div id="mobileHeaderMoniker"></div>
        </div>
        <div id="mobileHeaderActions">
          <button id="mobileDarkModePlaceholder" type="button" disabled aria-disabled="true" aria-label="Dark mode unavailable on Mobile" title="Dark mode is currently available on Desktop only">☾</button>
        </div>
      </div>`;
    document.body.insertBefore(header, document.body.firstChild);
    const sync = document.getElementById('githubSyncWrap');
    if (sync) header.querySelector('#mobileHeaderActions').appendChild(sync);

    const tabs = document.querySelector('.tabs-container');
    if (tabs) header.appendChild(tabs);

    updateMoniker();
  };

  const updateMoniker = () => {
    const el = document.getElementById('mobileHeaderMoniker');
    const value = window.JASPER_POKEDEX_VERSION || '';
    if (el && el.textContent !== value) el.textContent = value;
  };

  const installProgress = () => {
    if (!isMobile() || document.getElementById('mobileProgressBanner')) return;
    const tabs = document.querySelector('#mobileHeader .tabs-container');
    if (!tabs || !tabs.parentNode) return;
    const banner = document.createElement('div');
    banner.id = 'mobileProgressBanner';
    banner.innerHTML = '<span class="mobile-progress-icon">i</span><span id="mobileProgressText"></span>';
    tabs.insertAdjacentElement('afterend', banner);
    updateProgress();
  };

  const installControls = () => {
    if (!isMobile()) return;
    const controls = document.querySelector('.controls-container');
    const header = document.getElementById('mobileHeader');
    if (controls && header && !header.contains(controls)) header.appendChild(controls);
  };

  const updateProgress = () => {
    const el = document.getElementById('mobileProgressText');
    const dex = window.JASPER_POKEDEX;
    if (!el || !dex?.pokemon) return;
    const state = readState(dex.game);
    const total = dex.pokemon.length;
    const done = dex.pokemon.reduce((n, p) => n + (state[p.id] === true ? 1 : 0), 0);
    el.textContent = `${done} of ${total} Pokémon registered · ${total - done} remaining · ${Math.round(done / Math.max(1, total) * 100)}% complete`;
  };

  const installViewState = () => {
    if (window.__JASPER_VIEW_STATE_133__) return;
    window.__JASPER_VIEW_STATE_133__ = true;
    window.JASPER_POKEDEX_VIEW = window.JASPER_POKEDEX_VIEW || 'box';

    const apply = () => {
      const b = document.getElementById('boxViewBtn');
      const l = document.getElementById('listViewBtn');
      const bx = document.getElementById('boxContainer');
      const ls = document.getElementById('listContainer');
      if (!b || !l || !bx || !ls) return;
      const list = window.JASPER_POKEDEX_VIEW === 'list';
      bx.style.display = list ? 'none' : 'flex';
      ls.style.display = list ? 'block' : 'none';
      b.classList.toggle('active', !list);
      l.classList.toggle('active', list);
      [b,l].forEach((button, i) => {
        const label = button.querySelector('span');
        if (label) label.textContent = i === 0 ? 'Box' : 'List';
        button.setAttribute('aria-label', i === 0 ? 'Box view' : 'List view');
        button.title = i === 0 ? 'Box view' : 'List view';
      });
    };

    document.addEventListener('click', event => {
      const button = event.target.closest('#boxViewBtn,#listViewBtn');
      if (button) {
        window.JASPER_POKEDEX_VIEW = button.id === 'listViewBtn' ? 'list' : 'box';
        setTimeout(apply, 0);
      }
      if (event.target.closest('[data-id]:not(.empty), .search-result-item')) setTimeout(updateProgress, 0);
      if (event.target.closest('.tab-btn')) setTimeout(() => { updateProgress(); apply(); updateMoniker(); }, 80);
    }, true);

    window.addEventListener('jasper:pokedex-state-synced', () => setTimeout(() => { updateProgress(); apply(); updateMoniker(); }, 80));
    window.JASPER_APPLY_VIEW_STATE = apply;
    apply();
  };

  const boot = () => {
    installStyles();
    installHeader();
    installProgress();
    installControls();
    installViewState();
    updateMoniker();
  };

  const waitForEngine = () => {
    if (!isMobile()) return;
    if (window.JASPER_POKEDEX) boot();
    else setTimeout(waitForEngine, 50);
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', waitForEngine, { once:true });
  else waitForEngine();
})();