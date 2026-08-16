(() => {
  'use strict';
  if (window.__JASPER_STABILIZATION_094__) return;
  window.__JASPER_STABILIZATION_094__ = true;

  const STATE_KEY = 'b2w2_living_dex_saved_state';
  const TOTAL_DEX = 300;

  // Preserve every intentionally boxable form in the current B2W2 layout.
  // Older compatibility cleanup code may otherwise remove these entries.
  const KEEP_FORM_IDS = new Set([
    '297-Normal', '297-Black', '297-White',
    '298-Ordinary', '298-Resolute',
    '300-NoDrive', '300-Burn', '300-Shock', '300-Chill', '300-Douse'
  ]);
  const nativeRemove = Element.prototype.remove;
  const nativeRemoveChild = Node.prototype.removeChild;
  const isProtectedForm = node => node instanceof Element && KEEP_FORM_IDS.has(node.getAttribute('data-id'));

  // Keep the guard active through the existing DOM initialization pass.
  Element.prototype.remove = function () {
    if (isProtectedForm(this)) return this;
    return nativeRemove.call(this);
  };
  Node.prototype.removeChild = function (child) {
    if (isProtectedForm(child)) return child;
    return nativeRemoveChild.call(this, child);
  };

  const readState = () => {
    try { return JSON.parse(localStorage.getItem(STATE_KEY) || '{}'); }
    catch { return {}; }
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
    text.textContent = `${registered} of ${TOTAL_DEX} Pokémon registered · ${TOTAL_DEX - registered} remaining · ${Math.round(registered / TOTAL_DEX * 100)}% complete`;
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

  // Keep progress state and all rendered views synchronized after local or remote writes.
  const originalSetItem = Storage.prototype.setItem;
  if (!window.__JASPER_STABILIZATION_STORAGE_PATCH__) {
    window.__JASPER_STABILIZATION_STORAGE_PATCH__ = true;
    Storage.prototype.setItem = function (key, value) {
      originalSetItem.call(this, key, value);
      if (this === localStorage && key === STATE_KEY) queueMicrotask(syncUI);
    };
  }

  const boot = () => {
    syncUI();
    const box = document.getElementById('boxContainer');
    if (box && !box.dataset.stabilizationObserved) {
      box.dataset.stabilizationObserved = '1';
      new MutationObserver(syncUI).observe(box, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ['class']
      });
    }
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot, { once: true });
  } else {
    boot();
  }
})();
