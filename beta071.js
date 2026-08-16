(() => {
  'use strict';

  const BETA_LABEL = 'Beta v0.7.2';
  const isMobile = () => window.matchMedia('(max-width: 640px)').matches;
  let observerTimer = null;

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
    // Only observe the rendered box area. The previous implementation watched
    // the entire document for every class mutation, which could repeatedly
    // scan every box and monopolize the main thread during rendering.
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
  }

  function start() {
    injectStyles();
    refresh();
    installObservers();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
  else start();
})();
