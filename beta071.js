(() => {
  'use strict';

  const BETA_LABEL = 'Beta v0.7.3';
  const STATE_KEY = 'b2w2_living_dex_saved_state';
  const isMobile = () => window.matchMedia('(max-width: 640px)').matches;
  let observerTimer = null;
  let bulkMode = false;
  let bulkBaseline = null;
  let bulkNativeSetItem = null;
  let bulkWrappedSetItem = null;
  let bulkCommitting = false;

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

  function updateBetaLabel() {
    const label = document.getElementById('pokedexBetaMoniker');
    if (label && label.textContent !== BETA_LABEL) label.textContent = BETA_LABEL;
  }

  function updateMobileViewButtons() {
    const buttons = [document.getElementById('boxViewBtn'), document.getElementById('listViewBtn')].filter(Boolean);
    buttons.forEach(button => {
      const minWidth = isMobile() ? '80px' : '';
      if (button.style.minWidth !== minWidth) button.style.minWidth = minWidth;
      if (button.style.flexShrink !== '0') button.style.flexShrink = '0';
      if (button.style.justifyContent !== 'center') button.style.justifyContent = 'center';
    });
  }

  function updateMobileSearchDropdown() {
    const results = document.getElementById('searchResults');
    const wrapper = document.querySelector('.search-wrapper');
    if (!results || !wrapper) return;

    if (isMobile()) {
      results.style.position = 'fixed';
      results.style.left = '0';
      results.style.right = '0';
      results.style.width = '100vw';
      results.style.maxWidth = '100vw';
      results.style.marginTop = '4px';
      const rect = wrapper.getBoundingClientRect();
      results.style.top = `${rect.bottom + 4}px`;
    } else {
      results.style.position = '';
      results.style.left = '';
      results.style.right = '';
      results.style.width = '';
      results.style.maxWidth = '';
      results.style.marginTop = '';
      results.style.top = '';
    }
  }

  function updateBoxCounters() {
    const container = document.getElementById('boxContainer');
    if (!container) return;

    container.querySelectorAll('.pc-box').forEach(box => {
      const title = box.querySelector('.box-title');
      if (!title) return;

      let counter = title.querySelector('.box-completion-counter');
      if (!counter) {
        counter = document.createElement('span');
        counter.className = 'box-completion-counter';
        title.appendChild(counter);
      }

      const cells = [...box.querySelectorAll('.cell')];
      const pokemonCells = cells.filter(cell => !cell.classList.contains('empty'));
      const completed = pokemonCells.filter(cell => cell.classList.contains('completed')).length;
      const nextText = `${completed}/30`;
      if (counter.textContent !== nextText) counter.textContent = nextText;
    });
  }

  function setPillLabel(label) {
    const el = document.querySelector('#githubSyncPill .github-sync-label');
    if (el) el.textContent = label;
  }

  function updatePillLabelFromStatus() {
    if (bulkMode) {
      setPillLabel('Bulk Mode');
      return;
    }
    if (bulkCommitting) {
      setPillLabel('Syncing...');
      return;
    }
    const status = document.getElementById('githubSyncStatus');
    if (!status) return;
    const type = status.dataset.type || '';
    const text = status.textContent || '';
    if (type === 'busy' || /saving|syncing|loading|verifying|unsaved/i.test(text)) setPillLabel('Syncing...');
    else if (type === 'error' || /failed|error|invalid|could not/i.test(text)) setPillLabel('Sync Error');
    else if (type === 'ok' || /synced/i.test(text)) setPillLabel('Synced');
    else setPillLabel('Token Sync');
  }

  function clearPendingVisuals() {
    document.querySelectorAll('.bulk-pending').forEach(el => el.classList.remove('bulk-pending'));
  }

  function refreshPendingVisuals() {
    clearPendingVisuals();
    if (!bulkMode || !bulkBaseline) return;
    const current = getState();
    const changedIds = new Set();
    const ids = new Set([...Object.keys(bulkBaseline), ...Object.keys(current)]);
    ids.forEach(id => {
      if (!!bulkBaseline[id] !== !!current[id]) changedIds.add(id);
    });
    changedIds.forEach(id => {
      document.querySelectorAll(`[data-id="${CSS.escape(id)}"]`).forEach(el => el.classList.add('bulk-pending'));
    });
    const count = changedIds.size;
    const countEl = document.getElementById('bulkPendingCount');
    if (countEl) countEl.textContent = `${count} pending ${count === 1 ? 'change' : 'changes'}`;
    const commit = document.getElementById('bulkCommitBtn');
    if (commit) commit.disabled = count === 0 || bulkCommitting;
  }

  function pendingCount() {
    if (!bulkBaseline) return 0;
    const current = getState();
    const ids = new Set([...Object.keys(bulkBaseline), ...Object.keys(current)]);
    let count = 0;
    ids.forEach(id => { if (!!bulkBaseline[id] !== !!current[id]) count++; });
    return count;
  }

  function setBulkToggleUI() {
    const toggle = document.getElementById('bulkModeToggle');
    if (toggle) toggle.checked = bulkMode;
    const section = document.getElementById('bulkActions');
    if (section) section.hidden = !bulkMode;
    updatePillLabelFromStatus();
    refreshPendingVisuals();
  }

  function enterBulkMode() {
    if (bulkMode || bulkCommitting) return;
    bulkBaseline = JSON.parse(JSON.stringify(getState()));
    bulkWrappedSetItem = Storage.prototype.setItem;
    setNativeStorageMode(true);
    bulkMode = true;
    setBulkToggleUI();
  }

  function exitBulkModeWithoutCommit() {
    if (!bulkMode) return;
    setNativeStorageMode(true);
    if (bulkBaseline) {
      const baseline = JSON.stringify(bulkBaseline);
      Storage.prototype.setItem.call(localStorage, STATE_KEY, baseline);
    }
    clearPendingVisuals();
    bulkMode = false;
    bulkBaseline = null;
    setNativeStorageMode(false);
    setBulkToggleUI();
    const status = document.getElementById('githubSyncStatus');
    if (status) {
      status.textContent = 'Bulk changes cancelled. No entries were committed.';
      status.dataset.type = 'ok';
    }
    updatePillLabelFromStatus();
  }

  function commitBulkMode() {
    if (!bulkMode || bulkCommitting || pendingCount() === 0) return;
    bulkCommitting = true;
    const count = pendingCount();
    const status = document.getElementById('githubSyncStatus');
    if (status) {
      status.textContent = `Committing ${count} bulk ${count === 1 ? 'entry' : 'entries'}…`;
      status.dataset.type = 'busy';
    }
    setPillLabel('Syncing...');
    setBulkToggleUI();

    // Restore github-sync.js's save wrapper, then perform one localStorage write.
    // That single write schedules one GitHub save for the complete bulk operation.
    setNativeStorageMode(false);
    const current = JSON.stringify(getState());
    localStorage.setItem(STATE_KEY, current);
    bulkMode = false;
    bulkBaseline = null;
    clearPendingVisuals();

    window.setTimeout(() => {
      bulkCommitting = false;
      const currentStatus = document.getElementById('githubSyncStatus');
      const type = currentStatus?.dataset.type || '';
      if (type === 'error') setPillLabel('Sync Error');
      else setPillLabel('Synced');
      setBulkToggleUI();
    }, 1800);
  }

  function installBulkMode() {
    // github-sync.js installs its own Storage.prototype.setItem wrapper. Capture
    // that wrapper and obtain a clean native implementation from another realm.
    bulkWrappedSetItem = Storage.prototype.setItem;
    try {
      const iframe = document.createElement('iframe');
      iframe.style.display = 'none';
      document.documentElement.appendChild(iframe);
      bulkNativeSetItem = iframe.contentWindow.Storage.prototype.setItem;
      iframe.remove();
    } catch {
      bulkNativeSetItem = null;
    }

    const menu = document.getElementById('githubSyncMenu');
    if (!menu || document.getElementById('bulkModeSection')) return;

    const separator = document.createElement('div');
    separator.className = 'bulk-separator';

    const section = document.createElement('div');
    section.id = 'bulkModeSection';
    section.innerHTML = `
      <label class="bulk-toggle-row">
        <span>
          <strong>Bulk Mode</strong>
          <small>Hold all entry changes until you manually commit them.</small>
        </span>
        <input id="bulkModeToggle" type="checkbox" aria-label="Enable Bulk Mode">
      </label>
      <div id="bulkActions" hidden>
        <div id="bulkPendingCount">0 pending changes</div>
        <div class="bulk-action-buttons">
          <button id="bulkCommitBtn" type="button" disabled>Commit Bulk Entries</button>
          <button id="bulkCancelBtn" type="button">Cancel</button>
        </div>
      </div>
    `;
    menu.appendChild(separator);
    menu.appendChild(section);

    document.getElementById('bulkModeToggle').addEventListener('change', e => {
      if (e.target.checked) enterBulkMode();
      else exitBulkModeWithoutCommit();
    });
    document.getElementById('bulkCommitBtn').addEventListener('click', e => {
      e.stopPropagation();
      commitBulkMode();
    });
    document.getElementById('bulkCancelBtn').addEventListener('click', e => {
      e.stopPropagation();
      const toggle = document.getElementById('bulkModeToggle');
      if (toggle) toggle.checked = false;
      exitBulkModeWithoutCommit();
    });

    const status = document.getElementById('githubSyncStatus');
    if (status) {
      new MutationObserver(updatePillLabelFromStatus).observe(status, { childList: true, characterData: true, subtree: true, attributes: true });
    }

    document.addEventListener('click', e => {
      if (!bulkMode || bulkCommitting) return;
      const target = e.target.closest('.cell:not(.empty), .list-row, .search-result-item');
      if (!target) return;
      window.setTimeout(refreshPendingVisuals, 0);
    }, true);

    setBulkToggleUI();
  }

  function injectStyles() {
    if (document.getElementById('beta071Styles')) return;
    const style = document.createElement('style');
    style.id = 'beta071Styles';
    style.textContent = `
      #pokedexBetaMoniker { min-height: 1em; }
      #pokedexHeaderInner { padding-top: 24px !important; padding-bottom: 24px !important; }
      .box-title {
        display: flex !important;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
      }
      .box-completion-counter {
        margin-left: auto;
        flex-shrink: 0;
        font-size: 0.78rem;
        font-weight: 700;
        color: #64748b;
        white-space: nowrap;
      }
      .bulk-separator { border-top: 1px solid #e2e8f0; margin: 12px 0; }
      .bulk-toggle-row { display:flex; align-items:center; justify-content:space-between; gap:12px; cursor:pointer; }
      .bulk-toggle-row span { display:flex; flex-direction:column; gap:3px; }
      .bulk-toggle-row strong { color:#1e293b; font-size:.82rem; }
      .bulk-toggle-row small { color:#64748b; font-size:.72rem; line-height:1.35; }
      #bulkModeToggle { width:38px; height:20px; flex-shrink:0; accent-color:#2563eb; cursor:pointer; }
      #bulkActions { margin-top:10px; }
      #bulkPendingCount { color:#2563eb; font-size:.76rem; font-weight:700; margin-bottom:8px; }
      .bulk-action-buttons { display:flex; gap:8px; }
      #bulkActions button { flex:1; padding:9px 10px; border:1px solid #cbd5e1; border-radius:7px; background:#f8fafc; font-weight:700; cursor:pointer; }
      #bulkCommitBtn { background:#eff6ff !important; border-color:#93c5fd !important; color:#1d4ed8; }
      #bulkCommitBtn:disabled { opacity:.45; cursor:not-allowed; }
      #bulkCancelBtn { color:#475569; }
      .bulk-pending { background:#eff6ff !important; border-color:#60a5fa !important; opacity:1 !important; }
      .bulk-pending .checkbox { background:#3b82f6 !important; border-color:#3b82f6 !important; position:relative; }
      .bulk-pending .checkbox::after { content:"↻"; display:block !important; color:#fff !important; font-size:11px; animation:bulkSpin 1s linear infinite; }
      .bulk-pending.completed .checkbox { background:#3b82f6 !important; border-color:#3b82f6 !important; }
      .bulk-pending.completed .checkbox::after { content:"↻" !important; }
      @keyframes bulkSpin { from { transform:rotate(0deg); } to { transform:rotate(360deg); } }
      @media (max-width: 640px) {
        .toggle-btn { min-width: 80px !important; flex-shrink: 0; justify-content: center; }
        #searchResults {
          position: fixed !important;
          left: 0 !important;
          right: 0 !important;
          width: 100vw !important;
          max-width: 100vw !important;
          z-index: 10000 !important;
        }
      }
    `;
    document.head.appendChild(style);
  }

  function scheduleBoxRefresh() {
    if (observerTimer !== null) return;
    observerTimer = window.setTimeout(() => {
      observerTimer = null;
      updateBoxCounters();
    }, 50);
  }

  function installObservers() {
    const container = document.getElementById('boxContainer');
    if (container) {
      const observer = new MutationObserver(scheduleBoxRefresh);
      observer.observe(container, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ['class']
      });
    }

    window.addEventListener('resize', refresh, { passive: true });
    window.addEventListener('scroll', () => {
      const results = document.getElementById('searchResults');
      if (isMobile() && results && results.style.display !== 'none') updateMobileSearchDropdown();
    }, { passive: true });
  }

  function refresh() {
    updateBetaLabel();
    updateMobileViewButtons();
    updateMobileSearchDropdown();
    updateBoxCounters();
    updatePillLabelFromStatus();
  }

  function start() {
    injectStyles();
    refresh();
    installObservers();
    installBulkMode();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
  else start();
})();
