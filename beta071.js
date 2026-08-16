(() => {
  'use strict';

  const BETA_LABEL = 'Beta v0.7.1';
  const isMobile = () => window.matchMedia('(max-width: 640px)').matches;

  function updateBetaLabel() {
    const label = document.getElementById('pokedexBetaMoniker');
    if (label) label.textContent = BETA_LABEL;
  }

  function updateMobileViewButtons() {
    const buttons = [document.getElementById('boxViewBtn'), document.getElementById('listViewBtn')].filter(Boolean);
    buttons.forEach(button => {
      button.style.minWidth = isMobile() ? '80px' : '';
      button.style.flexShrink = '0';
      button.style.justifyContent = 'center';
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
    document.querySelectorAll('#boxContainer .pc-box').forEach(box => {
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
      counter.textContent = `${completed}/30`;
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

  function refresh() {
    updateBetaLabel();
    updateMobileViewButtons();
    updateMobileSearchDropdown();
    updateBoxCounters();
  }

  function installObservers() {
    const observer = new MutationObserver(() => {
      updateBetaLabel();
      updateBoxCounters();
      updateMobileViewButtons();
    });
    observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['class'] });

    window.addEventListener('resize', refresh);
    window.addEventListener('scroll', () => {
      const results = document.getElementById('searchResults');
      if (isMobile() && results && results.style.display !== 'none') updateMobileSearchDropdown();
    }, { passive: true });
  }

  function start() {
    injectStyles();
    refresh();
    installObservers();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
  else start();
})();
