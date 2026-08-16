(() => {
  'use strict';

  if (window.__JASPER_STABILIZATION_094__) return;
  window.__JASPER_STABILIZATION_094__ = true;

  const STATE_KEY = 'b2w2_living_dex_saved_state';
  const TOTAL_DEX = 300;

  // These are intentionally separate, boxable forms in the current B2W2 Dex.
  // Legacy cleanup in github-sync.js may otherwise collapse them to one entry.
  const PROTECTED_FORMS = [
    { id: '297-Normal', num: '297', name: 'Kyurem (Normal)', form: '(Normal)' },
    { id: '297-Black', num: '297', name: 'Kyurem (Black)', form: '(Black)' },
    { id: '297-White', num: '297', name: 'Kyurem (White)', form: '(White)' },
    { id: '298-Ordinary', num: '298', name: 'Keldeo (Ordinary)', form: '(Ordinary)' },
    { id: '298-Resolute', num: '298', name: 'Keldeo (Resolute)', form: '(Resolute)' },
    { id: '300-NoDrive', num: '300', name: 'Genesect (No Drive)', form: '(No Drive)' },
    { id: '300-Burn', num: '300', name: 'Genesect (Burn)', form: '(Burn)' },
    { id: '300-Shock', num: '300', name: 'Genesect (Shock)', form: '(Shock)' },
    { id: '300-Chill', num: '300', name: 'Genesect (Chill)', form: '(Chill)' },
    { id: '300-Douse', num: '300', name: 'Genesect (Douse)', form: '(Douse)' }
  ];

  const readState = () => {
    try {
      return JSON.parse(localStorage.getItem(STATE_KEY) || '{}');
    } catch {
      return {};
    }
  };

  const updateProgress = () => {
    const banner = document.getElementById('dexProgressBanner');
    if (!banner) return;

    const text = banner.querySelector('.dex-progress-text');
    if (!text) return;

    const state = readState();
    const cells = [...document.querySelectorAll('#boxContainer .cell[data-id]:not(.empty)')];
    const completed = cells.filter(cell => state[cell.dataset.id] === true).length;
    const registered = Math.min(TOTAL_DEX, completed);

    text.textContent =
      `${registered} of ${TOTAL_DEX} Pokémon registered · ` +
      `${TOTAL_DEX - registered} remaining · ` +
      `${Math.round(registered / TOTAL_DEX * 100)}% complete`;
  };

  const syncUI = () => {
    const state = readState();

    document.querySelectorAll('.cell[data-id]:not(.empty)').forEach(cell => {
      cell.classList.toggle('completed', state[cell.dataset.id] === true);
    });

    document.querySelectorAll('.list-row[data-id], .search-result-item[data-id]').forEach(row => {
      row.classList.toggle('completed', state[row.dataset.id] === true);
    });

    updateProgress();
  };

  // github-sync.js also observes localStorage. Wrap it without taking control
  // away from that sync layer, so Box/List/Search remain visually consistent.
  const originalSetItem = Storage.prototype.setItem;
  if (!window.__JASPER_STABILIZATION_STORAGE_PATCH__) {
    window.__JASPER_STABILIZATION_STORAGE_PATCH__ = true;

    Storage.prototype.setItem = function (key, value) {
      originalSetItem.call(this, key, value);
      if (this === localStorage && key === STATE_KEY) {
        queueMicrotask(syncUI);
      }
    };
  }

  const injectRefinementStyles = () => {
    if (document.getElementById('stabilization094Styles')) return;

    const style = document.createElement('style');
    style.id = 'stabilization094Styles';
    style.textContent = `
      /* v0.9.4: consistent name → checkmark spacing on every viewport */
      #boxContainer .cell .checkbox {
        margin-top: 4px !important;
      }

      /* Keep the list/search checkmark alignment consistent with Box View. */
      .list-row > .checkbox,
      .search-result-item > .checkbox {
        flex-shrink: 0;
      }
    `;
    document.head.appendChild(style);
  };

  const ensureProtectedForms = () => {
    const grids = [...document.querySelectorAll('#boxContainer .pc-box .grid')];
    const grid = grids.find(candidate =>
      candidate.closest('.pc-box')?.querySelector('.box-title')?.textContent.includes('Box 11')
    ) || grids[grids.length - 1];
    if (!grid) return;

    const existing = new Set(
      [...grid.querySelectorAll('.cell[data-id]')].map(cell => cell.dataset.id)
    );

    PROTECTED_FORMS.forEach(form => {
      if (existing.has(form.id)) return;

      const cell = document.createElement('div');
      cell.className = 'cell';
      cell.dataset.id = form.id;
      cell.dataset.num = form.num;
      cell.dataset.name = form.name;
      cell.innerHTML = `
        <span class="dex-num">${form.num}</span>
        <span class="name">${form.name.split(' (')[0]} <span class="form">${form.form}</span></span>
        <div class="checkbox"></div>
      `;

      const firstEmpty = grid.querySelector('.cell.empty');
      if (firstEmpty) grid.insertBefore(cell, firstEmpty);
      else grid.appendChild(cell);
    });
  };

  const installParityGuard = () => {
    const box = document.getElementById('boxContainer');
    if (!box || box.dataset.stabilizationObserved) return;

    box.dataset.stabilizationObserved = '1';

    const observer = new MutationObserver(() => {
      ensureProtectedForms();
      syncUI();
    });

    observer.observe(box, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['class']
    });
  };

  // Run once immediately because github-sync.js is loaded after this file and
  // may prune forms before DOMContentLoaded. The observer restores them before
  // the main List View builder runs.
  ensureProtectedForms();
  installParityGuard();
  syncUI();

  const boot = () => {
    injectRefinementStyles();
    ensureProtectedForms();
    syncUI();
    installParityGuard();
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot, { once: true });
  } else {
    boot();
  }
})();
