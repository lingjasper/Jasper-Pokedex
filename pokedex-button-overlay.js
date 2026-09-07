(() => {
  'use strict';

  const STYLE_ID = 'jasperPokedexButtonOverlayStyles';
  const installStyles = () => {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      @media (min-width:641px) {
        body > .pokedex-button-overlay {
          position:fixed!important;
          display:flex!important;
          align-items:center!important;
          justify-content:center!important;
          box-sizing:border-box!important;
          min-height:28px!important;
          padding:6px!important;
          border:1px solid #60A5FA!important;
          border-radius:4px!important;
          background:#F8FAFC!important;
          color:#2563EB!important;
          font-size:12px!important;
          font-weight:700!important;
          line-height:1!important;
          cursor:pointer!important;
          z-index:2147483647!important;
          opacity:0!important;
          pointer-events:none!important;
          transition:opacity .12s ease,background .12s ease!important;
        }
        body > .pokedex-button-overlay.is-visible {
          opacity:1!important;
          pointer-events:auto!important;
        }
        body > .pokedex-button-overlay:hover {
          background:#EFF6FF!important;
        }
        html[data-theme="dark"] body > .pokedex-button-overlay {
          border-color:#4979B6!important;
          background:#242831!important;
          color:#93C5FD!important;
        }
        html[data-theme="dark"] body > .pokedex-button-overlay:hover {
          background:#1D3150!important;
        }
      }
    `;
    document.head.appendChild(style);
  };

  const position = (button, card) => {
    if (!button || !card || window.matchMedia('(max-width:640px)').matches) return;
    const rect = card.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    button.style.left = `${rect.left}px`;
    button.style.top = `${rect.bottom + 4}px`;
    button.style.width = `${rect.width}px`;
  };

  const bind = button => {
    if (!button || button.dataset.pokedexOverlayBound === 'true') return;
    const card = button.closest('.pokemon-card');
    if (!card) return;

    button.dataset.pokedexOverlayBound = 'true';
    button.classList.add('pokedex-button-overlay');
    document.body.appendChild(button);

    let hideTimer = null;
    const show = () => {
      clearTimeout(hideTimer);
      position(button, card);
      button.classList.add('is-visible');
    };
    const scheduleHide = () => {
      clearTimeout(hideTimer);
      hideTimer = setTimeout(() => button.classList.remove('is-visible'), 180);
    };

    card.addEventListener('mouseenter', show);
    card.addEventListener('mousemove', () => position(button, card));
    card.addEventListener('mouseleave', event => {
      if (event.relatedTarget === button) return;
      scheduleHide();
    });
    button.addEventListener('mouseenter', show);
    button.addEventListener('mouseleave', scheduleHide);
    button.addEventListener('click', event => {
      event.preventDefault();
      event.stopPropagation();
      clearTimeout(hideTimer);
      button.classList.add('is-visible');
      if (window.JASPER_POKEDEX_UI?.open) window.JASPER_POKEDEX_UI.open(card);
    });

    const reposition = () => position(button, card);
    window.addEventListener('resize', reposition, { passive:true });
    window.addEventListener('scroll', reposition, { passive:true, capture:true });
    card.addEventListener('mouseleave', scheduleHide);
    position(button, card);
  };

  const scan = root => {
    root?.querySelectorAll?.('.pokemon-card .pokedex-button').forEach(bind);
  };

  const start = () => {
    installStyles();
    scan(document);
    const target = document.getElementById('boxContainer') || document.body;
    new MutationObserver(() => scan(target)).observe(target, { childList:true, subtree:true });
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once:true });
  else start();
})();
