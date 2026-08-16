(() => {
  'use strict';

  const BETA_LABEL = 'Beta v0.8';
  const STATE_KEY = 'b2w2_living_dex_saved_state';
  const isMobile = () => window.matchMedia('(max-width: 640px)').matches;

  let observerTimer = null;
  let bulkMode = false;
  let bulkBaseline = null;
  let bulkNativeSetItem = null;
  let bulkWrappedSetItem = null;
  let bulkCommitting = false;
  let bulkInstalled = false;
  let desktopInstalled = false;

  const getState = () => {
    try { return JSON.parse(localStorage.getItem(STATE_KEY) || '{}'); }
    catch { return {}; }
  };

  const setNativeStorageMode = enabled => {
    if (!bulkNativeSetItem) return;
    if (enabled) {
      if (!bulkWrappedSetItem) bulkWrappedSetItem = Storage.prototype.setItem;
      Storage.prototype.setItem = bulkNativeSetItem;
    } else if (bulkWrappedSetItem) {
      Storage.prototype.setItem = bulkWrappedSetItem;
    }
  };

  const setPill = (label, type) => {
    const pill = document.getElementById('githubSyncPill');
    const icon = document.getElementById('githubSyncIcon');
    const text = pill?.querySelector('.github-sync-label');
    if (text) text.textContent = label;
    if (pill) pill.dataset.state = type;
    if (icon) {
      icon.className = 'github-sync-icon ' + (type === 'busy' ? 'spinning' : '');
      icon.textContent = type === 'ok' ? '✓' : type === 'busy' ? '↻' : type === 'warning' ? '!' : '×';
    }
  };

  const updateBetaLabel = () => {
    const mobile = document.getElementById('pokedexBetaMoniker');
    if (mobile) mobile.textContent = BETA_LABEL;
    document.querySelectorAll('.desktop-sidebar-brand .beta').forEach(e => e.textContent = BETA_LABEL);
  };

  const updateMobileViewButtons = () => {
    [document.getElementById('boxViewBtn'), document.getElementById('listViewBtn')]
      .filter(Boolean)
      .forEach(button => {
        button.style.minWidth = isMobile() ? '80px' : '';
        button.style.flexShrink = '0';
        button.style.justifyContent = 'center';
      });
  };

  const updateMobileSearchDropdown = () => {
    const results = document.getElementById('searchResults');
    const wrapper = document.querySelector('.search-wrapper');
    if (!results || !wrapper) return;
    if (isMobile()) {
      results.style.position = 'fixed';
      results.style.left = '0';
      results.style.right = '0';
      results.style.width = '100vw';
      results.style.maxWidth = '100vw';
      results.style.top = `${wrapper.getBoundingClientRect().bottom + 4}px`;
    } else {
      ['position','left','right','width','maxWidth','top'].forEach(p => results.style[p] = '');
    }
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
      const cells = [...box.querySelectorAll('.cell:not(.empty)')];
      counter.textContent = `${cells.filter(x => x.classList.contains('completed')).length}/30`;
    });
  };

  const pendingIds = () => {
    if (!bulkBaseline) return [];
    const current = getState();
    return [...new Set([...Object.keys(bulkBaseline), ...Object.keys(current)])]
      .filter(id => !!bulkBaseline[id] !== !!current[id]);
  };

  const clearPendingVisuals = () => {
    document.querySelectorAll('.bulk-pending').forEach(el => el.classList.remove('bulk-pending'));
  };

  const refreshPendingVisuals = () => {
    clearPendingVisuals();
    if (!bulkMode || !bulkBaseline) return;
    pendingIds().forEach(id => {
      document.querySelectorAll(`[data-id="${CSS.escape(id)}"]`).forEach(el => el.classList.add('bulk-pending'));
    });
    const count = pendingIds().length;
    const countEl = document.getElementById('bulkPendingCount');
    if (countEl) countEl.textContent = `${count} pending ${count === 1 ? 'change' : 'changes'}`;
    const commit = document.getElementById('bulkCommitBtn');
    if (commit) commit.disabled = count === 0 || bulkCommitting;
    if (bulkMode) setPill('Bulk Mode', 'busy');
  };

  const updateNormalPill = () => {
    if (bulkMode) return setPill('Bulk Mode', 'busy');
    if (bulkCommitting) return setPill('Syncing...', 'busy');
    const status = document.getElementById('githubSyncStatus');
    if (!status) return;
    const type = status.dataset.type || '';
    const text = status.textContent || '';
    if (type === 'busy' || /saving|syncing|loading|verifying|unsaved/i.test(text)) setPill('Syncing...', 'busy');
    else if (type === 'error' || /failed|error|invalid|could not/i.test(text)) setPill('Sync Error', 'warning');
    else if (type === 'ok' || /synced/i.test(text)) setPill('Synced', 'ok');
    else setPill('Token Sync', 'normal');
  };

  const enterBulkMode = () => {
    if (bulkMode || bulkCommitting) return;
    bulkBaseline = JSON.parse(JSON.stringify(getState()));
    bulkWrappedSetItem = Storage.prototype.setItem;
    setNativeStorageMode(true);
    bulkMode = true;
    setBulkUI();
  };

  const cancelBulkMode = () => {
    if (!bulkMode) return;
    const baseline = JSON.parse(JSON.stringify(bulkBaseline || {}));
    setNativeStorageMode(true);
    Storage.prototype.setItem.call(localStorage, STATE_KEY, JSON.stringify(baseline));
    clearPendingVisuals();
    document.querySelectorAll('[data-id]').forEach(el => {
      const id = el.getAttribute('data-id');
      if (id) el.classList.toggle('completed', !!baseline[id]);
    });
    updateBoxCounters();
    bulkMode = false;
    bulkBaseline = null;
    setNativeStorageMode(false);
    const status = document.getElementById('githubSyncStatus');
    if (status) {
      status.textContent = 'Bulk changes cancelled. No entries were committed.';
      status.dataset.type = 'ok';
    }
    setBulkUI();
    setPill('Synced', 'ok');
  };

  const commitBulkMode = () => {
    const count = pendingIds().length;
    if (!bulkMode || bulkCommitting || count === 0) return;
    bulkCommitting = true;
    const status = document.getElementById('githubSyncStatus');
    if (status) {
      status.textContent = `Committing ${count} bulk ${count === 1 ? 'entry' : 'entries'}…`;
      status.dataset.type = 'busy';
    }
    setPill('Syncing...', 'busy');
    setNativeStorageMode(false);
    localStorage.setItem(STATE_KEY, JSON.stringify(getState()));
    bulkMode = false;
    bulkBaseline = null;
    clearPendingVisuals();
    window.setTimeout(() => {
      bulkCommitting = false;
      updateNormalPill();
    }, 1800);
  };

  const setBulkUI = () => {
    const toggle = document.getElementById('bulkModeToggle');
    const actions = document.getElementById('bulkActions');
    if (toggle) toggle.checked = bulkMode;
    if (actions) actions.hidden = !bulkMode;
    updateNormalPill();
    refreshPendingVisuals();
  };

  const installBulkMode = () => {
    if (bulkInstalled) return;
    const menu = document.getElementById('githubSyncMenu');
    if (!menu) return;
    bulkInstalled = true;
    bulkWrappedSetItem = Storage.prototype.setItem;
    try {
      const iframe = document.createElement('iframe');
      iframe.style.display = 'none';
      document.documentElement.appendChild(iframe);
      bulkNativeSetItem = iframe.contentWindow.Storage.prototype.setItem;
      iframe.remove();
    } catch { bulkNativeSetItem = null; }

    const separator = document.createElement('div');
    separator.className = 'bulk-separator';
    const section = document.createElement('div');
    section.id = 'bulkModeSection';
    section.innerHTML = `
      <label class="bulk-toggle-row">
        <span><strong>Bulk Mode</strong><small>Hold all entry changes until you manually commit them.</small></span>
        <input id="bulkModeToggle" type="checkbox" aria-label="Enable Bulk Mode">
      </label>
      <div id="bulkActions" hidden>
        <div id="bulkPendingCount">0 pending changes</div>
        <div class="bulk-action-buttons">
          <button id="bulkCommitBtn" type="button" disabled>Commit Bulk Entries</button>
          <button id="bulkCancelBtn" type="button">Cancel</button>
        </div>
      </div>`;
    menu.append(separator, section);

    document.getElementById('bulkModeToggle').addEventListener('change', e => e.target.checked ? enterBulkMode() : cancelBulkMode());
    document.getElementById('bulkCommitBtn').addEventListener('click', e => { e.stopPropagation(); commitBulkMode(); });
    document.getElementById('bulkCancelBtn').addEventListener('click', e => {
      e.stopPropagation();
      const toggle = document.getElementById('bulkModeToggle');
      if (toggle) toggle.checked = false;
      cancelBulkMode();
    });

    const status = document.getElementById('githubSyncStatus');
    if (status) new MutationObserver(updateNormalPill).observe(status, { childList:true, characterData:true, subtree:true, attributes:true });
    document.addEventListener('click', e => {
      if (!bulkMode || bulkCommitting) return;
      const target = e.target.closest('.cell:not(.empty), .list-row, .search-result-item');
      if (!target) return;
      window.setTimeout(refreshPendingVisuals, 0);
    }, true);
    setBulkUI();
  };

  const localizePokedexTerms = () => {
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    const nodes = [];
    while (walker.nextNode()) nodes.push(walker.currentNode);
    nodes.forEach(node => {
      if (!node.parentElement || /^(SCRIPT|STYLE|INPUT|TEXTAREA)$/i.test(node.parentElement.tagName)) return;
      node.nodeValue = node.nodeValue.replace(/Pok[eé]dex/gi, match => match[0] === 'P' ? 'Pokédex' : 'pokédex')
        .replace(/Pokemon/gi, match => match[0] === 'P' ? 'Pokémon' : 'pokémon');
    });
  };

  const installDesktopLayout = () => {
    if (isMobile() || desktopInstalled) return;
    desktopInstalled = true;

    const sidebar = document.getElementById('desktopSidebar') || document.createElement('aside');
    sidebar.id = 'desktopSidebar';
    sidebar.innerHTML = `
      <div class="desktop-sidebar-brand">
        <div class="brand-title">Jasper's Pokédex</div>
        <div class="beta">${BETA_LABEL}</div>
      </div>
      <div class="desktop-sidebar-separator"></div>
      <div class="desktop-sidebar-subheader">Titles</div>
      <button class="desktop-game-btn active" type="button">Pokémon White 2</button>
      <button class="desktop-game-btn disabled" type="button" disabled>Pokémon Alpha Sapphire</button>
      <button class="desktop-game-btn disabled" type="button" disabled>Pokémon Sun</button>`;
    if (!sidebar.parentElement) document.body.appendChild(sidebar);

    const workspace = document.getElementById('desktopWorkspace') || document.createElement('main');
    workspace.id = 'desktopWorkspace';
    if (!workspace.parentElement) document.body.appendChild(workspace);

    const originalH1 = document.querySelector('body > h1');
    if (originalH1) originalH1.style.display = 'none';
    const tabs = document.querySelector('.tabs-container');
    if (tabs) tabs.style.display = 'none';
    const header = document.getElementById('pokedexHeader');
    if (header) header.style.display = 'none';

    let top = document.getElementById('desktopWorkspaceTop');
    if (!top) {
      top = document.createElement('div');
      top.id = 'desktopWorkspaceTop';
      workspace.appendChild(top);
    }

    let title = document.getElementById('desktopWorkspaceTitle');
    if (!title) {
      title = document.createElement('h1');
      title.id = 'desktopWorkspaceTitle';
      top.appendChild(title);
    }
    title.textContent = 'Pokémon White 2';

    const table = document.getElementById('desktopTableContainer') || document.createElement('section');
    table.id = 'desktopTableContainer';
    if (!table.parentElement) workspace.appendChild(table);

    const controls = document.querySelector('.controls-container');
    if (controls) table.appendChild(controls);

    const main = document.querySelector('.main-content');
    if (main) table.appendChild(main);

    const relocate = () => {
      const sync = document.getElementById('githubSyncWrap');
      if (sync && sync.parentElement !== top) top.appendChild(sync);
      const banner = document.getElementById('dexProgressBanner');
      if (banner && banner.parentElement !== workspace) {
        workspace.insertBefore(banner, table);
      }
      installBulkMode();
      updateNormalPill();
    };

    relocate();
    const observer = new MutationObserver(relocate);
    observer.observe(document.body, { childList:true, subtree:true });
    window.setTimeout(relocate, 50);
    window.setTimeout(relocate, 250);
    localizePokedexTerms();
  };

  const injectStyles = () => {
    if (document.getElementById('beta071Styles')) return;
    const style = document.createElement('style');
    style.id = 'beta071Styles';
    style.textContent = `
      #pokedexBetaMoniker{min-height:1em}
      .box-title{display:flex!important;align-items:center;justify-content:space-between;gap:12px}
      .box-completion-counter{margin-left:auto;flex-shrink:0;font-size:.78rem;font-weight:700;color:#64748b;white-space:nowrap}
      .bulk-separator{border-top:1px solid #e2e8f0;margin:12px 0}
      .bulk-toggle-row{display:flex;align-items:center;justify-content:space-between;gap:12px;cursor:pointer}
      .bulk-toggle-row span{display:flex;flex-direction:column;gap:3px}
      .bulk-toggle-row strong{color:#1e293b;font-size:.82rem}
      .bulk-toggle-row small{color:#64748b;font-size:.72rem;line-height:1.35}
      #bulkModeToggle{width:38px;height:20px;flex-shrink:0;accent-color:#2563eb;cursor:pointer}
      #bulkActions{margin-top:10px}#bulkPendingCount{color:#2563eb;font-size:.76rem;font-weight:700;margin-bottom:8px}
      .bulk-action-buttons{display:flex;gap:8px}#bulkActions button{flex:1;padding:9px 10px;border:1px solid #cbd5e1;border-radius:7px;background:#f8fafc;font-weight:700;cursor:pointer}
      #bulkCommitBtn{background:#eff6ff!important;border-color:#93c5fd!important;color:#1d4ed8}#bulkCommitBtn:disabled{opacity:.45;cursor:not-allowed}
      .bulk-pending{background:#eff6ff!important;border-color:#60a5fa!important;opacity:1!important}
      .bulk-pending .checkbox{background:#3b82f6!important;border-color:#3b82f6!important;position:relative}
      .bulk-pending .checkbox::after{content:"↻";display:block!important;color:#fff!important;font-size:11px;animation:bulkSpin 1s linear infinite}
      .bulk-pending.completed .checkbox{background:#3b82f6!important;border-color:#3b82f6!important}.bulk-pending.completed .checkbox::after{content:"↻"!important}
      @keyframes bulkSpin{from{transform:rotate(0)}to{transform:rotate(360deg)}}

      @media(min-width:641px){
        html,body{height:100%;overflow:hidden!important}
        body{padding:0!important;margin:0!important;background:#f1f5f9}
        #desktopSidebar{position:fixed;left:0;top:0;bottom:0;width:272px;background:#fff;border-right:1px solid #cbd5e1;padding:28px 20px;z-index:8000;box-shadow:3px 0 14px rgba(15,23,42,.05)}
        .desktop-sidebar-brand .brand-title{font-size:1.45rem;font-weight:700;color:#0f172a;line-height:1.2}
        .desktop-sidebar-brand .beta{margin-top:4px;color:#475569;font-size:.9rem;font-weight:600}
        .desktop-sidebar-separator{height:2px;background:#e2e8f0;margin:24px 0}
        .desktop-sidebar-subheader{font-size:.75rem;letter-spacing:.08em;color:#64748b;font-weight:700;margin-bottom:10px}
        .desktop-game-btn{display:block;width:100%;text-align:left;padding:11px 12px;margin:6px 0;border:1px solid #cbd5e1;border-radius:8px;background:#fff;color:#334155;font-weight:650;cursor:pointer}
        .desktop-game-btn.active{background:#eff6ff;border-color:#93c5fd;color:#1d4ed8}.desktop-game-btn.disabled{background:#f1f5f9;color:#94a3b8;cursor:not-allowed}

        #desktopWorkspace{position:fixed;left:272px;right:0;top:0;bottom:0;display:flex;flex-direction:column;min-width:0;min-height:0;padding:24px 32px 28px;overflow:hidden}
        #desktopWorkspaceTop{display:flex;align-items:center;justify-content:space-between;gap:16px;flex:0 0 auto;position:relative;z-index:11000;margin-bottom:16px;overflow:visible}
        #desktopWorkspaceTitle{margin:0;font-size:1.45rem;line-height:1.2;color:#0f172a;text-align:left}

        #desktopWorkspace #dexProgressBanner{flex:0 0 auto;margin:0 0 16px!important}
        #desktopTableContainer{display:flex;flex-direction:column;min-width:0;min-height:0;flex:1 1 auto;background:#fff;border:1px solid #cbd5e1;border-radius:14px;padding:16px;box-shadow:0 4px 12px rgba(15,23,42,.06);overflow:hidden}
        #desktopTableContainer .controls-container{max-width:none!important;width:100%;margin:0 0 14px!important;flex:0 0 auto;z-index:9000}
        #desktopTableContainer .main-content{display:block!important;max-width:none!important;width:100%;margin:0;flex:1 1 auto;min-height:0;overflow-y:auto;overflow-x:hidden;padding:0 4px 28px 0}
        #desktopTableContainer .box-container{padding-bottom:10px}
        #desktopWorkspace #githubSyncWrap{position:relative;z-index:12000;flex-shrink:0}
        #desktopWorkspace #githubSyncMenu{z-index:13000}
        #desktopWorkspace .search-results{z-index:12500}
        #desktopWorkspace .grid-wrapper{overflow-x:auto}
      }

      @media(max-width:640px){
        .toggle-btn{min-width:80px!important;flex-shrink:0;justify-content:center}
        #searchResults{position:fixed!important;left:0!important;right:0!important;width:100vw!important;max-width:100vw!important;z-index:10000!important}
      }
    `;
    document.head.appendChild(style);
  };

  const scheduleBoxRefresh = () => {
    if (observerTimer !== null) return;
    observerTimer = window.setTimeout(() => { observerTimer = null; updateBoxCounters(); }, 50);
  };

  const refresh = () => {
    updateBetaLabel();
    updateMobileViewButtons();
    updateMobileSearchDropdown();
    updateBoxCounters();
    updateNormalPill();
    if (!isMobile()) installDesktopLayout();
  };

  const installObservers = () => {
    const container = document.getElementById('boxContainer');
    if (container) {
      new MutationObserver(scheduleBoxRefresh).observe(container, {
        childList:true, subtree:true, attributes:true, attributeFilter:['class']
      });
    }
    window.addEventListener('resize', () => {
      if (isMobile()) {
        desktopInstalled = false;
        document.getElementById('desktopSidebar')?.remove();
        document.getElementById('desktopWorkspace')?.remove();
      } else {
        installDesktopLayout();
      }
      refresh();
    }, { passive:true });
    window.addEventListener('scroll', () => {
      if (isMobile()) updateMobileSearchDropdown();
    }, { passive:true });
  };

  const start = () => {
    injectStyles();
    refresh();
    installObservers();
    installBulkMode();
    localizePokedexTerms();
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once:true });
  else start();
})();
