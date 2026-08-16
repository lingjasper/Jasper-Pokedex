(() => {
  'use strict';

  if (window.__JASPER_STABILIZATION_095__) return;
  window.__JASPER_STABILIZATION_095__ = true;

  // Project-wide Living Dex policy:
  // one slot represents one obtainable, boxable Pokémon specimen.
  // Transformations and alternate battle/state appearances do not receive
  // separate slots unless the game makes them separately obtainable and
  // boxable as distinct specimens. This policy is intended to carry forward
  // to every supported Pokémon game.
  window.JASPER_LIVING_DEX_FORM_POLICY = 'one-slot-per-obtainable-boxable-specimen';

  const STATE_KEY = 'b2w2_living_dex_saved_state';
  const TOTAL_DEX = 300;

  // B2W2 application of the project-wide form policy.
  const FORM_GROUPS = {
    '297': {
      ids: ['297', '297-Normal', '297-Black', '297-White'],
      name: 'Kyurem'
    },
    '298': {
      ids: ['298', '298-Ordinary', '298-Resolute'],
      name: 'Keldeo'
    },
    '300': {
      ids: ['300', '300-NoDrive', '300-Burn', '300-Shock', '300-Chill', '300-Douse'],
      name: 'Genesect'
    }
  };

  const aliasToCanonical = new Map();
  Object.entries(FORM_GROUPS).forEach(([canonical, group]) => {
    group.ids.forEach(id => aliasToCanonical.set(id, canonical));
  });

  const readState = () => {
    try {
      return JSON.parse(localStorage.getItem(STATE_KEY) || '{}');
    } catch {
      return {};
    }
  };

  const writeState = state => {
    localStorage.setItem(STATE_KEY, JSON.stringify(state));
  };

  const migrateFormState = () => {
    const state = readState();
    let changed = false;

    Object.entries(FORM_GROUPS).forEach(([canonical, group]) => {
      if (group.ids.some(id => id !== canonical && state[id] === true)) {
        state[canonical] = true;
      }

      group.ids.forEach(id => {
        if (id !== canonical && Object.prototype.hasOwnProperty.call(state, id)) {
          delete state[id];
          changed = true;
        }
      });
    });

    if (changed) writeState(state);
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

  const setCanonicalStatus = (id, completed) => {
    const canonical = aliasToCanonical.get(id) || id;
    const state = readState();
    state[canonical] = completed;

    const group = FORM_GROUPS[canonical];
    if (group) {
      group.ids.forEach(alias => {
        if (alias !== canonical) delete state[alias];
      });
    }

    writeState(state);
    syncUI();
  };

  // Keep github-sync.js's localStorage synchronization intact while ensuring
  // Box/List/Search repaint immediately after a local state change.
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

  const setBetaMoniker = () => {
    const version = 'Beta v0.9.5';
    const heading = document.querySelector('h1');
    if (heading) heading.textContent = `Jasper's Pokedex — ${version}`;
    document.title = `Jasper's Pokedex — ${version}`;
  };

  const injectRefinementStyles = () => {
    if (document.getElementById('stabilization095Styles')) return;

    const style = document.createElement('style');
    style.id = 'stabilization095Styles';
    style.textContent = `
      #boxContainer .cell .checkbox {
        margin-top: 4px !important;
      }

      .list-row > .checkbox,
      .search-result-item > .checkbox {
        flex-shrink: 0;
      }
    `;
    document.head.appendChild(style);
  };

  const canonicalizeCell = (cell, canonical, name) => {
    cell.dataset.id = canonical;
    cell.dataset.num = canonical;
    cell.dataset.name = name;
    cell.classList.remove('completed');

    const dex = cell.querySelector('.dex-num');
    if (dex) dex.textContent = canonical;

    const nameEl = cell.querySelector('.name');
    if (nameEl) nameEl.textContent = name;
  };

  const pruneAndNormalizeBoxForms = () => {
    Object.entries(FORM_GROUPS).forEach(([canonical, group]) => {
      const matches = [...document.querySelectorAll(
        `#boxContainer .cell[data-id][data-num="${canonical}"]`
      )].filter(cell => !cell.classList.contains('empty'));

      const aliases = [...document.querySelectorAll(
        `#boxContainer .cell[data-id]`
      )].filter(cell => !cell.classList.contains('empty') && group.ids.includes(cell.dataset.id));

      const candidates = [...new Set([...matches, ...aliases])];
      if (!candidates.length) return;

      const keeper = candidates.find(cell => cell.dataset.id === canonical) || candidates[0];
      canonicalizeCell(keeper, canonical, group.name);

      candidates.forEach(cell => {
        if (cell !== keeper) cell.remove();
      });
    });
  };

  const normalizeListRows = () => {
    Object.entries(FORM_GROUPS).forEach(([canonical, group]) => {
      const rows = [...document.querySelectorAll('.list-row[data-id]')]
        .filter(row => group.ids.includes(row.dataset.id));

      if (!rows.length) return;

      const keeper = rows.find(row => row.dataset.id === canonical) || rows[0];
      keeper.dataset.id = canonical;
      keeper.dataset.canonicalFormCorrection = '1';

      const num = keeper.querySelector('.dex-num');
      if (num) num.textContent = `#${canonical}`;

      const name = keeper.querySelector('.name');
      if (name) name.textContent = group.name;

      rows.forEach(row => {
        if (row !== keeper) row.remove();
      });
    });
  };

  const normalizeSearchResults = () => {
    Object.entries(FORM_GROUPS).forEach(([canonical, group]) => {
      const items = [...document.querySelectorAll('.search-result-item[data-id]')]
        .filter(item => group.ids.includes(item.dataset.id));

      if (!items.length) return;

      const keeper = items.find(item => item.dataset.id === canonical) || items[0];
      keeper.dataset.id = canonical;
      keeper.dataset.canonicalFormCorrection = '1';

      const num = keeper.querySelector('.dex-num');
      if (num) num.textContent = `#${canonical}`;

      const name = keeper.querySelector('.name');
      if (name) name.textContent = group.name;

      items.forEach(item => {
        if (item !== keeper) item.remove();
      });
    });
  };

  const normalizeAllForms = () => {
    migrateFormState();
    pruneAndNormalizeBoxForms();
    normalizeListRows();
    normalizeSearchResults();
    syncUI();
  };

  // The original page builds List View from the raw HTML during DOMContentLoaded.
  // This correction runs immediately afterward and also watches dynamically
  // generated search results so alternate-form aliases can never reappear.
  const installFormGuard = () => {
    if (document.documentElement.dataset.stabilization095Guard) return;
    document.documentElement.dataset.stabilization095Guard = '1';

    const observer = new MutationObserver(() => {
      normalizeAllForms();
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true
    });

    document.addEventListener('click', event => {
      const target = event.target.closest('.list-row[data-canonical-form-correction], .search-result-item[data-canonical-form-correction]');
      if (!target) return;

      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();

      const id = target.dataset.id;
      const state = readState();
      setCanonicalStatus(id, state[id] !== true);
    }, true);
  };

  normalizeAllForms();
  installFormGuard();

  const boot = () => {
    setBetaMoniker();
    injectRefinementStyles();
    normalizeAllForms();
    installFormGuard();
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot, { once: true });
  } else {
    boot();
  }
})();