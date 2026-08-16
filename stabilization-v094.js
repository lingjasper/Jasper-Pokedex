(() => {
  'use strict';

  if (window.__JASPER_STABILIZATION_094__) return;
  window.__JASPER_STABILIZATION_094__ = true;

  const STATE_KEY = 'b2w2_living_dex_saved_state';
  const TOTAL_DEX = 300;

  // These are intentionally separate, boxable forms in the current B2W2 Dex.
  // Legacy cleanup in github-sync.js may otherwise collapse them to one entry.
  const KEEP_FORM_IDS = new Set([
    '297-Normal', '297-Black', '297-White',
    '298-Ordinary', '298-Resolute',
    '300-NoDrive', '300-Burn', '300-Shock', '300-Chill', '300-Douse'
  ]);

  const nativeRemove = Element.prototype.remove;
  const nativeRemoveChild = Node.prototype.removeChild;
  const isProtectedForm = node =>
    node instanceof Element && KEEP_FORM_IDS.has(node.getAttribute('data-id'));

  // Only guard the initial page-construction pass. Do not permanently patch
  // DOM prototypes; user-created/removed nodes must behave normally afterward.
  Element.prototype.remove = function () {
    if (isProtectedForm(this)) return;
    return nativeRemove.call(this);
  };
  Node.prototype.removeChild = function (child) {
    if (isProtectedForm(child)) return child;
    return nativeRemoveChild.call(this, child);
  };

  const restoreNativeDOMMethods = () => {
    Element.prototype.remove = nativeRemove;
    Node.prototype.removeChild = nativeRemoveChild;
  };

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

  const installParityGuard = () => {
    const box = document.getElementById('boxContainer');
    if (!box || box.dataset.stabilizationObserved) return;

    box.dataset.stabilizationObserved = '1';

    const observer = new MutationObserver(() => {
      syncUI();
    });

    observer.observe(box, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['class']
    });
  };

  const boot = () => {
    injectRefinementStyles();
    syncUI();
    installParityGuard();

    // The legacy form-pruning pass runs during initial script setup. Keep the
    // protection through DOMContentLoaded, then restore normal DOM behavior.
    restoreNativeDOMMethods();
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot, { once: true });
  } else {
    boot();
  }
})();
