(() => {
  'use strict';
  // SINGLE SOURCE OF TRUTH for the website release moniker.
  window.JASPER_POKEDEX_VERSION = 'Release v1.0.3';
  // Load v1.0.3 sprite presentation after the core release bootstrap has been defined.
  const load = () => {
    if (document.getElementById('jasperV103SpriteCard')) return;
    const s = document.createElement('script');
    s.id = 'jasperV103SpriteCard';
    s.src = 'sprite-card-v103.js';
    s.defer = true;
    document.head.appendChild(s);
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', load, { once: true });
  else load();
})();
