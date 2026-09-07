(() => {
  'use strict';

  const STYLE_ID = 'jasperPokedexButtonOverlayStyles';
  const installStyles = () => {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      @media (min-width:641px) {
        .pokemon-card .pokedex-button {
          position:fixed!important;
          left:0!important;
          top:0!important;
          bottom:auto!important;
          width:auto!important;
          z-index:2147483647!important;
        }
      }
    `;
    document.head.appendChild(style);
  };

  const position = button => {
    const card = button?.closest?.('.pokemon-card');
    if (!card || window.matchMedia('(max-width:640px)').matches) return;
    const rect = card.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    button.style.left = `${rect.left}px`;
    button.style.top = `${rect.bottom + 4}px`;
    button.style.width = `${rect.width}px`;
  };

  const bind = button => {
    if (!button || button.dataset.pokedexOverlayBound === 'true') return;
    button.dataset.pokedexOverlayBound = 'true';
    const card = button.closest('.pokemon-card');
    if (!card) return;
    card.addEventListener('mouseenter', () => position(button));
    card.addEventListener('mousemove', () => position(button));
    button.addEventListener('mouseenter', () => position(button));
    window.addEventListener('resize', () => position(button), { passive:true });
    window.addEventListener('scroll', () => position(button), { passive:true, capture:true });
    position(button);
  };

  const scan = root => {
    root?.querySelectorAll?.('.pokemon-card .pokedex-button').forEach(bind);
    if (root?.matches?.('.pokemon-card .pokedex-button')) bind(root);
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
