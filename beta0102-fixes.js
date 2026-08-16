(() => {
  'use strict';

  // Beta v0.10.3 compatibility shim. The data-driven renderer owns search,
  // clear, and Jump-to behavior. This file only prevents legacy v0.10.2 UI
  // from reappearing when an older cached script is still loaded.
  const RELEASE = 'Beta v0.10.3';

  const repairLegacyUI = () => {
    document.querySelectorAll('.v0102-jump').forEach(el => el.remove());
    document.querySelectorAll('#pokedexBetaMoniker, .desktop-sidebar-brand .beta').forEach(el => {
      el.textContent = RELEASE;
    });
    const input = document.getElementById('searchInput');
    if (input && window.matchMedia('(max-width: 640px)').matches) {
      input.placeholder = 'Search...';
      input.style.fontSize = '16px';
    }
  };

  const boot = () => {
    repairLegacyUI();
    // Old release scripts may run on delayed timers. Keep the compatibility
    // cleanup short-lived and bounded rather than creating a permanent DOM
    // observer.
    [100, 300, 750, 1500].forEach(ms => window.setTimeout(repairLegacyUI, ms));
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
  else boot();
})();
